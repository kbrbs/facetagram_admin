import { db, auth } from './firebase-config.js';
import { checkAuth } from './auth-protection.js';
import {
    collection,
    getDocs,
    doc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    onSnapshot
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

class RegisteredAccountsManager {
    constructor() {
        // Add this at the start of constructor
        checkAuth().catch(() => {
            window.location.replace('../login.html');
        });
        this.users = [];
        this.filteredUsers = [];
        this.selectedUsers = new Set();
        this.isLoading = true;
        this.searchTerm = '';
        this.init();
    }

    async init() {
        try {
            this.setupEventListeners();
            // Remove the duplicate auth check, as checkAuthState will handle it
            await this.loadUsers();
        } catch (error) {
            console.error('Error initializing:', error);
            this.showError('Failed to initialize. Please check your authentication.');
        }
    }

    setupEventListeners() {
        // Sidebar functionality
        this.setupSidebarEvents();

        // Search functionality
        const searchInput = document.getElementById('searchInput');
        const searchBtn = document.getElementById('searchBtn');
        const resetBtn = document.getElementById('resetBtn');

        searchInput?.addEventListener('input', (e) => {
            this.searchTerm = e.target.value.toLowerCase();
            this.filterUsers();
        });

        searchBtn?.addEventListener('click', () => this.performSearch());
        resetBtn?.addEventListener('click', () => this.resetSearch());

        // Action buttons
        const blockBtn = document.getElementById('blockBtn');
        const unblockBtn = document.getElementById('unblockBtn');
        const deleteBtn = document.getElementById('deleteBtn');
        const reportBtn = document.getElementById('reportBtn');

        blockBtn?.addEventListener('click', () => this.blockSelectedUsers());
        unblockBtn?.addEventListener('click', () => this.unblockSelectedUsers());
        deleteBtn?.addEventListener('click', () => this.deleteSelectedUsers());
        reportBtn?.addEventListener('click', () => this.generateReport());

        // Retry button
        const retryBtn = document.getElementById('retryBtn');
        retryBtn?.addEventListener('click', () => this.loadUsers());

        // Modal events
        this.setupModalEvents();
    }

    setupSidebarEvents() {
        const sidebarToggle = document.getElementById('sidebarToggle');
        const mobileToggle = document.getElementById('mobileToggle');
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebarOverlay');

        sidebarToggle?.addEventListener('click', () => this.toggleSidebar());
        mobileToggle?.addEventListener('click', () => this.toggleMobileSidebar());
        overlay?.addEventListener('click', () => this.closeMobileSidebar());

        // Handle window resize
        window.addEventListener('resize', () => {
            if (window.innerWidth > 768) {
                this.closeMobileSidebar();
            }
        });
    }

    setupModalEvents() {
        const modalOverlay = document.getElementById('modalOverlay');
        const modalClose = document.getElementById('modalClose');
        const modalCancel = document.getElementById('modalCancel');
        const modalConfirm = document.getElementById('modalConfirm');

        modalClose?.addEventListener('click', () => this.hideModal());
        modalCancel?.addEventListener('click', () => this.hideModal());
        modalOverlay?.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                this.hideModal();
            }
        });

        modalConfirm?.addEventListener('click', () => {
            if (this.pendingAction) {
                this.pendingAction();
                this.hideModal();
            }
        });
    }

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.toggle('collapsed');
    }

    toggleMobileSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebarOverlay');

        sidebar.classList.toggle('mobile-show');
        overlay.classList.toggle('show');
    }

    closeMobileSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebarOverlay');

        sidebar.classList.remove('mobile-show');
        overlay.classList.remove('show');
    }

    checkAuthState() {
        // Remove the redirect loop by checking if we're already on the login page
        auth.onAuthStateChanged((user) => {
            if (user) {
                if (user.email === "barbosakat26@gmail.com") {
                    // User is admin, just load the profile
                    this.loadUserProfile(user);
                } else {
                    console.log('Not an admin user');
                    auth.signOut();
                    if (window.location.pathname !== '/login.html') {
                        window.location.href = '../login.html';
                    }
                }
            } else {
                console.log('User not authenticated');
                if (window.location.pathname !== '/login.html') {
                    window.location.href = '../login.html';
                }
            }
        });
    }

    async loadUserProfile(user) {
        try {
            const adminName = document.getElementById('adminName');
            // Use Authentication user properties
            adminName.textContent = user.email || 'Admin User';

            // You can also access other Authentication properties
            console.log('User ID:', user.uid);
            console.log('Email verified:', user.emailVerified);
            console.log('Created at:', user.metadata.creationTime);
            console.log('Last sign in:', user.metadata.lastSignInTime);
        } catch (error) {
            console.error('Error loading user profile:', error);
            document.getElementById('adminName').textContent = 'Admin User';
        }
    }

    async loadUsers() {
        this.showLoading();

        try {
            // Get users collection from Firestore
            const usersCollection = collection(db, 'Users');
            const usersSnapshot = await getDocs(usersCollection);

            this.users = [];
            usersSnapshot.forEach((doc) => {
                const userData = doc.data();
                this.users.push({
                    id: doc.id,
                    name: userData.Username || 'Unknown User',
                    username: userData.Username || '',
                    email: userData.Email || '',
                    followers: userData.Followers || 0,
                    following: userData.Following || 0,
                    profileImage: userData.ProfileImage || '',
                    bio: userData.Bio || '',
                    isBlocked: userData.isBlocked || false,
                    uid: userData.UID || doc.id
                });
            });

            this.filteredUsers = [...this.users];
            this.renderUsers();
            this.showUsersGrid();

        } catch (error) {
            console.error('Error loading users:', error);
            this.showError('Failed to load user data. Please check your Firebase configuration.');
        }
    }

    filterUsers() {
        if (!this.searchTerm) {
            this.filteredUsers = [...this.users];
        } else {
            this.filteredUsers = this.users.filter(user =>
                user.name.toLowerCase().includes(this.searchTerm) ||
                user.username.toLowerCase().includes(this.searchTerm) ||
                user.email.toLowerCase().includes(this.searchTerm)
            );
        }
        this.renderUsers();
    }

    performSearch() {
        const searchInput = document.getElementById('searchInput');
        this.searchTerm = searchInput.value.toLowerCase();
        this.filterUsers();
    }

    resetSearch() {
        const searchInput = document.getElementById('searchInput');
        searchInput.value = '';
        this.searchTerm = '';
        this.selectedUsers.clear();
        this.filterUsers();
        this.updateActionButtons();
    }

    renderUsers() {
        const usersGrid = document.getElementById('usersGrid');
        const noResults = document.getElementById('noResults');

        if (this.filteredUsers.length === 0) {
            usersGrid.style.display = 'none';
            noResults.style.display = 'block';
            return;
        }

        noResults.style.display = 'none';
        usersGrid.style.display = 'grid';

        usersGrid.innerHTML = this.filteredUsers.map(user => this.createUserCard(user)).join('');

        // Add event listeners to user cards
        this.attachUserCardEvents();
    }

    createUserCard(user) {
        const isSelected = this.selectedUsers.has(user.id);
        const statusClass = user.isBlocked ? 'status-blocked' : 'status-active';
        const statusText = user.isBlocked ? 'Blocked' : 'Active';
        const cardClass = user.isBlocked ? 'user-card blocked' : 'user-card';
        const actionButton = user.isBlocked
            ? `<button class="user-action-btn unblock-user-btn" data-user-id="${user.id}">Unblock</button>`
            : `<button class="user-action-btn block-user-btn" data-user-id="${user.id}">Block</button>`;

        return `
            <div class="${cardClass} ${isSelected ? 'selected' : ''}" data-user-id="${user.id}">
                <div class="user-status ${statusClass}">${statusText}</div>
                <input type="checkbox" class="user-checkbox" data-user-id="${user.id}" ${isSelected ? 'checked' : ''}>
                
                <div class="user-card-header">
                    <div class="user-avatar">
                        ${user.profileImage
                ? `<img src="${user.profileImage}" alt="${user.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">`
                : ''
            }
                        <div class="user-avatar-placeholder" ${user.profileImage ? 'style="display: none;"' : ''}></div>
                    </div>
                    <div class="user-info">
                        <h3>${this.escapeHtml(user.name)}</h3>
                        <div class="username">Username: ${this.escapeHtml(user.username)}</div>
                        <div class="email">${this.escapeHtml(user.email)}</div>
                        <div class="followers">Followers: ${Array.isArray(user.followers) ? user.followers.length : 0}</div>
                        <div class="followers">Following: ${Array.isArray(user.following) ? user.following.length : 0}</div>
                    </div>
                </div>
                
                <div class="user-actions">
                    ${actionButton}
                </div>
            </div>
        `;
    }

    attachUserCardEvents() {
        // Checkbox events
        const checkboxes = document.querySelectorAll('.user-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const userId = e.target.dataset.userId;
                const userCard = e.target.closest('.user-card');

                if (e.target.checked) {
                    this.selectedUsers.add(userId);
                    userCard.classList.add('selected');
                } else {
                    this.selectedUsers.delete(userId);
                    userCard.classList.remove('selected');
                }

                this.updateActionButtons();
            });
        });

        // Individual action buttons
        const actionButtons = document.querySelectorAll('.user-action-btn');
        actionButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const userId = e.target.dataset.userId;
                const isBlockButton = e.target.classList.contains('block-user-btn');

                if (isBlockButton) {
                    this.blockUser(userId);
                } else {
                    this.unblockUser(userId);
                }
            });
        });
    }

    updateActionButtons() {
        const blockBtn = document.getElementById('blockBtn');
        const unblockBtn = document.getElementById('unblockBtn');
        const deleteBtn = document.getElementById('deleteBtn');

        const hasSelection = this.selectedUsers.size > 0;

        blockBtn.disabled = !hasSelection;
        unblockBtn.disabled = !hasSelection;
        deleteBtn.disabled = !hasSelection;
    }

    async blockUser(userId) {
        try {
            const userRef = doc(db, 'Users', userId);
            await updateDoc(userRef, { isBlocked: true });

            // Update local data
            const user = this.users.find(u => u.id === userId);
            if (user) {
                user.isBlocked = true;
            }

            this.filterUsers();
            this.showSuccessMessage('User blocked successfully');
        } catch (error) {
            console.error('Error blocking user:', error);
            this.showErrorMessage('Failed to block user');
        }
    }

    async unblockUser(userId) {
        try {
            const userRef = doc(db, 'Users', userId);
            await updateDoc(userRef, { isBlocked: false });

            // Update local data
            const user = this.users.find(u => u.id === userId);
            if (user) {
                user.isBlocked = false;
            }

            this.filterUsers();
            this.showSuccessMessage('User unblocked successfully');
        } catch (error) {
            console.error('Error unblocking user:', error);
            this.showErrorMessage('Failed to unblock user');
        }
    }

    blockSelectedUsers() {
        if (this.selectedUsers.size === 0) return;

        this.showModal(
            'Block Users',
            `Are you sure you want to block ${this.selectedUsers.size} selected user(s)?`,
            () => this.performBulkAction('block')
        );
    }

    unblockSelectedUsers() {
        if (this.selectedUsers.size === 0) return;

        this.showModal(
            'Unblock Users',
            `Are you sure you want to unblock ${this.selectedUsers.size} selected user(s)?`,
            () => this.performBulkAction('unblock')
        );
    }

    deleteSelectedUsers() {
        if (this.selectedUsers.size === 0) return;

        this.showModal(
            'Delete Users',
            `Are you sure you want to permanently delete ${this.selectedUsers.size} selected user(s)? This action cannot be undone.`,
            () => this.performBulkAction('delete')
        );
    }

    async performBulkAction(action) {
        const selectedUserIds = Array.from(this.selectedUsers);
        let successCount = 0;
        let errorCount = 0;

        for (const userId of selectedUserIds) {
            try {
                const userRef = doc(db, 'Users', userId);

                if (action === 'delete') {
                    await deleteDoc(userRef);
                    // Remove from local data
                    this.users = this.users.filter(u => u.id !== userId);
                } else {
                    const isBlocked = action === 'block';
                    await updateDoc(userRef, { isBlocked });

                    // Update local data
                    const user = this.users.find(u => u.id === userId);
                    if (user) {
                        user.isBlocked = isBlocked;
                    }
                }

                successCount++;
            } catch (error) {
                console.error(`Error ${action}ing user ${userId}:`, error);
                errorCount++;
            }
        }

        // Clear selection and update UI
        this.selectedUsers.clear();
        this.filterUsers();
        this.updateActionButtons();

        // Show result message
        if (errorCount === 0) {
            this.showSuccessMessage(`Successfully ${action}ed ${successCount} user(s)`);
        } else {
            this.showErrorMessage(`${action}ed ${successCount} user(s), ${errorCount} failed`);
        }
    }

    generateReport() {
        const reportData = {
            totalUsers: this.users.length,
            activeUsers: this.users.filter(u => !u.isBlocked).length,
            blockedUsers: this.users.filter(u => u.isBlocked).length,
            generatedAt: new Date().toISOString(),
            users: this.users.map(user => ({
                name: user.name,
                username: user.username,
                email: user.email,
                followers: user.followers,
                following: user.following,
                status: user.isBlocked ? 'Blocked' : 'Active'
            }))
        };

        // Create and download CSV
        this.downloadCSV(reportData);
    }

    downloadCSV(data) {
        const csvContent = [
            ['Name', 'Username', 'Email', 'Followers', 'Following', 'Status'],
            ...data.users.map(user => [
                user.name,
                user.username,
                user.email,
                user.followers,
                user.following,
                user.status
            ])
        ].map(row => row.map(field => `"${field}"`).join(',')).join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `facetagram-users-report-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        this.showSuccessMessage('Report generated and downloaded successfully');
    }

    showModal(title, message, confirmAction) {
        const modalOverlay = document.getElementById('modalOverlay');
        const modalTitle = document.getElementById('modalTitle');
        const modalMessage = document.getElementById('modalMessage');

        modalTitle.textContent = title;
        modalMessage.textContent = message;
        this.pendingAction = confirmAction;

        modalOverlay.classList.add('show');
    }

    hideModal() {
        const modalOverlay = document.getElementById('modalOverlay');
        modalOverlay.classList.remove('show');
        this.pendingAction = null;
    }

    showLoading() {
        document.getElementById('loadingSpinner').style.display = 'flex';
        document.getElementById('usersGrid').style.display = 'none';
        document.getElementById('noResults').style.display = 'none';
        document.getElementById('errorMessage').style.display = 'none';
    }

    showUsersGrid() {
        document.getElementById('loadingSpinner').style.display = 'none';
        document.getElementById('usersGrid').style.display = 'grid';
        document.getElementById('errorMessage').style.display = 'none';
        this.isLoading = false;
    }

    showError(message) {
        document.getElementById('loadingSpinner').style.display = 'none';
        document.getElementById('usersGrid').style.display = 'none';
        document.getElementById('noResults').style.display = 'none';
        const errorElement = document.getElementById('errorMessage');
        errorElement.style.display = 'block';

        const errorText = errorElement.querySelector('p');
        if (errorText) {
            errorText.textContent = message;
        }
    }

    showSuccessMessage(message) {
        // You can implement a toast notification here
        console.log('Success:', message);
        alert(message); // Temporary - replace with proper toast
    }

    showErrorMessage(message) {
        // You can implement a toast notification here
        console.error('Error:', message);
        alert(message); // Temporary - replace with proper toast
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

}

// Initialize the registered accounts manager when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new RegisteredAccountsManager();
});