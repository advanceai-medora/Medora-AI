/**
 * Enhanced logout functionality for Medora
 * This adds confirm-before-logout support based on settings
 */

// Original logout function
const originalLogout = window.logout;

// Replace the original logout function with our enhanced version
window.logout = function() {
    console.log('Enhanced logout called');
    
    // Check if we should confirm before logging out (default to true)
    const confirmLogout = localStorage.getItem('confirmLogout') !== 'false';
    
    // If confirmation is required, show confirmation dialog
    if (confirmLogout && !window.isLoggingOutDueToTimeout) {
        if (!confirm('Are you sure you want to log out?')) {
            console.log('Logout cancelled by user');
            return; // User cancelled logout
        }
    }
    
    // Clear any auto-save interval if it exists
    if (window.autoSaveInterval) {
        clearInterval(window.autoSaveInterval);
        window.autoSaveInterval = null;
    }
    
    console.log('Proceeding with logout');
    
    // Call original logout implementation or do a basic logout
    if (typeof originalLogout === 'function') {
        console.log('Calling original logout function');
        originalLogout();
    } else {
        console.log('Original logout function not found, using fallback');
        // Basic logout implementation
        localStorage.removeItem('currentEmail');
        
        // Redirect to login page
        setTimeout(() => {
            window.location.href = 'https://test.medoramd.ai/login.html';
        }, 100);
    }
};

// This function is called when logging out due to session timeout
window.logoutDueToTimeout = function() {
    console.log('Logging out due to session timeout');
    window.isLoggingOutDueToTimeout = true;
    window.logout();
    window.isLoggingOutDueToTimeout = false;
};

console.log('Enhanced logout functionality initialized');
