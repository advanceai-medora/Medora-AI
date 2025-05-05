/**
 * cognito-auth.js - AWS Cognito Authentication for Medora
 * Handles authentication and session management with correct domain
 */

// Define Cognito User Pool Configuration
const poolData = {
    UserPoolId: 'ap-south-1_3lwzdx',
    ClientId: '2be02c28m6clvp6fC505164'
};

// Cognito domain - use the exact domain from your Cognito console
const cognitoDomain = 'https://ap-south-1esdojoj.auth.ap-south-1.amazoncognito.com';

// Redirect URL that you've configured in your app client
const redirectUri = 'https://test.medoramd.ai/index.html';

// Cognito global variables
let userPool, cognitoUser;

// Initialize on page load
document.addEventListener('DOMContentLoaded', initCognito);

/**
 * Initialize Cognito SDK
 */
function initCognito() {
    console.log('Initializing Cognito authentication...');
    
    // Check if AWS Cognito SDK is loaded
    if (typeof AmazonCognitoIdentity === 'undefined') {
        console.error('ERROR: Amazon Cognito Identity SDK not loaded!');
        return;
    }
    
    try {
        // Create user pool
        userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);
        console.log('Cognito User Pool created successfully');
        
        // Get current user if available
        cognitoUser = userPool.getCurrentUser();
        
        if (cognitoUser) {
            console.log('Current user found in Cognito session');
        } else {
            console.log('No current user found in Cognito session');
        }
    } catch (error) {
        console.error('Failed to initialize Cognito:', error);
    }
}

/**
 * Check authentication state
 * Returns a promise that resolves if authenticated, rejects if not
 */
window.checkAuthState = function() {
    return new Promise((resolve, reject) => {
        console.log('Checking authentication state...');
        
        // First check if we have stored tokens
        const idToken = localStorage.getItem('idToken');
        const accessToken = localStorage.getItem('accessToken');
        const currentEmail = localStorage.getItem('currentEmail');
        
        if (!idToken || !accessToken || !currentEmail) {
            console.error('Missing authentication tokens');
            reject('Missing authentication tokens');
            return;
        }
        
        // Check if Cognito SDK is available
        if (typeof AmazonCognitoIdentity === 'undefined') {
            console.error('Amazon Cognito Identity SDK not loaded');
            reject('SDK not loaded');
            return;
        }
        
        // Initialize userPool if not done yet
        if (!userPool) {
            try {
                userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);
            } catch (error) {
                console.error('Failed to create Cognito User Pool:', error);
                reject(error);
                return;
            }
        }
        
        // Get current user from Cognito
        const cognitoUser = userPool.getCurrentUser();
        
        if (!cognitoUser) {
            console.error('No authenticated user found in Cognito session');
            reject('No authenticated user');
            return;
        }
        
        // Get current session to verify it's valid
        cognitoUser.getSession(function(err, session) {
            if (err) {
                console.error('Error getting session:', err);
                reject(err);
                return;
            }
            
            if (!session.isValid()) {
                console.error('Session is invalid');
                reject('Invalid session');
                return;
            }
            
            console.log('User is authenticated with valid session');
            resolve(true);
        });
    });
};

/**
 * Generate Google sign-in URL
 */
window.getGoogleSignInUrl = function() {
    // Construct the Google sign-in URL
    const responseType = 'code';
    const identityProvider = 'Google';
    const scopes = encodeURIComponent('email openid profile');
    
    const googleSignInUrl = `${cognitoDomain}/oauth2/authorize?client_id=${poolData.ClientId}&response_type=${responseType}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}&identity_provider=${identityProvider}`;
    
    return googleSignInUrl;
};

/**
 * Log out current user
 * Clears tokens and redirects to login page
 */
window.logoutUser = function() {
    console.log('Logging out user...');
    
    // Check if Cognito SDK is available
    if (typeof AmazonCognitoIdentity === 'undefined') {
        console.error('Amazon Cognito Identity SDK not loaded');
        
        // Fallback logout - just clear storage and redirect
        localStorage.removeItem('idToken');
        localStorage.removeItem('accessToken');
        localStorage.removeItem('currentEmail');
        
        window.location.href = 'login.html';
        return;
    }
    
    // Initialize userPool if not done yet
    if (!userPool) {
        try {
            userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);
        } catch (error) {
            console.error('Failed to create Cognito User Pool:', error);
            
            // Fallback logout
            localStorage.removeItem('idToken');
            localStorage.removeItem('accessToken');
            localStorage.removeItem('currentEmail');
            
            window.location.href = 'login.html';
            return;
        }
    }
    
    // Get current user from Cognito
    const cognitoUser = userPool.getCurrentUser();
    
    if (cognitoUser) {
        // Sign out from Cognito
        cognitoUser.signOut();
        console.log('User signed out from Cognito');
    }
    
    // Clear local storage
    localStorage.removeItem('idToken');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('currentEmail');
    
    console.log('Auth tokens cleared, redirecting to login page');
    
    // Redirect to login page
    window.location.href = 'login.html';
};

/**
 * Get current user's email
 */
window.getCurrentUserEmail = function() {
    return localStorage.getItem('currentEmail');
};

/**
 * Get current ID token (useful for API calls)
 */
window.getIdToken = function() {
    return localStorage.getItem('idToken');
};

/**
 * Check if SDK is loaded
 */
window.isCognitoSdkLoaded = function() {
    return typeof AmazonCognitoIdentity !== 'undefined';
};

console.log('Cognito auth script loaded');
