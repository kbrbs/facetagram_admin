import { db, auth } from './firebase-config.js';
import { checkAuth } from './auth-protection.js';
import {
    collection,
    getDocs,
    doc,
    getDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    onSnapshot,
    Timestamp
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

class GalleryManager {
    constructor() {
        // Add this at the start of constructor
        checkAuth().catch(() => {
            window.location.replace('../login.html');
        });

        this.mediaItems = [];
        this.filteredItems = [];
        this.selectedItems = new Set();
        this.currentFilters = {
            search: '',
            fileType: '',
            dateRange: null,
            user: '',
            status: ''
        };

        // Wait for Firebase to initialize before calling init
        this.initialize();
    }

    async initialize() {
        try {
            // Wait for auth to be ready
            await new Promise((resolve) => {
                const unsubscribe = auth.onAuthStateChanged((user) => {
                    unsubscribe();
                    resolve();
                });
            });

            console.log('Firebase initialized successfully');
            this.init();
        } catch (error) {
            console.error('Error initializing Firebase:', error);
            this.showError();
        }
    }

    init() {
        console.log('Initializing Gallery Manager...');
        this.setupEventListeners();
        this.loadGalleryData();
        this.setupSidebar();
    }

    setupEventListeners() {
        // Search functionality
        document.getElementById('searchBtn').addEventListener('click', () => this.handleSearch());
        document.getElementById('searchInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleSearch();
        });

        // Filter functionality
        document.getElementById('fileTypeFilter').addEventListener('change', () => this.applyFilters());
        document.getElementById('dateFilter').addEventListener('change', (e) => this.handleDateFilter(e));
        document.getElementById('userFilter').addEventListener('input', () => this.applyFilters());
        document.getElementById('statusFilter').addEventListener('change', () => this.applyFilters());
        document.getElementById('clearFiltersBtn').addEventListener('click', () => this.clearFilters());

        // Bulk actions
        document.getElementById('selectAllBtn').addEventListener('click', () => this.toggleSelectAll());
        document.getElementById('bulkDeleteBtn').addEventListener('click', () => this.handleBulkDelete());
        document.getElementById('bulkDownloadBtn').addEventListener('click', () => this.handleBulkDownload());

        // Modal functionality
        document.getElementById('closePreviewBtn').addEventListener('click', () => this.closeModal('previewModal'));
        document.getElementById('cancelBtn').addEventListener('click', () => this.closeModal('confirmModal'));
        document.getElementById('confirmBtn').addEventListener('click', () => this.handleConfirmAction());
        document.getElementById('closeDateBtn').addEventListener('click', () => this.closeModal('dateRangeModal'));
        document.getElementById('cancelDateBtn').addEventListener('click', () => this.closeModal('dateRangeModal'));
        document.getElementById('applyDateBtn').addEventListener('click', () => this.applyDateRange());

        // Preview modal actions
        document.getElementById('downloadBtn').addEventListener('click', () => this.downloadMedia());
        document.getElementById('flagBtn').addEventListener('click', () => this.flagMedia());
        document.getElementById('deleteBtn').addEventListener('click', () => this.deleteMedia());

        // Retry functionality
        document.getElementById('retryBtn').addEventListener('click', () => this.loadGalleryData());

        // Close modals on overlay click
        document.querySelectorAll('.modal-overlay').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal(modal.id);
                }
            });
        });
    }

    setupSidebar() {
        const sidebarToggle = document.getElementById('sidebarToggle');
        const mobileToggle = document.getElementById('mobileToggle');
        const sidebar = document.getElementById('sidebar');
        const sidebarOverlay = document.getElementById('sidebarOverlay');
        const adminProfile = document.getElementById('adminProfile');
        const adminDropdown = document.getElementById('adminDropdown');

        // Sidebar toggle functionality
        [sidebarToggle, mobileToggle].forEach(toggle => {
            toggle?.addEventListener('click', () => {
                sidebar.classList.toggle('active');
                sidebarOverlay.classList.toggle('active');
            });
        });

        // Close sidebar on overlay click
        sidebarOverlay?.addEventListener('click', () => {
            sidebar.classList.remove('active');
            sidebarOverlay.classList.remove('active');
        });

        // Admin dropdown
        adminProfile?.addEventListener('click', () => {
            adminProfile.classList.toggle('active');
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!adminProfile?.contains(e.target)) {
                adminProfile?.classList.remove('active');
            }
        });

        // Load admin info
        this.loadAdminInfo();
    }



    async loadAdminInfo() {
        try {
            const user = auth.currentUser;
            if (user) {
                document.getElementById('adminName').textContent = user.displayName || user.email;
                if (user.photoURL) {
                    document.getElementById('adminAvatar').src = user.photoURL;
                }
            }
        } catch (error) {
            console.error('Error loading admin info:', error);
        }
    }

    async loadGalleryData() {
        try {
            this.showLoading();
            this.hideError();

            // Load normal posts
            await this.loadUserPosts();

            // Load flagged reports
            await this.loadFlaggedReports();

            if (this.mediaItems.length > 0) {
                this.filteredItems = [...this.mediaItems];
                this.updateStats();
                this.renderGallery();
                this.hideEmptyState();
            } else {
                this.showEmptyState();
            }

            this.hideLoading();

        } catch (error) {
            console.error('Error loading gallery data:', error);
            this.showError();
            this.hideLoading();
        }
    }

    async loadUserPosts() {
        try {
            // First get all users
            const usersRef = collection(db, 'Users');
            const usersSnapshot = await getDocs(usersRef);
            
            // For each user, get their posts
            for (const userDoc of usersSnapshot.docs) {
                const userData = userDoc.data();
                const postsRef = collection(db, 'Users', userDoc.id, 'PostImages');
                const postsSnapshot = await getDocs(postsRef);
                
                postsSnapshot.forEach((doc) => {
                    const postData = doc.data();
                    
                    // Create media item
                    const mediaItem = {
                        id: doc.id,
                        url: postData.ImageURL || '',
                        type: 'image',
                        uploadDate: postData.Timestamp
                            ? new Date(postData.Timestamp.seconds * 1000 + postData.Timestamp.nanoseconds / 1000000)
                            : new Date(),
                        userId: userDoc.id,
                        user: {
                            username: userData.Username || 'Unknown User',
                            profilePicture: userData.ProfileImage || ''
                        },
                        status: postData.status || 'approved',
                        caption: postData.Description || '',
                        likes: postData.Likes ? Object.keys(postData.Likes).length : 0,
                        filename: postData.ImageURL ? postData.ImageURL.split('/').pop() : 'image.jpg'
                    };

                    // Update or add to mediaItems
                    const existingIndex = this.mediaItems.findIndex(item => item.id === mediaItem.id);
                    if (existingIndex >= 0) {
                        this.mediaItems[existingIndex] = mediaItem;
                    } else {
                        this.mediaItems.push(mediaItem);
                    }
                });
            }
        } catch (error) {
            console.error('Error loading user posts:', error);
            throw error; // Propagate error to be handled by loadGalleryData
        }
    }

    async loadFlaggedReports() {
        const reportsRef = collection(db, 'Reports');
        const reportsSnapshot = await getDocs(reportsRef);

        for (const reportDoc of reportsSnapshot.docs) {
            const reportData = reportDoc.data();
            
            // Get the original post data
            const userRef = doc(db, 'Users', reportData.PostOwner);
            const postRef = doc(userRef, 'PostImages', reportData.PostID);
            const postSnap = await getDoc(postRef);

            if (postSnap.exists()) {
                const postData = postSnap.data();
                
                // Create media item with report information
                const mediaItem = {
                    id: reportData.PostID,
                    url: postData.ImageURL || '',
                    type: 'image',
                    uploadDate: reportData.Timestamp
                        ? new Date(reportData.Timestamp.seconds * 1000 + reportData.Timestamp.nanoseconds / 1000000)
                        : new Date(),
                    userId: reportData.PostOwner,
                    user: {
                        username: postData.Username || 'Unknown User',
                        profilePicture: postData.ProfileImage || ''
                    },
                    status: 'flagged',
                    caption: postData.Description || '',
                    likes: postData.Likes ? Object.keys(postData.Likes).length : 0,
                    filename: postData.ImageURL ? postData.ImageURL.split('/').pop() : 'image.jpg',
                    reportInfo: {
                        reportId: reportDoc.id,
                        reason: reportData.Reason,
                        reportedBy: reportData.ReportedBy,
                        reportedDate: reportData.Timestamp
                    }
                };

                // Update or add to mediaItems
                const existingIndex = this.mediaItems.findIndex(item => item.id === mediaItem.id);
                if (existingIndex >= 0) {
                    this.mediaItems[existingIndex] = mediaItem;
                } else {
                    this.mediaItems.push(mediaItem);
                }
            }
        }
    }

    updateStats() {
        const totalFiles = this.mediaItems.length;
        const totalImages = this.mediaItems.filter(item => item.type === 'image').length;
        const totalVideos = this.mediaItems.filter(item => item.type === 'video').length;
        const flaggedFiles = this.mediaItems.filter(item => item.status === 'flagged').length;

        document.getElementById('totalFiles').textContent = totalFiles;
        document.getElementById('totalImages').textContent = totalImages;
        document.getElementById('totalVideos').textContent = totalVideos;
        document.getElementById('flaggedFiles').textContent = flaggedFiles;
    }

    renderGallery() {
        const galleryGrid = document.getElementById('galleryGrid');

        // Add this CSS style block at the beginning of renderGallery
        const style = document.createElement('style');
        style.textContent = `
            .media-status-badge {
                padding: 4px 8px;
                border-radius: 12px;
                font-size: 12px;
                font-weight: 600;
                text-transform: uppercase;
            }
            .media-status-badge.approved {
                background-color: #4CAF50;
                color: white;
            }
            .media-status-badge.flagged {
                background-color: #f44336;
                color: white;
            }
            .media-status-badge.dismissed {
                background-color: #9e9e9e;
                color: white;
            }
        `;
        document.head.appendChild(style);

        if (this.filteredItems.length === 0) {
            this.showEmptyState();
            galleryGrid.innerHTML = '';
            return;
        }

        this.hideEmptyState();

        galleryGrid.innerHTML = this.filteredItems.map(item => `
            <div class="media-item ${this.selectedItems.has(item.id) ? 'selected' : ''}" data-id="${item.id}">
                <input type="checkbox" class="media-checkbox" ${this.selectedItems.has(item.id) ? 'checked' : ''}>
                
                <div class="media-preview" onclick="galleryManager.openPreview('${item.id}')">
                    ${item.type === 'image'
                ? `<img src="${item.url}" alt="Media" loading="lazy">`
                : `<video src="${item.url}" muted></video>`
            }
                    <div class="media-type-badge">${item.type}</div>
                    <div class="media-status-badge ${item.status || 'approved'}">${item.status || 'approved'}</div>
                </div>

                <div class="media-info">
                    <div class="media-user">
                        <div class="user-avatar">
                            <img src="${item.user?.profilePicture || '/placeholder.svg?height=32&width=32'}" alt="User">
                        </div>
                        <div class="user-name">${item.user?.username || 'Unknown User'}</div>
                    </div>

                    <div class="media-meta">
                        <span>${this.formatDate(item.uploadDate)}</span>
                    </div>

                    <div class="media-actions">
                        <button class="action-btn preview" onclick="galleryManager.openPreview('${item.id}')">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="action-btn download" onclick="galleryManager.downloadSingle('${item.id}')">
                            <i class="fas fa-download"></i>
                        </button>
                        <button class="action-btn flag" onclick="galleryManager.flagSingle('${item.id}')">
                            <i class="fas fa-flag"></i>
                        </button>
                        <button class="action-btn delete" onclick="galleryManager.deleteSingle('${item.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');

        // Add checkbox event listeners
        document.querySelectorAll('.media-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const itemId = e.target.closest('.media-item').dataset.id;
                this.toggleSelection(itemId);
            });
        });

        this.updateBulkActionButtons();
    }

    handleSearch() {
        const searchTerm = document.getElementById('searchInput').value.trim();
        this.currentFilters.search = searchTerm;
        this.applyFilters();
    }

    applyFilters() {
        const searchTerm = this.currentFilters.search.toLowerCase();
        const fileType = document.getElementById('fileTypeFilter').value;
        const userFilter = document.getElementById('userFilter').value.toLowerCase();
        const statusFilter = document.getElementById('statusFilter').value;

        this.filteredItems = this.mediaItems.filter(item => {
            // Search filter
            const matchesSearch = !searchTerm ||
                (item.user?.username || '').toLowerCase().includes(searchTerm) ||
                (item.caption || '').toLowerCase().includes(searchTerm);

            // File type filter
            const matchesFileType = !fileType || item.type === fileType;

            // User filter
            const matchesUser = !userFilter ||
                (item.user?.username || '').toLowerCase().includes(userFilter);

            // Status filter
            const matchesStatus = !statusFilter || (item.status || 'approved') === statusFilter;

            // Date filter
            const matchesDate = !this.currentFilters.dateRange ||
                this.isWithinDateRange(item.uploadDate, this.currentFilters.dateRange);

            return matchesSearch && matchesFileType && matchesUser && matchesStatus && matchesDate;
        });

        this.renderGallery();
    }

    handleDateFilter(e) {
        const value = e.target.value;

        if (value === 'custom') {
            this.openModal('dateRangeModal');
            return;
        }

        let dateRange = null;
        const now = new Date();

        switch (value) {
            case 'today':
                dateRange = {
                    start: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
                    end: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
                };
                break;
            case 'week':
                const weekStart = new Date(now);
                weekStart.setDate(now.getDate() - now.getDay());
                dateRange = {
                    start: weekStart,
                    end: now
                };
                break;
            case 'month':
                dateRange = {
                    start: new Date(now.getFullYear(), now.getMonth(), 1),
                    end: now
                };
                break;
        }

        this.currentFilters.dateRange = dateRange;
        this.applyFilters();
    }

    applyDateRange() {
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;

        if (startDate && endDate) {
            this.currentFilters.dateRange = {
                start: new Date(startDate),
                end: new Date(endDate)
            };
            this.applyFilters();
        }

        this.closeModal('dateRangeModal');
    }

    isWithinDateRange(uploadDate, range) {
        if (!uploadDate || !range) return false;
        
        // Convert uploadDate to Date object if it's not already
        const itemDate = uploadDate instanceof Date ? uploadDate : new Date(uploadDate);
        
        // Set time to start of day for start date and end of day for end date
        const start = new Date(range.start);
        start.setHours(0, 0, 0, 0);
        
        const end = new Date(range.end);
        end.setHours(23, 59, 59, 999);
        
        return itemDate >= start && itemDate <= end;
    }

    clearFilters() {
        document.getElementById('searchInput').value = '';
        document.getElementById('fileTypeFilter').value = '';
        document.getElementById('dateFilter').value = '';
        document.getElementById('userFilter').value = '';
        document.getElementById('statusFilter').value = '';
        document.getElementById('startDate').value = '';
        document.getElementById('endDate').value = '';

        this.currentFilters = {
            search: '',
            fileType: '',
            dateRange: null,
            user: '',
            status: ''
        };

        this.filteredItems = [...this.mediaItems];
        this.renderGallery();
    }

    toggleSelection(itemId) {
        if (this.selectedItems.has(itemId)) {
            this.selectedItems.delete(itemId);
        } else {
            this.selectedItems.add(itemId);
        }

        // Update UI
        const mediaItem = document.querySelector(`[data-id="${itemId}"]`);
        const checkbox = mediaItem.querySelector('.media-checkbox');

        if (this.selectedItems.has(itemId)) {
            mediaItem.classList.add('selected');
            checkbox.checked = true;
        } else {
            mediaItem.classList.remove('selected');
            checkbox.checked = false;
        }

        this.updateBulkActionButtons();
    }

    toggleSelectAll() {
        const allSelected = this.selectedItems.size === this.filteredItems.length;

        if (allSelected) {
            this.selectedItems.clear();
        } else {
            this.filteredItems.forEach(item => this.selectedItems.add(item.id));
        }

        this.renderGallery();
    }

    updateBulkActionButtons() {
        const hasSelection = this.selectedItems.size > 0;
        document.getElementById('bulkDeleteBtn').disabled = !hasSelection;
        document.getElementById('bulkDownloadBtn').disabled = !hasSelection;

        const selectAllBtn = document.getElementById('selectAllBtn');
        const allSelected = this.selectedItems.size === this.filteredItems.length && this.filteredItems.length > 0;
        selectAllBtn.innerHTML = allSelected
            ? '<i class="fas fa-square"></i> Deselect All'
            : '<i class="fas fa-check-square"></i> Select All';
    }

    openPreview(itemId) {
        const item = this.mediaItems.find(m => m.id === itemId);
        if (!item) return;

        const previewContainer = document.getElementById('previewContainer');
        const mediaDetails = document.getElementById('mediaDetails');

        // Set preview content
        if (item.type === 'image') {
            previewContainer.innerHTML = `<img src="${item.url}" alt="Preview">`;
        } else {
            previewContainer.innerHTML = `<video src="${item.url}" controls></video>`;
        }

        // Set media details with report information if available
        mediaDetails.innerHTML = `
            <div class="detail-row">
                <span class="detail-label">File Name:</span>
                <span class="detail-value">${item.filename || 'Unknown'}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">File Type:</span>
                <span class="detail-value">${item.type}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Upload Date:</span>
                <span class="detail-value">${this.formatDate(item.uploadDate)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Uploaded By:</span>
                <span class="detail-value">${item.user?.username || 'Unknown User'}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Status:</span>
                <span class="detail-value">${item.status || 'approved'}</span>
            </div>
            ${item.reportInfo ? `
                <div class="detail-row report-info">
                    <span class="detail-label">Report Reason:</span>
                    <span class="detail-value">${item.reportInfo.reason}</span>
                </div>
                <div class="detail-row report-info">
                    <span class="detail-label">Reported Date:</span>
                    <span class="detail-value">${this.formatDate(item.reportInfo.reportedDate)}</span>
                </div>
            ` : ''}
            <div class="detail-row">
                <span class="detail-label">Caption:</span>
                <span class="detail-value">${item.caption || 'No caption'}</span>
            </div>
        `;

        this.currentPreviewItem = item;
        this.openModal('previewModal');
    }

    async downloadSingle(itemId) {
        const item = this.mediaItems.find(m => m.id === itemId);
        if (!item) return;

        try {
            const response = await fetch(item.url);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = item.filename || `media_${item.id}`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error('Error downloading file:', error);
            alert('Error downloading file. Please try again.');
        }
    }

    async downloadMedia() {
        if (this.currentPreviewItem) {
            await this.downloadSingle(this.currentPreviewItem.id);
        }
    }

    async flagSingle(itemId) {
        try {
            const item = this.mediaItems.find(m => m.id === itemId);
            if (!item) return;

            // Update in Firestore using correct nested path
            const userRef = doc(db, 'Users', item.userId);
            const postRef = doc(userRef, 'PostImages', item.id);
            await updateDoc(postRef, {
                status: 'flagged',
                flaggedDate: Timestamp.now(),
                flaggedBy: auth.currentUser?.uid
            });

            // Update local data
            item.status = 'flagged';
            this.renderGallery();
            this.updateStats();

            alert('Content has been flagged successfully.');
        } catch (error) {
            console.error('Error flagging content:', error);
            alert('Error flagging content. Please try again.');
        }
    }

    async flagMedia() {
        if (this.currentPreviewItem) {
            await this.flagSingle(this.currentPreviewItem.id);
            this.closeModal('previewModal');
        }
    }

    deleteSingle(itemId) {
        this.showConfirmModal(
            'Delete Media',
            'Are you sure you want to delete this media file? This action cannot be undone.',
            () => this.performDelete(itemId)
        );
    }

    async deleteMedia() {
        if (this.currentPreviewItem) {
            this.deleteSingle(this.currentPreviewItem.id);
            this.closeModal('previewModal');
        }
    }

    async performDelete(itemId) {
        try {
            const item = this.mediaItems.find(m => m.id === itemId);
            if (!item) return;

            // Delete from Firestore using correct nested path
            const userRef = doc(db, 'Users', item.userId);
            const postRef = doc(userRef, 'PostImages', item.id);
            await deleteDoc(postRef);

            // Update local data
            this.mediaItems = this.mediaItems.filter(m => m.id !== itemId);
            this.filteredItems = this.filteredItems.filter(m => m.id !== itemId);
            this.selectedItems.delete(itemId);

            this.renderGallery();
            this.updateStats();
            this.closeModal('confirmModal');

            alert('Media file deleted successfully.');
        } catch (error) {
            console.error('Error deleting media:', error);
            alert('Error deleting media file. Please try again.');
        }
    }

    handleBulkDelete() {
        if (this.selectedItems.size === 0) return;

        this.showConfirmModal(
            'Delete Selected Media',
            `Are you sure you want to delete ${this.selectedItems.size} selected media files? This action cannot be undone.`,
            () => this.performBulkDelete()
        );
    }

    async performBulkDelete() {
        try {
            const deletePromises = Array.from(this.selectedItems).map(async (itemId) => {
                const item = this.mediaItems.find(m => m.id === itemId);
                if (!item) return;

                // Delete from Firestore using correct path
                const userRef = doc(db, 'Users', item.userId);
                const postRef = doc(userRef, 'PostImages', item.id);
                await deleteDoc(postRef);
            });

            await Promise.all(deletePromises);

            // Update local data
            this.mediaItems = this.mediaItems.filter(m => !this.selectedItems.has(m.id));
            this.filteredItems = this.filteredItems.filter(m => !this.selectedItems.has(m.id));
            this.selectedItems.clear();

            this.renderGallery();
            this.updateStats();
            this.closeModal('confirmModal');

            alert('Selected media files deleted successfully.');
        } catch (error) {
            console.error('Error deleting media files:', error);
            alert('Error deleting some media files. Please try again.');
        }
    }

    async handleBulkDownload() {
        if (this.selectedItems.size === 0) return;

        try {
            const downloadPromises = Array.from(this.selectedItems).map(async (itemId) => {
                const item = this.mediaItems.find(m => m.id === itemId);
                if (!item) return;

                const response = await fetch(item.url);
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = item.filename || `media_${item.id}`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);

                // Add delay to prevent browser blocking
                await new Promise(resolve => setTimeout(resolve, 100));
            });

            await Promise.all(downloadPromises);
            alert('Download started for selected files.');
        } catch (error) {
            console.error('Error downloading files:', error);
            alert('Error downloading some files. Please try again.');
        }
    }

    showConfirmModal(title, message, onConfirm) {
        document.getElementById('confirmTitle').textContent = title;
        document.getElementById('confirmMessage').textContent = message;
        this.confirmAction = onConfirm;
        this.openModal('confirmModal');
    }

    handleConfirmAction() {
        if (this.confirmAction) {
            this.confirmAction();
            this.confirmAction = null;
        }
    }

    openModal(modalId) {
        const modal = document.getElementById(modalId);
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }

    showLoading() {
        document.getElementById('loadingSpinner').style.display = 'flex';
    }

    hideLoading() {
        document.getElementById('loadingSpinner').style.display = 'none';
    }

    showError() {
        document.getElementById('errorMessage').style.display = 'block';
    }

    hideError() {
        document.getElementById('errorMessage').style.display = 'none';
    }

    showEmptyState() {
        document.getElementById('emptyState').style.display = 'block';
    }

    hideEmptyState() {
        document.getElementById('emptyState').style.display = 'none';
    }

    formatDate(date) {
        if (!date) return 'Unknown';
        if (date instanceof Timestamp) {
            // Convert Firestore Timestamp to JS Date
            date = new Date(date.seconds * 1000 + date.nanoseconds / 1000000);
        }
        return new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    }

    // Content moderation functionality
    async scanForInappropriateContent() {
        try {
            // This would integrate with a content moderation service
            // For now, we'll simulate the process
            const unscannedItems = this.mediaItems.filter(item => !item.contentScanned);

            for (const item of unscannedItems) {
                // Simulate content scanning
                const isInappropriate = Math.random() < 0.1; // 10% chance for demo

                await db.collection('media').doc(item.id).update({
                    contentScanned: true,
                    scanDate: firebase.firestore.FieldValue.serverTimestamp(),
                    status: isInappropriate ? 'flagged' : 'approved'
                });

                item.contentScanned = true;
                item.status = isInappropriate ? 'flagged' : 'approved';
            }

            this.renderGallery();
            this.updateStats();
            alert('Content scanning completed.');
        } catch (error) {
            console.error('Error scanning content:', error);
            alert('Error scanning content. Please try again.');
        }
    }
}

// Create an instance of GalleryManager only after the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.galleryManager = new GalleryManager();
});