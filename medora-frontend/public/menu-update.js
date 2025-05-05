/**
 * Add this code at the end of your existing menu.js file
 * This adds the logout functionality without changing your UI
 */

// Just add this at the end of your existing menu.js file

// Define logout function that can be called from the menu
window.logout = function() {
    console.log('Logout function called');
    
    // Use the helper function if available
    if (typeof window.performLogout === 'function') {
        window.performLogout();
    } else {
        // Fallback logout if helper not available
        localStorage.removeItem('idToken');
        localStorage.removeItem('accessToken');
        localStorage.removeItem('currentEmail');
        
        // Redirect to login
        window.location.href = 'login.html';
    }
};

// Find the logout menu item and update its click handler if needed
document.addEventListener('DOMContentLoaded', function() {
    // This code runs after your existing menu setup
    
    // Find all links in the menu
    const menuLinks = document.querySelectorAll('.menu-item a');
    
    // Look for the logout link
    menuLinks.forEach(link => {
        if (link.textContent.includes('Logout')) {
            // Update its click handler to use our logout function
            link.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                // Call our logout function
                window.logout();
            });
        }
    });
    
    console.log('Menu logout handler updated');
});
