/**
 * menu.js - Dropdown menu component for Medora with status indicator
 */

// Activity timeout variables
const ACTIVE_TIMEOUT = 15 * 60 * 1000; // 15 minutes in milliseconds
const AWAY_TIMEOUT = 15 * 60 * 1000;   // Additional 15 minutes in milliseconds
let userActivityTimer;
let userStatus = 'active'; // 'active', 'away', or 'inactive'
let lastActivityTime = Date.now();

document.addEventListener('DOMContentLoaded', function() {
    // First, completely remove the logout button and replace it with our profile button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        // Get user email from localStorage for initials
        const userEmail = localStorage.getItem('currentEmail') || 'user@example.com';
        const initials = generateInitials(userEmail);
        
        // Create a new profile button to completely replace the logout button
        const profileBtn = document.createElement('button');
        profileBtn.id = 'profile-btn';
        profileBtn.className = 'profile-btn';
        
        // Add the status indicator within the button
        profileBtn.innerHTML = `
            <span class="provider-icon">${initials}</span>
            <div id="status-indicator" style="width: 10px; height: 10px; border-radius: 50%; background-color: #10b981; position: absolute; top: 0; right: 0; border: 2px solid white;" title="Active - Session will time out in 15:00 minutes"></div>
        `;
        
        // Add position relative for proper indicator positioning
        profileBtn.style.position = 'relative';
        
        // Replace the logout button with our new button
        if (logoutBtn.parentNode) {
            logoutBtn.parentNode.replaceChild(profileBtn, logoutBtn);
        }
        
        // Create the menu container element
        const menuContainer = document.createElement('div');
        menuContainer.id = 'user-menu-container';
        menuContainer.className = 'user-menu-container';
        menuContainer.style.display = 'none';
        
        // Add user info and status to the top of the menu
        const userInfoDiv = document.createElement('div');
        userInfoDiv.style.padding = '12px 16px';
        userInfoDiv.style.borderBottom = '1px solid #f0f2f5';
        
        // Get user specialty from localStorage
        const userSpecialty = localStorage.getItem('userSpecialty') || 'Doctor';
        
        // Create HTML for user info and status
        userInfoDiv.innerHTML = `
            <div style="display: flex; align-items: center; margin-bottom: 8px;">
                <div style="width: 36px; height: 36px; background-color: #3a5ba9; color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 600; margin-right: 12px;">
                    ${initials}
                </div>
                <div>
                    <div style="font-size: 14px; font-weight: 600; color: #1a3c5e;">${userEmail}</div>
                    <div style="font-size: 12px; color: #6b7280;">${userSpecialty}</div>
                </div>
            </div>
            <div id="user-status-display" style="display: flex; align-items: center; margin-top: 8px; padding: 6px 8px; border-radius: 4px; background-color: #f9fafb;">
                <div id="status-indicator-menu" style="width: 8px; height: 8px; border-radius: 50%; background-color: #10b981; margin-right: 8px;"></div>
                <div id="status-text" style="font-size: 12px; color: #4b5563;">Active</div>
                <div style="margin-left: auto; font-size: 12px; color: #6b7280;" id="status-timer">15:00</div>
            </div>
        `;
        
        // Add user info to menu container
        menuContainer.appendChild(userInfoDiv);
        
        // Create the menu list
        const menuList = document.createElement('ul');
        menuList.className = 'menu-list';
        
        // Define menu items
        const menuItems = [
            { icon: '👤', text: 'You', href: '#profile' },
            { icon: '⚙️', text: 'Settings', href: '#settings' },
            { icon: '🏛️', text: 'Subscription', href: '#subscription' },
            { icon: '👥', text: 'Invite Team', href: '#invite' },
            { icon: '💬', text: 'Talk to Sales', href: '#sales' },
            { icon: '❤️', text: 'Refer a Friend', href: '#refer' },
            { icon: '🔊', text: 'Become an Ambassador', href: '#ambassador' },
            { icon: '↪️', text: 'Logout', href: '#logout', class: 'logout-item' }
        ];
        
        // Create menu items
        menuItems.forEach(item => {
            const li = document.createElement('li');
            li.className = 'menu-item' + (item.class ? ` ${item.class}` : '');
            
            const a = document.createElement('a');
            a.href = item.href;
            
            const iconSpan = document.createElement('span');
            iconSpan.className = 'icon';
            iconSpan.textContent = item.icon;
            
            const textSpan = document.createElement('span');
            textSpan.className = 'text';
            textSpan.textContent = item.text;
            
            a.appendChild(iconSpan);
            a.appendChild(textSpan);
            li.appendChild(a);
            menuList.appendChild(li);
            
            // Add event listener to handle the action
            a.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                // Reset user activity timer when interacting with the menu
                resetUserActivityTimer();
                
                // Handle specific actions
                if (item.text === 'Logout') {
                    // Call the logout function defined in auth.js
                    if (typeof window.logout === 'function') {
                        window.logout();
                    } else {
                        console.error('Logout function not defined, redirecting to login page');
                        window.location.href = '/login.html';
                    }
                } else if (item.text === 'You') {
                    // Show profile modal if available, otherwise show alert
                    if (typeof window.showProfileModal === 'function') {
                        window.showProfileModal();
                    } else {
                        // Try to load the profile.js script
                        loadProfileScript(function() {
                            if (typeof window.showProfileModal === 'function') {
                                window.showProfileModal();
                            } else {
                                alert('Profile feature coming soon!');
                            }
                        });
                    }
                } else if (item.text === 'Settings') {
                    // Show settings modal if available, otherwise show alert
                    if (typeof window.showSettingsModal === 'function') {
                        window.showSettingsModal();
                    } else {
                        // Try to load the settings.js script
                        loadSettingsScript(function() {
                            if (typeof window.showSettingsModal === 'function') {
                                window.showSettingsModal();
                            } else {
                                alert('Settings feature coming soon!');
                            }
                        });
                    }
                } else {
                    console.log(`${item.text} clicked`);
                    // Add placeholder actions for now
                    switch(item.text) {
                        case 'Subscription':
                            alert('Subscription management feature coming soon!');
                            break;
                        case 'Invite Team':
                            alert('Team invitation feature coming soon!');
                            break;
                        case 'Talk to Sales':
                            window.open('mailto:sales@medora.com', '_blank');
                            break;
                        case 'Refer a Friend':
                            alert('Referral feature coming soon!');
                            break;
                        case 'Become an Ambassador':
                            alert('Ambassador program coming soon!');
                            break;
                        default:
                            console.log('No action defined for this menu item');
                    }
                }
                
                // Hide the menu after action (except for profile/settings to avoid double animation)
                if (item.text !== 'You' && item.text !== 'Settings') {
                    menuContainer.style.display = 'none';
                }
            });
        });
        
        // Add menu list to container
        menuContainer.appendChild(menuList);
        
        // Add container to document
        document.body.appendChild(menuContainer);
        
        // Add event listener to toggle menu
        profileBtn.addEventListener('click', function(e) {
            console.log('Profile button clicked');
            e.preventDefault();
            e.stopPropagation();
            
            // Reset user activity timer when interacting with the menu
            resetUserActivityTimer();
            
            // Toggle menu visibility
            if (menuContainer.style.display === 'none') {
                // Position the menu properly below the button
                const buttonRect = profileBtn.getBoundingClientRect();
                menuContainer.style.position = 'absolute';
                menuContainer.style.top = `${buttonRect.bottom + window.scrollY + 5}px`;
                menuContainer.style.right = `${window.innerWidth - buttonRect.right}px`;
                
                // Add subtle entrance animation
                menuContainer.style.opacity = '0';
                menuContainer.style.transform = 'translateY(-10px)';
                menuContainer.style.display = 'block';
                
                // Trigger animation
                setTimeout(() => {
                    menuContainer.style.opacity = '1';
                    menuContainer.style.transform = 'translateY(0)';
                }, 10);
            } else {
                // Add subtle exit animation
                menuContainer.style.opacity = '0';
                menuContainer.style.transform = 'translateY(-10px)';
                
                // Hide after animation completes
                setTimeout(() => {
                    menuContainer.style.display = 'none';
                }, 200);
            }
        });
        
        // Close menu when clicking outside
        document.addEventListener('click', function(e) {
            if (menuContainer.style.display === 'block' && !menuContainer.contains(e.target) && e.target !== profileBtn) {
                // Add subtle exit animation
                menuContainer.style.opacity = '0';
                menuContainer.style.transform = 'translateY(-10px)';
                
                // Hide after animation completes
                setTimeout(() => {
                    menuContainer.style.display = 'none';
                }, 200);
            }
        });
        
        // Initialize activity tracking
        initializeActivityTracking();
        
        // Start the status checking interval
        startStatusChecking();
        
        // Attempt to load the profile and settings scripts
        loadProfileScript();
        loadSettingsScript();
    } else {
        console.error('Logout button not found, cannot replace with profile button');
    }
});

// Load the profile.js script
function loadProfileScript(callback) {
    // Check if script is already loaded
    if (document.querySelector('script[src="profile.js"]')) {
        if (callback) callback();
        return;
    }
    
    // Create script element
    const script = document.createElement('script');
    script.src = 'profile.js';
    script.onload = function() {
        console.log('Profile script loaded successfully');
        if (callback) callback();
    };
    script.onerror = function() {
        console.error('Failed to load profile.js');
        if (callback) callback(new Error('Failed to load profile.js'));
    };
    
    // Append to head
    document.head.appendChild(script);
}

// Load the settings.js script
function loadSettingsScript(callback) {
    // Check if script is already loaded
    if (document.querySelector('script[src="settings.js"]')) {
        if (callback) callback();
        return;
    }
    
    // Create script element
    const script = document.createElement('script');
    script.src = 'settings.js';
    script.onload = function() {
        console.log('Settings script loaded successfully');
        if (callback) callback();
    };
    script.onerror = function() {
        console.error('Failed to load settings.js');
        if (callback) callback(new Error('Failed to load settings.js'));
    };
    
    // Append to head
    document.head.appendChild(script);
}

// Initialize activity tracking
function initializeActivityTracking() {
    // Reset the timer on any user activity
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    
    activityEvents.forEach(event => {
        document.addEventListener(event, resetUserActivityTimer);
    });
    
    // Set the initial timer
    resetUserActivityTimer();
}

// Reset the user activity timer
function resetUserActivityTimer() {
    // Clear any existing timer
    clearTimeout(userActivityTimer);
    
    // Update last activity time
    lastActivityTime = Date.now();
    
    // Set user as active if they were away
    if (userStatus !== 'active') {
        setUserStatus('active');
    }
    
    // Get session timeout from settings if available
    const sessionTimeoutMinutes = parseInt(localStorage.getItem('sessionTimeout') || '30', 10);
    const activeTimeout = (sessionTimeoutMinutes * 60 * 1000) / 2; // Half for active state
    
    // Set new timer for active to away transition
    userActivityTimer = setTimeout(() => {
        setUserStatus('away');
        
        // Set another timer for away to logout transition
        userActivityTimer = setTimeout(() => {
            setUserStatus('inactive');
            // Call the logout function after a brief delay
            setTimeout(() => {
                // Check if we should confirm before logout
                const confirmLogout = localStorage.getItem('confirmLogout') !== 'false'; // Default true
                
                if (confirmLogout && confirm('Your session is about to expire. Do you want to stay logged in?')) {
                    // User chose to stay logged in
                    resetUserActivityTimer();
                } else {
                    // Log out the user
                    if (typeof window.logout === 'function') {
                        window.logout();
                    } else {
                        console.error('Logout function not defined, redirecting to login page');
                        window.location.href = '/login.html';
                    }
                }
            }, 1000);
        }, activeTimeout); // Use same timeout for away state
    }, activeTimeout);
}

// Update the user status and UI
function setUserStatus(status) {
    userStatus = status;
    
    // Get status elements
    const statusIndicator = document.getElementById('status-indicator');
    const statusIndicatorMenu = document.getElementById('status-indicator-menu');
    const statusText = document.getElementById('status-text');
    
    // Update status colors and text
    switch (status) {
        case 'active':
            // Green for active
            if (statusIndicator) statusIndicator.style.backgroundColor = '#10b981';
            if (statusIndicatorMenu) statusIndicatorMenu.style.backgroundColor = '#10b981';
            if (statusText) statusText.textContent = 'Active';
            break;
        case 'away':
            // Yellow for away
            if (statusIndicator) statusIndicator.style.backgroundColor = '#f59e0b';
            if (statusIndicatorMenu) statusIndicatorMenu.style.backgroundColor = '#f59e0b';
            if (statusText) statusText.textContent = 'Away';
            break;
        case 'inactive':
            // Red for inactive (about to log out)
            if (statusIndicator) statusIndicator.style.backgroundColor = '#ef4444';
            if (statusIndicatorMenu) statusIndicatorMenu.style.backgroundColor = '#ef4444';
            if (statusText) statusText.textContent = 'Inactive';
            break;
    }
}

// Start the status checking interval
function startStatusChecking() {
    // Update the status timer every second
    setInterval(updateStatusTimer, 1000);
}

// Update the status timer display
function updateStatusTimer() {
    const statusTimer = document.getElementById('status-timer');
    if (!statusTimer) return;
    
    // Get session timeout from settings if available
    const sessionTimeoutMinutes = parseInt(localStorage.getItem('sessionTimeout') || '30', 10);
    const activeTimeout = (sessionTimeoutMinutes * 60 * 1000) / 2; // Half for active state
    
    let timeRemaining;
    
    if (userStatus === 'active') {
        // Calculate time until "away" status
        timeRemaining = activeTimeout - (Date.now() - lastActivityTime);
    } else if (userStatus === 'away') {
        // Calculate time until logout
        const awayTime = Date.now() - (lastActivityTime + activeTimeout);
        timeRemaining = activeTimeout - awayTime;
    } else {
        // Inactive status, about to logout
        timeRemaining = 0;
    }
    
    // Ensure timeRemaining is not negative
    timeRemaining = Math.max(0, timeRemaining);
    
    // Convert to minutes and seconds
    const minutes = Math.floor(timeRemaining / 60000);
    const seconds = Math.floor((timeRemaining % 60000) / 1000);
    
    // Update the timer display
    statusTimer.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    // Update tooltip on status indicator
    const statusIndicator = document.getElementById('status-indicator');
    if (statusIndicator) {
        if (userStatus === 'active') {
            statusIndicator.title = `Active - Status will change to Away in ${minutes}:${seconds.toString().padStart(2, '0')}`;
        } else if (userStatus === 'away') {
            statusIndicator.title = `Away - You will be logged out in ${minutes}:${seconds.toString().padStart(2, '0')}`;
        } else {
            statusIndicator.title = 'Inactive - Logging out...';
        }
    }
}

// Generate initials from email
function generateInitials(email) {
    if (!email) return 'U';
    
    // Extract name part before @
    const namePart = email.split('@')[0];
    
    // If it contains dots or underscores, treat as separators
    if (namePart.includes('.') || namePart.includes('_')) {
        const parts = namePart.split(/[._]/);
        return parts.map(part => part.charAt(0).toUpperCase()).join('').slice(0, 2);
    }
    
    // Otherwise just use the first 1-2 characters
    return namePart.charAt(0).toUpperCase() + (namePart.length > 1 ? namePart.charAt(1).toUpperCase() : '');
}
