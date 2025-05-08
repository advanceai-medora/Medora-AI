/**
 * profile.js - User profile component for Medora
 */

// Create a profile modal when the document is ready
document.addEventListener('DOMContentLoaded', function() {
    // Create the profile modal
    createProfileModal();
});

// Create the profile modal in the DOM
function createProfileModal() {
    // Check if modal already exists
    if (document.getElementById('profile-modal')) {
        return; // Modal already exists
    }
    
    // Create the modal container
    const modalContainer = document.createElement('div');
    modalContainer.id = 'profile-modal';
    modalContainer.className = 'modal-container';
    modalContainer.style.display = 'none';
    modalContainer.style.position = 'fixed';
    modalContainer.style.top = '0';
    modalContainer.style.left = '0';
    modalContainer.style.width = '100%';
    modalContainer.style.height = '100%';
    modalContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    modalContainer.style.zIndex = '2000';
    modalContainer.style.opacity = '0';
    modalContainer.style.transition = 'opacity 0.3s ease';
    
    // Create the modal content
    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    modalContent.style.position = 'absolute';
    modalContent.style.top = '50%';
    modalContent.style.left = '50%';
    modalContent.style.transform = 'translate(-50%, -50%) scale(0.9)';
    modalContent.style.backgroundColor = '#fff';
    modalContent.style.padding = '0';
    modalContent.style.borderRadius = '8px';
    modalContent.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.15)';
    modalContent.style.width = '90%';
    modalContent.style.maxWidth = '600px';
    modalContent.style.maxHeight = '80vh';
    modalContent.style.overflow = 'hidden';
    modalContent.style.transition = 'transform 0.3s ease';
    
    // Add HTML content to the modal
    modalContent.innerHTML = `
        <div style="padding: 20px; border-bottom: 1px solid #e5e7eb; position: relative;">
            <button id="close-profile-btn" style="position: absolute; top: 20px; right: 20px; background: none; border: none; font-size: 18px; color: #6b7280; cursor: pointer;">×</button>
            <h2 style="margin: 0; font-size: 20px; color: #1a3c87; font-weight: 600;">Your Profile</h2>
        </div>
        <div id="profile-content" style="padding: 20px; overflow-y: auto; max-height: calc(80vh - 70px);">
            <div style="display: flex; align-items: center; margin-bottom: 20px;">
                <div id="profile-avatar" style="width: 80px; height: 80px; border-radius: 50%; background-color: #3a5ba9; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 30px; font-weight: 600; margin-right: 20px;"></div>
                <div>
                    <h3 id="profile-name" style="margin: 0 0 5px 0; font-size: 18px; color: #1a3c87;"></h3>
                    <p id="profile-email" style="margin: 0 0 5px 0; font-size: 14px; color: #4b5563;"></p>
                    <p id="profile-specialty" style="margin: 0; font-size: 14px; color: #4b5563;"></p>
                </div>
            </div>
            
            <div style="margin-bottom: 20px;">
                <h4 style="font-size: 16px; color: #1a3c87; margin-bottom: 10px;">Account Information</h4>
                <div style="background-color: #f9fafb; border-radius: 8px; padding: 15px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                        <span style="font-size: 14px; color: #6b7280;">Account Status:</span>
                        <span style="font-size: 14px; color: #10b981; font-weight: 500;">Active</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                        <span style="font-size: 14px; color: #6b7280;">Plan:</span>
                        <span style="font-size: 14px; color: #1a3c87; font-weight: 500;">Professional</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="font-size: 14px; color: #6b7280;">Member Since:</span>
                        <span id="profile-member-since" style="font-size: 14px; color: #1a3c87; font-weight: 500;">May 2025</span>
                    </div>
                </div>
            </div>
            
            <div style="margin-bottom: 20px;">
                <h4 style="font-size: 16px; color: #1a3c87; margin-bottom: 10px;">Personal Information</h4>
                <div style="background-color: #f9fafb; border-radius: 8px; padding: 15px;">
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; font-size: 12px; color: #6b7280; margin-bottom: 5px;">Full Name</label>
                        <input type="text" id="profile-input-name" style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid #e2e8f0; font-size: 14px;" placeholder="Enter your full name">
                    </div>
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; font-size: 12px; color: #6b7280; margin-bottom: 5px;">Email Address</label>
                        <input type="email" id="profile-input-email" style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid #e2e8f0; font-size: 14px;" disabled>
                    </div>
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; font-size: 12px; color: #6b7280; margin-bottom: 5px;">Specialty</label>
                        <select id="profile-input-specialty" style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid #e2e8f0; font-size: 14px;">
                            <option value="allergist">Allergist</option>
                            <option value="cardiologist">Cardiologist</option>
                            <option value="dermatologist">Dermatologist</option>
                            <option value="emergency">Emergency Medicine</option>
                            <option value="family">Family Medicine</option>
                            <option value="internal">Internal Medicine</option>
                            <option value="other">Other Specialty</option>
                        </select>
                    </div>
                    <div>
                        <label style="display: block; font-size: 12px; color: #6b7280; margin-bottom: 5px;">Bio</label>
                        <textarea id="profile-input-bio" style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid #e2e8f0; font-size: 14px; min-height: 80px;" placeholder="Tell us about yourself"></textarea>
                    </div>
                </div>
            </div>
            
            <div style="margin-bottom: 20px;">
                <h4 style="font-size: 16px; color: #1a3c87; margin-bottom: 10px;">Preferences</h4>
                <div style="background-color: #f9fafb; border-radius: 8px; padding: 15px;">
                    <div style="display: flex; align-items: center; margin-bottom: 10px;">
                        <input type="checkbox" id="profile-email-notifications" style="margin-right: 10px;">
                        <label for="profile-email-notifications" style="font-size: 14px; color: #1f2937;">Receive email notifications</label>
                    </div>
                    <div style="display: flex; align-items: center;">
                        <input type="checkbox" id="profile-session-save" style="margin-right: 10px;" checked>
                        <label for="profile-session-save" style="font-size: 14px; color: #1f2937;">Auto-save session progress</label>
                    </div>
                </div>
            </div>
            
            <div style="display: flex; justify-content: flex-end; margin-top: 20px;">
                <button id="profile-cancel-btn" style="padding: 8px 16px; border: 1px solid #d1d5db; background-color: #fff; color: #4b5563; border-radius: 6px; font-size: 14px; font-weight: 500; cursor: pointer; margin-right: 10px;">Cancel</button>
                <button id="profile-save-btn" style="padding: 8px 16px; border: none; background-color: #3a5ba9; color: #fff; border-radius: 6px; font-size: 14px; font-weight: 500; cursor: pointer;">Save Changes</button>
            </div>
        </div>
    `;
    
    // Append the modal content to the container
    modalContainer.appendChild(modalContent);
    
    // Append the modal to the document body
    document.body.appendChild(modalContainer);
    
    // Add event listener to close button
    const closeBtn = document.getElementById('close-profile-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeProfileModal);
    }
    
    // Add event listener to cancel button
    const cancelBtn = document.getElementById('profile-cancel-btn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', closeProfileModal);
    }
    
    // Add event listener to save button
    const saveBtn = document.getElementById('profile-save-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveProfileChanges);
    }
    
    // Close modal when clicking outside
    modalContainer.addEventListener('click', function(e) {
        if (e.target === modalContainer) {
            closeProfileModal();
        }
    });
}

// Show the profile modal with user data
function showProfileModal() {
    // Get user data from localStorage
    const email = localStorage.getItem('currentEmail') || 'user@example.com';
    const specialty = localStorage.getItem('userSpecialty') || 'Doctor';
    const name = localStorage.getItem('userName') || generateNameFromEmail(email);
    const bio = localStorage.getItem('userBio') || '';
    const memberSince = localStorage.getItem('userMemberSince') || getCurrentMonth();
    
    // Get the modal element
    const modal = document.getElementById('profile-modal');
    if (!modal) {
        createProfileModal();
        setTimeout(showProfileModal, 100); // Try again after modal is created
        return;
    }
    
    // Fill in user data
    const avatarEl = document.getElementById('profile-avatar');
    const nameEl = document.getElementById('profile-name');
    const emailEl = document.getElementById('profile-email');
    const specialtyEl = document.getElementById('profile-specialty');
    const memberSinceEl = document.getElementById('profile-member-since');
    
    // Set avatar initials
    if (avatarEl) avatarEl.textContent = generateInitials(email);
    
    // Set text content
    if (nameEl) nameEl.textContent = name;
    if (emailEl) emailEl.textContent = email;
    if (specialtyEl) specialtyEl.textContent = specialty;
    if (memberSinceEl) memberSinceEl.textContent = memberSince;
    
    // Fill in form fields
    const nameInput = document.getElementById('profile-input-name');
    const emailInput = document.getElementById('profile-input-email');
    const specialtyInput = document.getElementById('profile-input-specialty');
    const bioInput = document.getElementById('profile-input-bio');
    
    if (nameInput) nameInput.value = name;
    if (emailInput) emailInput.value = email;
    if (specialtyInput) specialtyInput.value = specialty.toLowerCase();
    if (bioInput) bioInput.value = bio;
    
    // Show the modal with animation
    modal.style.display = 'block';
    setTimeout(() => {
        modal.style.opacity = '1';
        const modalContent = modal.querySelector('.modal-content');
        if (modalContent) {
            modalContent.style.transform = 'translate(-50%, -50%) scale(1)';
        }
    }, 10);
}

// Close the profile modal
function closeProfileModal() {
    const modal = document.getElementById('profile-modal');
    if (!modal) return;
    
    // Hide with animation
    modal.style.opacity = '0';
    const modalContent = modal.querySelector('.modal-content');
    if (modalContent) {
        modalContent.style.transform = 'translate(-50%, -50%) scale(0.9)';
    }
    
    // Remove from DOM after animation
    setTimeout(() => {
        modal.style.display = 'none';
    }, 300);
}

// Save profile changes
function saveProfileChanges() {
    // Get form values
    const nameInput = document.getElementById('profile-input-name');
    const specialtyInput = document.getElementById('profile-input-specialty');
    const bioInput = document.getElementById('profile-input-bio');
    const emailNotifications = document.getElementById('profile-email-notifications');
    const sessionSave = document.getElementById('profile-session-save');
    
    // Save to localStorage
    if (nameInput && nameInput.value) localStorage.setItem('userName', nameInput.value);
    if (specialtyInput && specialtyInput.value) localStorage.setItem('userSpecialty', capitalizeFirstLetter(specialtyInput.value));
    if (bioInput) localStorage.setItem('userBio', bioInput.value);
    if (emailNotifications) localStorage.setItem('userEmailNotifications', emailNotifications.checked);
    if (sessionSave) localStorage.setItem('userSessionSave', sessionSave.checked);
    
    // Update display elements
    const nameEl = document.getElementById('profile-name');
    const specialtyEl = document.getElementById('profile-specialty');
    
    if (nameEl && nameInput) nameEl.textContent = nameInput.value;
    if (specialtyEl && specialtyInput) specialtyEl.textContent = capitalizeFirstLetter(specialtyInput.value);
    
    // Show success message
    showProfileSuccessMessage();
    
    // Close modal after delay
    setTimeout(closeProfileModal, 1500);
}

// Show success message
function showProfileSuccessMessage() {
    // Check if message already exists
    if (document.getElementById('profile-success-message')) return;
    
    // Create success message
    const message = document.createElement('div');
    message.id = 'profile-success-message';
    message.style.position = 'fixed';
    message.style.bottom = '20px';
    message.style.right = '20px';
    message.style.backgroundColor = '#10b981';
    message.style.color = '#fff';
    message.style.padding = '12px 20px';
    message.style.borderRadius = '6px';
    message.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.2)';
    message.style.zIndex = '2500';
    message.style.opacity = '0';
    message.style.transform = 'translateY(20px)';
    message.style.transition = 'opacity 0.3s, transform 0.3s';
    message.innerHTML = `
        <div style="display: flex; align-items: center;">
            <span style="font-size: 16px; margin-right: 10px;">✓</span>
            <span style="font-size: 14px;">Profile updated successfully!</span>
        </div>
    `;
    
    // Add to DOM
    document.body.appendChild(message);
    
    // Show with animation
    setTimeout(() => {
        message.style.opacity = '1';
        message.style.transform = 'translateY(0)';
    }, 10);
    
    // Remove after delay
    setTimeout(() => {
        message.style.opacity = '0';
        message.style.transform = 'translateY(20px)';
        setTimeout(() => {
            if (message.parentNode) {
                message.parentNode.removeChild(message);
            }
        }, 300);
    }, 3000);
}

// Helper functions

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

// Generate a name from email
function generateNameFromEmail(email) {
    if (!email) return 'User';
    
    // Extract name part before @
    const namePart = email.split('@')[0];
    
    // Replace dots and underscores with spaces
    const nameWithSpaces = namePart.replace(/[._]/g, ' ');
    
    // Capitalize each word
    return nameWithSpaces.split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

// Get current month and year
function getCurrentMonth() {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const date = new Date();
    return `${months[date.getMonth()]} ${date.getFullYear()}`;
}

// Capitalize first letter
function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

// Export function to show profile modal
window.showProfileModal = showProfileModal;
