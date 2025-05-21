/**
 * settings-controller.js - Applies settings to the Medora application
 */

(function() {
  // Apply settings when the document is ready
  document.addEventListener('DOMContentLoaded', function() {
    // Check if user is authenticated first
    checkAuthAndApplySettings();
  });

  // Check authentication and apply settings if authenticated
  function checkAuthAndApplySettings() {
    const email = localStorage.getItem('currentEmail');
    let tenantId = localStorage.getItem('currentTenantId');
    
    // Special case for doctor@allergyaffiliates.com account
    if (email && email.toLowerCase() === 'doctor@allergyaffiliates.com') {
      console.log('Doctor account detected in settings - ensuring correct tenant ID');
      tenantId = 'allergyaffiliates';
      localStorage.setItem('currentTenantId', tenantId);
    }
    
    if (email && tenantId) {
      console.log('User authenticated, applying settings...', { email, tenantId });
      applyAllSettings();
    } else if (email && !tenantId) {
      console.warn('User email found but tenant ID is missing - creating tenant ID from email');
      // Create tenant ID from email
      const emailParts = email.split('@');
      if (emailParts.length > 1) {
        const newTenantId = 'medora_' + emailParts[0];
        localStorage.setItem('currentTenantId', newTenantId);
        console.log('Created tenant ID from email:', newTenantId);
        applyAllSettings();
      } else {
        console.error('Invalid email format, cannot create tenant ID');
        // If we're not on the login page, we should redirect
        redirectToLoginIfNeeded();
      }
    } else {
      console.warn('User not fully authenticated. Email:', email, 'TenantId:', tenantId);
      // If we're not on the login page, we should redirect
      redirectToLoginIfNeeded();
    }
  }

  // Redirect to login page if not on login page
  function redirectToLoginIfNeeded() {
    if (!window.location.pathname.includes('login.html')) {
      console.log('Not on login page, will redirect shortly...');
      setTimeout(() => {
        window.location.href = 'https://medoramd.ai/login.html';
      }, 1000);
    }
  }

  // Apply all settings from localStorage
  function applyAllSettings() {
    // Apply all settings that should be immediately active
    applySessionTimeout();
    applyDefaultDashboardView();
    setupAutoSave();
    applyLanguageSettings();
    
    console.log('All settings applied successfully');
  }

  // Apply session timeout setting
  function applySessionTimeout() {
    // This setting is actually handled in menu.js when it reads from localStorage
    const sessionTimeout = localStorage.getItem('sessionTimeout') || '30';
    console.log(`Session timeout set to ${sessionTimeout} minutes`);
    
    // If we have a global variable for it, update that too
    if (window.ACTIVE_TIMEOUT !== undefined) {
      const timeoutMinutes = parseInt(sessionTimeout, 10);
      window.ACTIVE_TIMEOUT = (timeoutMinutes * 60 * 1000) / 2; // Half for active state
      window.AWAY_TIMEOUT = (timeoutMinutes * 60 * 1000) / 2; // Half for away state
      console.log(`Updated global timeout variables: ACTIVE_TIMEOUT=${window.ACTIVE_TIMEOUT}ms, AWAY_TIMEOUT=${window.AWAY_TIMEOUT}ms`);
    }
  }

  // Apply default dashboard view
  function applyDefaultDashboardView() {
    const defaultView = localStorage.getItem('defaultDashboard') || 'patients';
    console.log(`Default dashboard view set to: ${defaultView}`);
    
    // Implementation depends on dashboard structure
    // For now, just ensure the patient list is visible if that's the default
    if (defaultView === 'patients') {
      const patientSidebar = document.getElementById('patient-sidebar');
      if (patientSidebar) {
        patientSidebar.style.display = 'block';
      }
    }
    
    // Trigger fetchPatients if that's a function and we're in patients view
    if (defaultView === 'patients' && typeof window.fetchPatients === 'function') {
      // Make sure we have the required authentication data before fetching
      const email = localStorage.getItem('currentEmail');
      let tenantId = localStorage.getItem('currentTenantId');
      
      // Special case for doctor account
      if (email && email.toLowerCase() === 'doctor@allergyaffiliates.com') {
        console.log('Doctor account detected in defaultDashboardView - setting correct tenant ID');
        tenantId = 'allergyaffiliates';
        localStorage.setItem('currentTenantId', tenantId);
      }
      
      if (email && tenantId) {
        setTimeout(() => {
          console.log('Fetching patients with credentials:', { email, tenantId });
          window.fetchPatients();
        }, 1000); // Delay to ensure DOM is ready
      } else {
        console.warn('Not fetching patients - missing authentication data');
      }
    }
  }

  // Set up auto-save functionality
  function setupAutoSave() {
    // Clear any existing auto-save interval
    if (window.autoSaveInterval) {
      clearInterval(window.autoSaveInterval);
      window.autoSaveInterval = null;
    }

    const autoSave = localStorage.getItem('autoSave') === 'true';
    if (autoSave) {
      // Set up auto-save timer for notes
      window.autoSaveInterval = setInterval(function() {
        // Only auto-save if we have an active visit
        if (window.activeVisitId) {
          console.log('Auto-saving notes...');
          
          // Save current content from each SOAP section
          const sections = {
            subjective: document.getElementById('subjective-content'),
            objective: document.getElementById('objective-content'),
            assessment: document.getElementById('assessment-content'),
            plan: document.getElementById('plan-content-container')
          };
          
          // Create an auto-save record
          const autoSaveData = {};
          let hasContent = false;
          
          // Collect content from each section
          for (const [key, element] of Object.entries(sections)) {
            if (element && element.innerHTML.trim() !== '') {
              autoSaveData[key] = element.innerHTML;
              hasContent = true;
            }
          }
          
          // Only save if there's actual content
          if (hasContent) {
            const saveTimestamp = new Date().toISOString();
            
            // Store in localStorage (limited storage, so be careful with size)
            try {
              // Create a key using the visit ID and timestamp
              const saveKey = `autoSave_${window.activeVisitId}_${saveTimestamp}`;
              localStorage.setItem(saveKey, JSON.stringify(autoSaveData));
              
              // Keep only the last 5 auto-saves per visit
              const saveKeys = Object.keys(localStorage)
                .filter(key => key.startsWith(`autoSave_${window.activeVisitId}_`))
                .sort((a, b) => b.localeCompare(a)) // Sort by timestamp (newest first)
                .slice(5); // Keep anything beyond the first 5
              
              // Remove older saves
              saveKeys.forEach(key => localStorage.removeItem(key));
              
              console.log(`Auto-saved notes at ${saveTimestamp}`);
            } catch (error) {
              console.error('Error during auto-save:', error);
            }
          }
        }
      }, 30000); // Every 30 seconds
      
      console.log('Auto-save enabled with 30-second interval');
    } else {
      console.log('Auto-save disabled');
    }
  }

  // Apply language and regional settings
  function applyLanguageSettings() {
    const language = localStorage.getItem('language') || 'en';
    const timeFormat = localStorage.getItem('timeFormat') || '12h';
    const dateFormat = localStorage.getItem('dateFormat') || 'mdy';
    
    console.log(`Language settings applied: ${language}, ${timeFormat}, ${dateFormat}`);
    
    // Set global variables for formatting
    window.appLanguage = language;
    window.appTimeFormat = timeFormat;
    window.appDateFormat = dateFormat;
    
    // Update any displayed dates/times on the page
    updateDisplayedDates();
  }
  
  // Helper function to update displayed dates based on format preferences
  function updateDisplayedDates() {
    // Find elements with date-time data attributes
    const dateElements = document.querySelectorAll('[data-datetime]');
    
    dateElements.forEach(element => {
      const timestamp = element.getAttribute('data-datetime');
      if (timestamp) {
        try {
          const date = new Date(timestamp);
          element.textContent = formatDateTime(date);
        } catch (error) {
          console.error('Error formatting date:', error);
        }
      }
    });
  }
  
  // Format a date according to user preferences
  function formatDateTime(date) {
    if (!date) return '';
    
    const timeFormat = localStorage.getItem('timeFormat') || '12h';
    const dateFormat = localStorage.getItem('dateFormat') || 'mdy';
    
    let formattedDate = '';
    
    // Format date based on preference
    switch (dateFormat) {
      case 'mdy':
        formattedDate = `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
        break;
      case 'dmy':
        formattedDate = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
        break;
      case 'ymd':
        formattedDate = `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
        break;
      default:
        formattedDate = `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
    }
    
    // Format time based on preference
    let formattedTime = '';
    const hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    
    if (timeFormat === '12h') {
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const hours12 = hours % 12 || 12;
      formattedTime = `${hours12}:${minutes} ${ampm}`;
    } else {
      formattedTime = `${hours.toString().padStart(2, '0')}:${minutes}`;
    }
    
    return `${formattedDate} ${formattedTime}`;
  }
  
  // Expose functions to window for potential use in other scripts
  window.settingsController = {
    applyAllSettings,
    applySessionTimeout,
    applyDefaultDashboardView,
    setupAutoSave,
    applyLanguageSettings,
    formatDateTime,
    checkAuthAndApplySettings
  };
})();
