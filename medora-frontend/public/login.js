/**
 * login.js - Handles authentication
 */

document.addEventListener('DOMContentLoaded', function() {
    // Check if we have a login form
    const loginForm = document.getElementById('login-form');
    if (!loginForm) {
        console.warn('Login form not found on this page');
        return;
    }
    
    console.log('Login form found, setting up event handlers');
    
    // Add event listener to login form
    loginForm.addEventListener('submit', function(event) {
        event.preventDefault();
        
        const emailInput = document.getElementById('login-email');
        const passwordInput = document.getElementById('login-password');
        
        if (!emailInput || !passwordInput) {
            showLoginError('Login form inputs not found');
            return;
        }
        
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        
        if (!email || !password) {
            showLoginError('Please enter both email and password');
            return;
        }
        
        // Show loading state
        const loginButton = loginForm.querySelector('button[type="submit"]');
        if (loginButton) {
            loginButton.disabled = true;
            loginButton.innerText = 'Logging in...';
        }
        
        // In a real application, you would make an API call to authenticate
        // For this example, we'll simulate a successful login
        setTimeout(function() {
            // Special handling for doctor@allergyaffiliates.com account
            if (email.toLowerCase() === 'doctor@allergyaffiliates.com' && password === '18June2011!') {
                console.log('Using hardcoded doctor account with specific tenant ID');
                
                // Store specific values for this account
                localStorage.setItem('currentEmail', email);
                localStorage.setItem('currentTenantId', 'allergyaffiliates');
                localStorage.setItem('currentRole', 'doctor');
                localStorage.setItem('userSpecialty', 'allergist');
                
                // Redirect to dashboard
                setTimeout(() => {
                    window.location.href = 'https://medoramd.ai/index.html';
                }, 100);
                return;
            }
            
            // Regular account handling for other users
            // Create tenant ID from email (for better organization)
            const emailParts = email.split('@');
            let tenantId;
            
            if (emailParts.length > 1) {
                // Use the local part of the email for the tenant ID
                tenantId = 'medora_' + emailParts[0];
            } else {
                // Fallback tenant ID
                tenantId = 'medora_' + email.replace(/[^a-zA-Z0-9]/g, '_');
            }
            
            const userData = {
                email: email,
                tenantId: tenantId,
                role: 'doctor'
            };
            
            // Store user data in localStorage
            localStorage.setItem('currentEmail', userData.email);
            localStorage.setItem('currentTenantId', userData.tenantId);
            localStorage.setItem('currentRole', userData.role);
            
            console.log('User logged in successfully:', userData);
            
            // Redirect to dashboard
            setTimeout(() => {
                window.location.href = 'https://medoramd.ai/index.html';
            }, 100);
        }, 1000);
    });
    
    // Function to show login error
    function showLoginError(message) {
        const errorElement = document.getElementById('login-error');
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        } else {
            alert('Login Error: ' + message);
        }
        
        // Reset button state if needed
        const loginButton = loginForm.querySelector('button[type="submit"]');
        if (loginButton) {
            loginButton.disabled = false;
            loginButton.innerText = 'Log In';
        }
    }
});

// Check if user is already logged in
function checkIfUserIsLoggedIn() {
    try {
        // Check for required authentication data
        const storedEmail = localStorage.getItem('currentEmail');
        let storedTenantId = localStorage.getItem('currentTenantId');
        
        // Special case for doctor account
        if (storedEmail && storedEmail.toLowerCase() === 'doctor@allergyaffiliates.com') {
            console.log('Doctor account detected - ensuring correct tenant ID');
            // Always use the specific tenant ID for this account
            storedTenantId = 'allergyaffiliates';
            localStorage.setItem('currentTenantId', storedTenantId);
        }
        // If email is present but tenant ID is missing, create one from the email
        else if (storedEmail && !storedTenantId) {
            console.log('Email found but tenant ID missing, creating from email');
            const emailParts = storedEmail.split('@');
            
            if (emailParts.length > 1) {
                // Use the local part of the email for the tenant ID
                storedTenantId = 'medora_' + emailParts[0];
            } else {
                // Fallback tenant ID
                storedTenantId = 'medora_' + storedEmail.replace(/[^a-zA-Z0-9]/g, '_');
            }
            
            // Store the created tenant ID
            localStorage.setItem('currentTenantId', storedTenantId);
            console.log('Created tenant ID:', storedTenantId);
        }
        
        // Check if we now have both email and tenant ID
        if (storedEmail && storedTenantId) {
            console.log('User is already logged in with tenant ID:', storedTenantId);
            return true;
        }
        
        return false;
    } catch (e) {
        console.error('Error checking login state:', e);
        return false;
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    // Only redirect if we're already logged in and on the login page
    if (window.location.pathname.includes('login.html') && checkIfUserIsLoggedIn()) {
        console.log('Already logged in, redirecting to dashboard');
        window.location.href = 'https://medoramd.ai/index.html';
    }
});
