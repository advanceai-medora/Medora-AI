/**
 * auth.js - Simple authentication logic for Medora
 */

// Simple client-side authentication
function signIn(email, password) {
    const errorMessage = document.getElementById('errorMessage');
    if (errorMessage) {
        errorMessage.style.display = 'none';
    }

    // Hardcoded credentials for doctor@allergyaffiliates.com
    const validEmail = 'doctor@allergyaffiliates.com';
    const validPassword = '18June2011!';

    if (email === validEmail && password === validPassword) {
        console.log('Sign-in successful for:', email);
        // Store email in localStorage to persist across pages
        localStorage.setItem('currentEmail', email);
        // Redirect to the test dashboard after successful login
        window.location.href = 'https://medoramd.ai/index.html';
    } else {
        console.error('Invalid email or password');
        if (errorMessage) {
            errorMessage.textContent = 'Invalid email or password';
            errorMessage.style.display = 'block';
            setLoadingState('login-btn', 'login-spinner', false);
        }
    }
}

// Sign out a user (for use in index.html and menu.js)
function logout() {
    console.log('User signed out');
    localStorage.removeItem('currentEmail');
    // Redirect to the test login page after sign-out
    window.location.href = 'https://medoramd.ai/login.html';
    // Reset any menu state if necessary
    const userMenu = document.getElementById('user-menu-container');
    if (userMenu) {
        userMenu.style.display = 'none';
    }
}

// Check authentication state (for use in index.html)
function checkAuthState() {
    const email = localStorage.getItem('currentEmail');
    if (email) {
        console.log('User is signed in:', email);
        return true;
    } else {
        console.log('No user signed in');
        // Redirect to the test login page if not authenticated
        window.location.href = 'https://medoramd.ai/login.html';
        return false;
    }
}

// Add loading state to buttons (for login.html)
function setLoadingState(buttonId, spinnerId, isLoading) {
    const button = document.getElementById(buttonId);
    const spinner = document.getElementById(spinnerId);
    if (button && spinner) {
        if (isLoading) {
            button.disabled = true;
            spinner.style.display = 'inline-block';
        } else {
            button.disabled = false;
            spinner.style.display = 'none';
        }
    }
}

// Expose functions to the global scope
window.signIn = signIn;
window.logout = logout;
window.checkAuthState = checkAuthState;
window.setLoadingState = setLoadingState;
