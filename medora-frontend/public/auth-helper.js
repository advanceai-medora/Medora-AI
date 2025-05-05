/**
 * auth-helper.js - Simple authentication helpers for Medora
 * Using the correct Cognito domain
 */

// Cognito configuration
const cognitoConfig = {
    // Use the domain from your Cognito console
    domain: 'https://ap-south-1esdojoj.auth.ap-south-1.amazoncognito.com',
    clientId: '2be02c28m6clvp6fC505164',
    region: 'ap-south-1',
    redirectUri: 'https://test.medoramd.ai/index.html'
};

// Check if we're authenticated
window.isAuthenticated = function() {
    // Simple check for required tokens
    const idToken = localStorage.getItem('idToken');
    const accessToken = localStorage.getItem('accessToken');
    const currentEmail = localStorage.getItem('currentEmail');
    
    return idToken && accessToken && currentEmail;
};

// Simple function to redirect to login if not authenticated
window.checkAuth = function() {
    if (!window.isAuthenticated()) {
        console.log('Not authenticated, redirecting to login page');
        window.location.href = 'login.html';
        return false;
    }
    return true;
};

// Simple logout function
window.performLogout = function() {
    console.log('Logging out...');
    
    // Clear authentication tokens
    localStorage.removeItem('idToken');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('currentEmail');
    
    // Redirect to login page
    window.location.href = 'login.html';
};

// Helper for OAuth URL generation
window.getLoginUrl = function() {
    return `${cognitoConfig.domain}/login?` +
           `response_type=code&` + 
           `client_id=${cognitoConfig.clientId}&` +
           `redirect_uri=${encodeURIComponent(cognitoConfig.redirectUri)}`;
};

// Check auth on load
console.log('Auth helper loaded, checking authentication...');
