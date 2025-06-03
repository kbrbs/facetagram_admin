import { db, auth, logAdminDetails } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

function checkAuth() {
    onAuthStateChanged(auth, (user) => {
        if (!user && !window.location.href.includes('http://localhost/facetagram_admin/index.html')) {
            window.location.href = 'http://localhost/facetagram_admin/index.html';
        }
    });
}

class FacetagramDashboard {
    constructor() {
        this.isLoading = true;
        this.sidebarCollapsed = false;
    }

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.toggle('collapsed');
        this.sidebarCollapsed = !this.sidebarCollapsed;
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

    showLoading() {
        document.getElementById('loadingSpinner').style.display = 'flex';
        document.getElementById('dashboardContent').style.display = 'none';
        document.getElementById('errorMessage').style.display = 'none';
    }

    showDashboard() {
        document.getElementById('loadingSpinner').style.display = 'none';
        document.getElementById('dashboardContent').style.display = 'block';
        document.getElementById('errorMessage').style.display = 'none';
        this.isLoading = false;
    }

    showError(message) {
        document.getElementById('loadingSpinner').style.display = 'none';
        document.getElementById('dashboardContent').style.display = 'none';
        const errorElement = document.getElementById('errorMessage');
        errorElement.style.display = 'block';

        const errorText = errorElement.querySelector('p');
        if (errorText) {
            errorText.textContent = message;
        }
    }
}

function setupAdminProfileDropdown() {
    // Admin profile dropdown
    const adminProfile = document.getElementById('adminProfile');
    const adminDropdown = document.getElementById('adminDropdown');

    adminProfile?.addEventListener('click', (e) => {
        e.stopPropagation();
        adminDropdown.classList.toggle('show');
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', () => {
        adminDropdown?.classList.remove('show');
    });

    // Logout functionality
    const logoutBtn = document.getElementById('logoutBtn');
    logoutBtn?.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
            await auth.signOut();
            window.location.href = 'http://localhost/facetagram_admin/index.html';
        } catch (error) {
            console.error('Error signing out:', error);
            alert('Error signing out. Please try again.');
        }
    });
}

document.addEventListener('DOMContentLoaded', async function () {
    try {
        // Check authentication first
        checkAuth();
        
        // Initialize admin profile and dropdown
        setupAdminProfileDropdown();
        
        // ...existing code...
    } catch (error) {
        console.error('Error initializing:', error);
    }
});