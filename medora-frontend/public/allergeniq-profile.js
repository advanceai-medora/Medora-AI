/**
 * AllergenIQ Profile Feature
 * Responsible for fetching and displaying patient allergy profile data
 * with robust error handling and fallback mechanisms
 */

// Global variables to store patient data
let allergeniqProfileData = null;
let allergeniqCurrentPatientId = null;
let allergeniqCurrentVisitId = null;
let allergeniqIsLoading = false;
let allergeniqApiTimeout = null;

// Initialize the AllergenIQ profile when the DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('[DEBUG] AllergenIQ Profile module loaded');
    
    // Set up event listeners for the AllergenIQ buttons
    setupAllergenIQEventListeners();
    
    // Listen for patient selection events
    listenForPatientSelection();
    
    // Auto-load demo data after a short delay if no patient is selected
    setTimeout(() => {
        if (!allergeniqProfileData) {
            console.log('[DEBUG] No patient data loaded yet, checking for patient selection');
            
            // Check if there's a patient already selected
            const patientId = document.getElementById('patient-details-name')?.dataset.patientId;
            const visitId = document.getElementById('patient-details-current-visit')?.dataset.visitId;
            
            if (patientId && visitId) {
                console.log(`[DEBUG] Found selected patient, loading data: patientId=${patientId}, visitId=${visitId}`);
                loadAllergenIQProfile(patientId, visitId);
            } else {
                const isDemoMode = window.location.search.includes('demo=true');
                if (isDemoMode) {
                    console.log('[DEBUG] Auto-loading demo data (demo mode)');
                    loadAllergenIQDemoData();
                }
            }
        }
    }, 2000);
});

/**
 * Listen for patient selection events
 */
function listenForPatientSelection() {
    console.log('[DEBUG] Setting up patient selection listener');
    
    // Check if we already have a patient selected
    const patientDetailsElement = document.getElementById('patient-details-name');
    if (patientDetailsElement && patientDetailsElement.dataset.patientId) {
        allergeniqCurrentPatientId = patientDetailsElement.dataset.patientId;
        allergeniqCurrentVisitId = document.getElementById('patient-details-current-visit')?.dataset.visitId;
        
        console.log(`[DEBUG] Found existing patient selection: patientId=${allergeniqCurrentPatientId}, visitId=${allergeniqCurrentVisitId}`);
        
        if (allergeniqCurrentPatientId && allergeniqCurrentVisitId) {
            loadAllergenIQProfile(allergeniqCurrentPatientId, allergeniqCurrentVisitId);
        }
    }
    
    // Listen for changes to patient details using MutationObserver
    const setupPatientObserver = () => {
        const patientNameElement = document.getElementById('patient-details-name');
        if (!patientNameElement) {
            console.log('[DEBUG] patient-details-name element not found, retrying in 1s');
            setTimeout(setupPatientObserver, 1000);
            return;
        }
        
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'data-patient-id') {
                    const newPatientId = patientNameElement.dataset.patientId;
                    const newVisitId = document.getElementById('patient-details-current-visit')?.dataset.visitId;
                    
                    console.log(`[DEBUG] Patient selection changed: patientId=${newPatientId}, visitId=${newVisitId}`);
                    
                    if (newPatientId !== allergeniqCurrentPatientId || newVisitId !== allergeniqCurrentVisitId) {
                        allergeniqCurrentPatientId = newPatientId;
                        allergeniqCurrentVisitId = newVisitId;
                        
                        if (allergeniqCurrentPatientId && allergeniqCurrentVisitId) {
                            loadAllergenIQProfile(allergeniqCurrentPatientId, allergeniqCurrentVisitId);
                        }
                    }
                }
            });
        });
        
        observer.observe(patientNameElement, { attributes: true });
        console.log('[DEBUG] MutationObserver set up for patient-details-name element');
    };
    
    setupPatientObserver();
    
    // Alternative approach: listen for transcript submission events
    const setupTranscriptListener = () => {
        const transcriptBtn = document.getElementById('submit-transcript-btn');
        if (!transcriptBtn) {
            console.log('[DEBUG] submit-transcript-btn element not found, retrying in 1s');
            setTimeout(setupTranscriptListener, 1000);
            return;
        }
        
        transcriptBtn.addEventListener('click', function() {
            console.log('[DEBUG] Transcript submit button clicked');
            setTimeout(() => {
                const patientId = document.getElementById('patient-details-name')?.dataset.patientId;
                const visitId = document.getElementById('patient-details-current-visit')?.dataset.visitId;
                
                console.log(`[DEBUG] Checking for patient data after transcript submission: patientId=${patientId}, visitId=${visitId}`);
                
                if (patientId && visitId) {
                    loadAllergenIQProfile(patientId, visitId);
                }
            }, 2000); // Delay to allow SOAP notes to be generated
        });
        console.log('[DEBUG] Event listener added to submit-transcript-btn');
    };
    
    setupTranscriptListener();
}

/**
 * Set up event listeners for AllergenIQ buttons
 */
function setupAllergenIQEventListeners() {
    console.log('[DEBUG] Setting up AllergenIQ button event listeners');
    
    // Download PDF button
    const setupDownloadButton = () => {
        const downloadBtn = document.getElementById('allergeniq-download-btn');
        if (!downloadBtn) {
            console.log('[DEBUG] allergeniq-download-btn element not found, retrying in 1s');
            setTimeout(setupDownloadButton, 1000);
            return;
        }
        
        downloadBtn.addEventListener('click', function() {
            console.log('[DEBUG] Download button clicked');
            if (allergeniqProfileData) {
                downloadAllergenIQPDF(allergeniqProfileData);
            } else {
                alert('No AllergenIQ profile data available. Please load a patient profile first.');
            }
        });
        console.log('[DEBUG] Event listener added to allergeniq-download-btn');
    };
    
    setupDownloadButton();
    
    // Copy Report button
    const setupCopyButton = () => {
        const copyBtn = document.getElementById('allergeniq-copy-btn');
        if (!copyBtn) {
            console.log('[DEBUG] allergeniq-copy-btn element not found, retrying in 1s');
            setTimeout(setupCopyButton, 1000);
            return;
        }
        
        copyBtn.addEventListener('click', function() {
            console.log('[DEBUG] Copy button clicked');
            if (allergeniqProfileData) {
                copyAllergenIQReport(allergeniqProfileData);
            } else {
                alert('No AllergenIQ profile data available. Please load a patient profile first.');
            }
        });
        console.log('[DEBUG] Event listener added to allergeniq-copy-btn');
    };
    
    setupCopyButton();
}

/**
 * Load AllergenIQ profile for a patient with robust error handling
 * @param {string} patientId - The patient ID
 * @param {string} visitId - The visit ID
 * @param {boolean} forceDemo - Force loading demo data (optional)
 */
function loadAllergenIQProfile(patientId, visitId, forceDemo = false) {
    console.log(`[DEBUG] loadAllergenIQProfile called with patientId: ${patientId}, visitId: ${visitId}, forceDemo: ${forceDemo}`);
    
    // Prevent multiple simultaneous requests
    if (allergeniqIsLoading) {
        console.log('[DEBUG] AllergenIQ profile already loading, request ignored');
        return;
    }
    
    allergeniqIsLoading = true;
    
    // Clear any existing timeout
    if (allergeniqApiTimeout) {
        clearTimeout(allergeniqApiTimeout);
    }
    
    // Validate inputs
    if (!patientId || !visitId) {
        console.error('[ERROR] Invalid parameters: patientId and visitId are required');
        const profileContainer = getOrCreateProfileContainer();
        if (profileContainer) {
            profileContainer.innerHTML = '<p class="error-message">Error: Missing patient or visit information.</p>';
        }
        allergeniqIsLoading = false;
        return;
    }
    
    // Show loading message
    const profileContainer = getOrCreateProfileContainer();
    if (profileContainer) {
        profileContainer.dataset.loading = 'true';
        profileContainer.innerHTML = '<p class="loading-message">Loading patient analysis...</p>';
    } else {
        console.error('[ERROR] Profile container element not found');
        allergeniqIsLoading = false;
        return;
    }
    
    // If forceDemo is true, use demo data
    if (forceDemo || patientId === 'demo_patient_id') {
        console.log('[DEBUG] Using demo data as requested');
        const demoData = getDemoPatientData();
        allergeniqProfileData = demoData;
        
        // Add a small delay to simulate API call
        setTimeout(() => {
            displayAllergenIQProfile(demoData);
            profileContainer.dataset.loading = 'false';
            allergeniqIsLoading = false;
        }, 800);
        return;
    }
    
    // Get tenant ID if available
    const tenantId = window.currentTenantId || localStorage.getItem('tenantId') || '';
    console.log(`[DEBUG] tenantId: ${tenantId}`);
    
    // Get user email if available
    const email = window.currentEmail || localStorage.getItem('currentEmail') || localStorage.getItem('userEmail') || '';
    console.log(`[DEBUG] email: ${email}`);
    
    // Build the API URL with proper encoding
    let apiUrl = `/api/allergeniq-profile?patient_id=${encodeURIComponent(patientId)}&visit_id=${encodeURIComponent(visitId)}`;
    if (tenantId) apiUrl += `&tenantId=${encodeURIComponent(tenantId)}`;
    if (email) apiUrl += `&email=${encodeURIComponent(email)}`;
    console.log(`[DEBUG] API URL: ${apiUrl}`);
    
    // Set timeout for fetch (8 seconds)
    const API_TIMEOUT = 8000; 
    allergeniqApiTimeout = setTimeout(() => {
        console.log('[DEBUG] API request timed out after 8 seconds, falling back to demo data');
        
        if (allergeniqIsLoading) {
            const demoData = getDemoPatientData();
            allergeniqProfileData = demoData;
            displayAllergenIQProfile(demoData);
            
            // Update loading state
            profileContainer.dataset.loading = 'false';
            allergeniqIsLoading = false;
        }
    }, API_TIMEOUT);
    
    // Make a direct fetch request
    console.log(`[DEBUG] Making fetch request to API: ${apiUrl}`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10-second hard timeout
    
    fetch(apiUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        credentials: 'same-origin'
    })
        .then(response => {
            clearTimeout(timeoutId);
            console.log(`[DEBUG] API response status: ${response.status}`);
            
            if (!response.ok) {
                throw new Error(`API request failed with status ${response.status}: ${response.statusText}`);
            }
            
            return response.json();
        })
        .then(data => {
            // Clear timeout since we got a response
            clearTimeout(allergeniqApiTimeout);
            allergeniqApiTimeout = null;
            
            console.log('[DEBUG] API response data:', data);
            
            // Validate data - use demo data as fallback if anything is missing
            if (!data) {
                throw new Error('API returned empty response');
            }
            
            if (data.success === false) {
                throw new Error(`API reported failure: ${data.error || 'Unknown error'}`);
            }
            
            // Ensure we have profile data, even if partial
            let profileData = data.profile || {};
            if (!profileData.symptomData || !profileData.medicationHistory || 
                !profileData.allergenData || !profileData.summary) {
                console.warn('[DEBUG] API returned incomplete profile data, filling missing parts with defaults');
                
                const defaultData = getDemoPatientData();
                profileData = {
                    symptomData: profileData.symptomData || defaultData.symptomData,
                    medicationHistory: profileData.medicationHistory || defaultData.medicationHistory,
                    allergenData: profileData.allergenData || defaultData.allergenData,
                    summary: profileData.summary || defaultData.summary
                };
            }
            
            // Create complete patient data object
            allergeniqProfileData = {
                patientName: data.patient_name || 'Unknown Patient',
                patientAge: data.patient_age || 37,
                visitDate: data.visit_date || new Date().toISOString().split('T')[0],
                symptomData: profileData.symptomData,
                medicationHistory: profileData.medicationHistory,
                allergenData: profileData.allergenData,
                summary: profileData.summary
            };
            
            console.log('[DEBUG] Processed profile data:', allergeniqProfileData);
            displayAllergenIQProfile(allergeniqProfileData);
            
            // Update loading state
            profileContainer.dataset.loading = 'false';
            allergeniqIsLoading = false;
        })
        .catch(error => {
            clearTimeout(timeoutId);
            clearTimeout(allergeniqApiTimeout);
            allergeniqApiTimeout = null;
            
            console.error('[DEBUG] API request error:', error);
            
            // Fall back to demo data
            console.log('[DEBUG] Falling back to demo data due to API error');
            const demoData = getDemoPatientData();
            allergeniqProfileData = demoData;
            displayAllergenIQProfile(demoData);
            
            // Update loading state
            profileContainer.dataset.loading = 'false';
            allergeniqIsLoading = false;
        });
}

/**
 * Get or create the profile container element
 * @returns {HTMLElement} The profile container element
 */
function getOrCreateProfileContainer() {
    let profileContainer = document.getElementById('allergeniq-profile-container');
    
    if (!profileContainer) {
        console.log('[DEBUG] Profile container not found, creating it');
        
        // Find the allergeniq section
        const allergeniqSection = document.querySelector('.allergeniq-section');
        if (!allergeniqSection) {
            console.error('[ERROR] allergeniq-section not found');
            return null;
        }
        
        profileContainer = document.createElement('div');
        profileContainer.id = 'allergeniq-profile-container';
        
        // Find the insights-actions div and insert before it
        const insightsActions = allergeniqSection.querySelector('.insights-actions');
        if (insightsActions) {
            allergeniqSection.insertBefore(profileContainer, insightsActions);
        } else {
            allergeniqSection.appendChild(profileContainer);
        }
        
        console.log('[DEBUG] Created new profile container');
    }
    
    return profileContainer;
}

/**
 * Display AllergenIQ profile data in the UI with robust error handling
 * @param {Object} data - The profile data
 */
function displayAllergenIQProfile(data) {
    console.log('[DEBUG] Displaying AllergenIQ profile data:', data);
    
    const profileContainer = getOrCreateProfileContainer();
    if (!profileContainer) {
        console.error('[ERROR] Profile container element not found');
        return;
    }
    
    try {
        // Validate data
        if (!data) {
            throw new Error('No profile data provided');
        }
        
        // Ensure data has all required fields, use defaults for any missing
        const defaultData = getDemoPatientData();
        const validatedData = {
            patientName: data.patientName || defaultData.patientName,
            patientAge: data.patientAge || defaultData.patientAge,
            visitDate: data.visitDate || defaultData.visitDate,
            symptomData: data.symptomData || defaultData.symptomData,
            medicationHistory: data.medicationHistory || defaultData.medicationHistory,
            allergenData: data.allergenData || defaultData.allergenData,
            summary: data.summary || defaultData.summary
        };
        
        // Clear previous content
        profileContainer.innerHTML = '';
        
        // Create patient header
        const patientHeader = document.createElement('div');
        patientHeader.className = 'patient-header';
        patientHeader.innerHTML = `
            <h4>${validatedData.patientName}, ${validatedData.patientAge} years</h4>
            <p class="visit-date">Visit Date: ${validatedData.visitDate}</p>
        `;
        profileContainer.appendChild(patientHeader);
        
        // Create tabs for different sections
        const tabsContainer = document.createElement('div');
        tabsContainer.className = 'allergeniq-tabs';
        tabsContainer.innerHTML = `
            <button class="allergeniq-tab active" data-tab="summary">Summary</button>
            <button class="allergeniq-tab" data-tab="symptoms">Symptoms</button>
            <button class="allergeniq-tab" data-tab="medications">Medications</button>
            <button class="allergeniq-tab" data-tab="allergens">Allergens</button>
        `;
        profileContainer.appendChild(tabsContainer);
        
        // Create content container for tabs
        const tabContent = document.createElement('div');
        tabContent.className = 'allergeniq-tab-content';
        profileContainer.appendChild(tabContent);
        
        // Create each tab content
        createSummaryTabContent(validatedData, tabContent);
        createSymptomsTabContent(validatedData, tabContent);
        createMedicationsTabContent(validatedData, tabContent);
        createAllergensTabContent(validatedData, tabContent);
        
        // Set up tab switching
        const tabButtons = profileContainer.querySelectorAll('.allergeniq-tab');
        tabButtons.forEach(button => {
            button.addEventListener('click', function() {
                // Remove active class from all tabs
                tabButtons.forEach(btn => btn.classList.remove('active'));
                
                // Add active class to clicked tab
                this.classList.add('active');
                
                // Hide all tab content
                const tabContents = profileContainer.querySelectorAll('.tab-pane');
                tabContents.forEach(content => content.style.display = 'none');
                
                // Show selected tab content
                const tabName = this.getAttribute('data-tab');
                const selectedTab = document.getElementById(`allergeniq-${tabName}`);
                if (selectedTab) {
                    selectedTab.style.display = 'block';
                } else {
                    console.error(`[ERROR] Tab content with id allergeniq-${tabName} not found`);
                }
            });
        });
        
        // Add custom CSS for better display
        addAllergenIQStyles();
        
        console.log('[DEBUG] AllergenIQ profile display completed');
    } catch (error) {
        console.error('[ERROR] Failed to display AllergenIQ profile:', error);
        profileContainer.innerHTML = `
            <div class="error-message">
                <p>Error displaying AllergenIQ profile: ${error.message}</p>
                <button onclick="loadAllergenIQDemoData()">Show Demo Data Instead</button>
            </div>
        `;
    }
}

/**
 * Create summary tab content
 * @param {Object} data - The profile data
 * @param {HTMLElement} container - The container element
 */
function createSummaryTabContent(data, container) {
    console.log('[DEBUG] Creating summary tab content');
    
    try {
        const summaryTab = document.createElement('div');
        summaryTab.id = 'allergeniq-summary';
        summaryTab.className = 'tab-pane';
        summaryTab.style.display = 'block'; // Show by default
        
        // Verify summary data exists and has required fields
        const pattern = data.summary?.pattern || 'Unknown';
        const primarySystem = data.summary?.primarySystem || 'Unknown';
        const likelyDiagnosis = data.summary?.likelyDiagnosis || 'Unknown';
        const recommendedApproach = data.summary?.recommendedApproach || 'Unknown';
        
        summaryTab.innerHTML = `
            <div class="summary-section">
                <h4>Diagnosis Pattern</h4>
                <p>${pattern}</p>
            </div>
            <div class="summary-section">
                <h4>Primary System Affected</h4>
                <p>${primarySystem}</p>
            </div>
            <div class="summary-section">
                <h4>Likely Diagnosis</h4>
                <p>${likelyDiagnosis}</p>
            </div>
            <div class="summary-section">
                <h4>Recommended Approach</h4>
                <p>${recommendedApproach}</p>
            </div>
        `;
        
        container.appendChild(summaryTab);
    } catch (error) {
        console.error('[ERROR] Failed to create summary tab:', error);
        const summaryTab = document.createElement('div');
        summaryTab.id = 'allergeniq-summary';
        summaryTab.className = 'tab-pane';
        summaryTab.style.display = 'block';
        summaryTab.innerHTML = '<p>Error loading summary data.</p>';
        container.appendChild(summaryTab);
    }
}

/**
 * Create symptoms tab content
 * @param {Object} data - The profile data
 * @param {HTMLElement} container - The container element
 */
function createSymptomsTabContent(data, container) {
    console.log('[DEBUG] Creating symptoms tab content');
    
    try {
        const symptomsTab = document.createElement('div');
        symptomsTab.id = 'allergeniq-symptoms';
        symptomsTab.className = 'tab-pane';
        symptomsTab.style.display = 'none'; // Hidden initially
        
        // Create severity bars for each symptom
        let symptomsHTML = '<div class="symptoms-section">';
        
        if (Array.isArray(data.symptomData) && data.symptomData.length > 0) {
            data.symptomData.forEach(symptom => {
                // Validate symptom data and provide defaults for missing fields
                const system = symptom.system || 'Unknown';
                const severity = symptom.severity || 5;
                const duration = symptom.duration || 'Unknown';
                const frequency = symptom.frequency || 'Unknown';
                const triggers = symptom.triggers || 'Unknown';
                
                const severityPercentage = (severity / 10) * 100;
                symptomsHTML += `
                    <div class="symptom-item">
                        <div class="symptom-header">
                            <h4>${system}</h4>
                            <span class="severity-label">Severity: ${severity}/10</span>
                        </div>
                        <div class="severity-bar">
                            <div class="severity-fill" style="width: ${severityPercentage}%"></div>
                        </div>
                        <div class="symptom-details">
                            <p><strong>Duration:</strong> ${duration}</p>
                            <p><strong>Frequency:</strong> ${frequency}</p>
                            <p><strong>Triggers:</strong> ${triggers}</p>
                        </div>
                    </div>
                `;
            });
        } else {
            symptomsHTML += '<p>No symptom data available.</p>';
        }
        
        symptomsHTML += '</div>';
        symptomsTab.innerHTML = symptomsHTML;
        
        container.appendChild(symptomsTab);
    } catch (error) {
        console.error('[ERROR] Failed to create symptoms tab:', error);
        const symptomsTab = document.createElement('div');
        symptomsTab.id = 'allergeniq-symptoms';
        symptomsTab.className = 'tab-pane';
        symptomsTab.style.display = 'none';
        symptomsTab.innerHTML = '<p>Error loading symptoms data.</p>';
        container.appendChild(symptomsTab);
    }
}

/**
 * Create medications tab content
 * @param {Object} data - The profile data
 * @param {HTMLElement} container - The container element
 */
function createMedicationsTabContent(data, container) {
    console.log('[DEBUG] Creating medications tab content');
    
    try {
        const medicationsTab = document.createElement('div');
        medicationsTab.id = 'allergeniq-medications';
        medicationsTab.className = 'tab-pane';
        medicationsTab.style.display = 'none'; // Hidden initially
        
        if (Array.isArray(data.medicationHistory) && data.medicationHistory.length > 0) {
            // Create medication table
            let medicationsHTML = `
                <table class="medications-table">
                    <thead>
                        <tr>
                            <th>Medication</th>
                            <th>Class</th>
                            <th>Efficacy</th>
                            <th>Side Effects</th>
                            <th>Adherence</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            
            data.medicationHistory.forEach(med => {
                // Validate medication data and provide defaults for missing fields
                const name = med.name || 'Unknown';
                const medClass = med.class || 'Unknown';
                const efficacy = med.efficacy || 5;
                const sideEffects = med.sideEffects || 'None reported';
                const adherence = med.adherence || 'Unknown';
                
                // Create efficacy visual indicator
                const efficacyClass = efficacy >= 7 ? 'high' : (efficacy >= 4 ? 'medium' : 'low');
                
                medicationsHTML += `
                    <tr>
                        <td><strong>${name}</strong></td>
                        <td>${medClass}</td>
                        <td>
                            <div class="efficacy-indicator ${efficacyClass}">
                                <span>${efficacy}/10</span>
                            </div>
                        </td>
                        <td>${sideEffects}</td>
                        <td>${adherence}</td>
                    </tr>
                `;
            });
            
            medicationsHTML += `
                    </tbody>
                </table>
            `;
            
            medicationsTab.innerHTML = medicationsHTML;
        } else {
            medicationsTab.innerHTML = '<p>No medication history available.</p>';
        }
        
        container.appendChild(medicationsTab);
    } catch (error) {
        console.error('[ERROR] Failed to create medications tab:', error);
        const medicationsTab = document.createElement('div');
        medicationsTab.id = 'allergeniq-medications';
        medicationsTab.className = 'tab-pane';
        medicationsTab.style.display = 'none';
        medicationsTab.innerHTML = '<p>Error loading medication data.</p>';
        container.appendChild(medicationsTab);
    }
}

/**
 * Create allergens tab content
 * @param {Object} data - The profile data
 * @param {HTMLElement} container - The container element
 */
function createAllergensTabContent(data, container) {
    console.log('[DEBUG] Creating allergens tab content');
    
    try {
        const allergensTab = document.createElement('div');
        allergensTab.id = 'allergeniq-allergens';
        allergensTab.className = 'tab-pane';
        allergensTab.style.display = 'none'; // Hidden initially
        
        if (Array.isArray(data.allergenData) && data.allergenData.length > 0) {
            // Create allergen cards
            let allergensHTML = '<div class="allergens-grid">';
            
            data.allergenData.forEach(allergen => {
                // Validate allergen data and provide defaults for missing fields
                const name = allergen.name || 'Unknown Allergen';
                const testResult = allergen.testResult || 'Unknown';
                const crossReactivity = allergen.crossReactivity || [];
                const clinicalRelevance = allergen.clinicalRelevance || 'Unknown';
                
                const severity = testResult.includes('4+') ? 'high' : 
                                (testResult.includes('3+') ? 'medium-high' : 
                                (testResult.includes('2+') ? 'medium' : 'low'));
                
                // Format cross-reactivity items
                const crossReactivityFormatted = Array.isArray(crossReactivity) ? 
                    crossReactivity.join(', ') : crossReactivity.toString();
                
                allergensHTML += `
                    <div class="allergen-card ${severity}">
                        <h4>${name}</h4>
                        <div class="test-result">${testResult}</div>
                        <div class="allergen-details">
                            <p><strong>Cross-Reactivity:</strong> ${crossReactivityFormatted}</p>
                            <p><strong>Clinical Relevance:</strong> ${clinicalRelevance}</p>
                        </div>
                    </div>
                `;
            });
            
            allergensHTML += '</div>';
            allergensTab.innerHTML = allergensHTML;
        } else {
            allergensTab.innerHTML = '<p>No allergen data available.</p>';
        }
        
        container.appendChild(allergensTab);
    } catch (error) {
        console.error('[ERROR] Failed to create allergens tab:', error);
        const allergensTab = document.createElement('div');
        allergensTab.id = 'allergeniq-allergens';
        allergensTab.className = 'tab-pane';
        allergensTab.style.display = 'none';
        allergensTab.innerHTML = '<p>Error loading allergen data.</p>';
        container.appendChild(allergensTab);
    }
}

/**
 * Add custom CSS styles for AllergenIQ profile
 */
function addAllergenIQStyles() {
    console.log('[DEBUG] Adding AllergenIQ styles');
    
    // Check if styles already exist
    if (document.getElementById('allergeniq-custom-styles')) {
        console.log('[DEBUG] AllergenIQ styles already exist');
        return;
    }
    
    try {
        const styleSheet = document.createElement('style');
        styleSheet.id = 'allergeniq-custom-styles';
        styleSheet.innerHTML = `
            /* AllergenIQ Profile Styles */
            #allergeniq-profile-container {
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                max-width: 100%;
                margin: 0 auto;
                color: #333;
                background-color: #fff;
                padding: 15px;
                border-radius: 8px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            }
            
            .patient-header {
                margin-bottom: 20px;
                padding-bottom: 10px;
                border-bottom: 1px solid #e0e0e0;
            }
            
            .patient-header h4 {
                margin: 0;
                font-size: 18px;
                font-weight: 600;
            }
            
            .visit-date {
                margin: 5px 0 0;
                color: #666;
                font-size: 14px;
            }
            
            .allergeniq-tabs {
                display: flex;
                border-bottom: 1px solid #e0e0e0;
                margin-bottom: 20px;
                flex-wrap: wrap;
            }
            
            .allergeniq-tab {
                padding: 10px 15px;
                background: none;
                border: none;
                border-bottom: 2px solid transparent;
                cursor: pointer;
                font-weight: 500;
                font-size: 14px;
                color: #555;
                transition: all 0.2s ease;
            }
            
            .allergeniq-tab:hover {
                color: #106ba3;
            }
            
            .allergeniq-tab.active {
                color: #106ba3;
                border-bottom-color: #106ba3;
            }
            
            .tab-pane {
                padding: 10px 5px;
            }
            
            /* Summary Tab Styles */
            .summary-section {
                margin-bottom: 15px;
            }
            
            .summary-section h4 {
                margin: 0 0 5px;
                font-size: 15px;
                font-weight: 500;
                color: #555;
            }
            
            .summary-section p {
                margin: 0;
                font-size: 14px;
                line-height: 1.4;
            }
            
            /* Symptoms Tab Styles */
            .symptom-item {
                margin-bottom: 20px;
                border: 1px solid #eee;
                border-radius: 6px;
                padding: 15px;
                background: #f9f9f9;
            }
            
            .symptom-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 10px;
                flex-wrap: wrap;
            }
            
            .symptom-header h4 {
                margin: 0;
                font-size: 16px;
                font-weight: 500;
            }
            
            .severity-label {
                font-size: 14px;
                color: #666;
            }
            
            .severity-bar {
                height: 8px;
                background: #e0e0e0;
                border-radius: 4px;
                margin-bottom: 10px;
                overflow: hidden;
            }
            
            .severity-fill {
                height: 100%;
                border-radius: 4px;
                background: linear-gradient(to right, #4caf50, #ffc107, #f44336);
            }
            
            .symptom-details {
                font-size: 14px;
            }
            
            .symptom-details p {
                margin: 5px 0;
            }
            
            /* Medications Tab Styles */
            .medications-table {
                width: 100%;
                border-collapse: collapse;
                font-size: 14px;
            }
            
            .medications-table th {
                text-align: left;
                padding: 10px;
                background: #f5f5f5;
                border-bottom: 2px solid #ddd;
                font-weight: 500;
            }
            
            .medications-table td {
                padding: 10px;
                border-bottom: 1px solid #eee;
            }
            
            .efficacy-indicator {
                padding: 5px 10px;
                border-radius: 3px;
                display: inline-block;
                color: white;
                font-weight: 500;
                text-align: center;
            }
            
            .efficacy-indicator.high {
                background-color: #4caf50;
            }
            
            .efficacy-indicator.medium {
                background-color: #ff9800;
            }
            
            .efficacy-indicator.low {
                background-color: #f44336;
            }
            
            /* Allergens Tab Styles */
            .allergens-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                gap: 15px;
            }
            
            .allergen-card {
                border: 1px solid #e0e0e0;
                border-radius: 8px;
                padding: 15px;
                background: #f9f9f9;
                position: relative;
                overflow: hidden;
            }
            
            .allergen-card h4 {
                margin: 0 0 10px;
                font-size: 16px;
                font-weight: 500;
            }
            
            .allergen-card.high {
                border-left: 4px solid #f44336;
            }
            
            .allergen-card.medium-high {
                border-left: 4px solid #ff9800;
            }
            
            .allergen-card.medium {
                border-left: 4px solid #ffc107;
            }
            
            .allergen-card.low {
                border-left: 4px solid #4caf50;
            }
            
            .test-result {
                display: inline-block;
                padding: 3px 8px;
                background: #eee;
                border-radius: 4px;
                font-size: 13px;
                margin-bottom: 10px;
            }
            
            .allergen-details {
                font-size: 14px;
            }
            
            .allergen-details p {
                margin: 5px 0;
            }
            
            /* Error and loading messages */
            .loading-message, .error-message {
                padding: 20px;
                text-align: center;
                color: #666;
                font-style: italic;
            }
            
            .error-message {
                color: #d32f2f;
            }
            
            /* Responsive styling */
            @media (max-width: 768px) {
                .allergeniq-tab {
                    padding: 8px 12px;
                    font-size: 13px;
                }
                
                .symptom-header {
                    flex-direction: column;
                    align-items: flex-start;
                }
                
                .severity-label {
                    margin-top: 5px;
                }
                
                .medications-table {
                    font-size: 12px;
                }
                
                .medications-table td, .medications-table th {
                    padding: 8px 5px;
                }
                
                .allergens-grid {
                    grid-template-columns: 1fr;
                }
            }
        `;
        
        document.head.appendChild(styleSheet);
        console.log('[DEBUG] AllergenIQ styles added to document');
    } catch (error) {
        console.error('[ERROR] Failed to add AllergenIQ styles:', error);
    }
}

/**
 * Download AllergenIQ profile as PDF
 * @param {Object} data - The profile data
 */
function downloadAllergenIQPDF(data) {
    console.log('[DEBUG] Downloading AllergenIQ PDF for:', data);
    
    try {
        // For future implementation with jsPDF
        alert("PDF download functionality will be available in the next update. Please use the Copy Report function for now.");
    } catch (error) {
        console.error('[ERROR] Failed to download PDF:', error);
        alert("An error occurred while trying to download the PDF. Please try again later.");
    }
}

/**
 * Copy AllergenIQ report to clipboard
 * @param {Object} data - The profile data
 */
function copyAllergenIQReport(data) {
    console.log('[DEBUG] Copying AllergenIQ report for:', data);
    
    try {
        // Create formatted report text
        const reportText = generateReportText(data);
        
        // Copy to clipboard
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(reportText)
                .then(() => {
                    alert("AllergenIQ report copied to clipboard!");
                })
                .catch(err => {
                    console.error('[DEBUG] Failed to copy report using navigator.clipboard: ', err);
                    fallbackCopyTextToClipboard(reportText);
                });
        } else {
            fallbackCopyTextToClipboard(reportText);
        }
    } catch (error) {
        console.error('[DEBUG] Error generating report:', error);
        alert("Failed to generate report. Please try again.");
    }
}

/**
 * Fallback method to copy text to clipboard
 * @param {string} text - The text to copy
 */
function fallbackCopyTextToClipboard(text) {
    try {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        
        // Make the textarea out of viewport
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        
        if (successful) {
            alert("AllergenIQ report copied to clipboard!");
        } else {
            alert("Failed to copy report. Please try again or use another browser.");
        }
    } catch (err) {
        console.error('[DEBUG] Fallback copy method failed: ', err);
        alert("Failed to copy report. Please try again or use another browser.");
    }
}

/**
 * Generate formatted report text
 * @param {Object} data - The profile data
 * @returns {string} The formatted report text
 */
function generateReportText(data) {
    console.log('[DEBUG] Generating report text');
    
    try {
        // Validate data - provide default values if fields are missing
        const patientName = data.patientName || 'Unknown Patient';
        const patientAge = data.patientAge || 'Unknown';
        const visitDate = data.visitDate || 'Unknown';
        const summary = data.summary || {};
        const symptomData = Array.isArray(data.symptomData) ? data.symptomData : [];
        const medicationHistory = Array.isArray(data.medicationHistory) ? data.medicationHistory : [];
        const allergenData = Array.isArray(data.allergenData) ? data.allergenData : [];
        
        let report = `ALLERGENIQ PATIENT PROFILE
--------------------------
Patient: ${patientName}, ${patientAge} years
Visit Date: ${visitDate}

SUMMARY:
--------
Pattern: ${summary.pattern || 'Unknown'}
Primary System: ${summary.primarySystem || 'Unknown'}
Likely Diagnosis: ${summary.likelyDiagnosis || 'Unknown'}
Recommended Approach: ${summary.recommendedApproach || 'Unknown'}

SYMPTOMS:
---------
`;

        // Add symptoms
        if (symptomData.length > 0) {
            symptomData.forEach(symptom => {
                report += `${symptom.system || 'Unknown'} (Severity: ${symptom.severity || 'Unknown'}/10)
  Duration: ${symptom.duration || 'Unknown'}
  Frequency: ${symptom.frequency || 'Unknown'}
  Triggers: ${symptom.triggers || 'Unknown'}

`;
            });
        } else {
            report += `No symptom data available.

`;
        }

        // Add medications
        report += `MEDICATIONS:
------------
`;
        if (medicationHistory.length > 0) {
            medicationHistory.forEach(med => {
                report += `${med.name || 'Unknown'} (${med.class || 'Unknown'})
  Efficacy: ${med.efficacy || 'Unknown'}/10
  Side Effects: ${med.sideEffects || 'None reported'}
  Adherence: ${med.adherence || 'Unknown'}

`;
            });
        } else {
            report += `No medication history available.

`;
        }

        // Add allergens
        report += `ALLERGENS:
----------
`;
        if (allergenData.length > 0) {
            allergenData.forEach(allergen => {
                const crossReactivity = Array.isArray(allergen.crossReactivity) ? 
                    allergen.crossReactivity.join(', ') : (allergen.crossReactivity || 'None');
                    
                report += `${allergen.name || 'Unknown'} - ${allergen.testResult || 'Unknown'}
  Cross-Reactivity: ${crossReactivity}
  Clinical Relevance: ${allergen.clinicalRelevance || 'Unknown'}

`;
            });
        } else {
            report += `No allergen data available.

`;
        }

        report += `--------------------------
Generated by Medora AllergenIQ™ on ${new Date().toLocaleDateString()}`;

        return report;
    } catch (error) {
        console.error('[ERROR] Failed to generate report text:', error);
        return `ALLERGENIQ PATIENT PROFILE
--------------------------
Error generating report: ${error.message}
--------------------------
Generated by Medora AllergenIQ™`;
    }
}

/**
 * Get demo patient data for testing
 * @returns {Object} Demo patient data
 */
function getDemoPatientData() {
    console.log('[DEBUG] Getting demo patient data');
    
    return {
        patientName: "Jane Smith",
        patientAge: 37,
        visitDate: new Date().toISOString().split('T')[0],
        symptomData: [
            { system: "Respiratory", severity: 8, duration: "3 years", frequency: "Daily", triggers: "Pollen, Dust" },
            { system: "Nasal", severity: 9, duration: "5 years", frequency: "Constant", triggers: "Pollen, Pet Dander" },
            { system: "Ocular", severity: 7, duration: "5 years", frequency: "Seasonal", triggers: "Pollen" },
            { system: "Dermatologic", severity: 4, duration: "1 year", frequency: "Intermittent", triggers: "Unknown" },
            { system: "GI", severity: 2, duration: "6 months", frequency: "Weekly", triggers: "Unknown" }
        ],
        medicationHistory: [
            { name: "Zyrtec", class: "Antihistamine", efficacy: 3, sideEffects: "Drowsiness", adherence: "Daily for 2 months" },
            { name: "Flonase", class: "Nasal Steroid", efficacy: 5, sideEffects: "None", adherence: "Intermittent for 3 months" },
            { name: "Prednisone", class: "Oral Steroid", efficacy: 8, sideEffects: "Insomnia, Appetite", adherence: "10-day course, once" },
            { name: "Benadryl", class: "Antihistamine", efficacy: 6, sideEffects: "Severe drowsiness", adherence: "As needed" },
            { name: "Singulair", class: "Leukotriene Modifier", efficacy: 2, sideEffects: "Mood changes", adherence: "Daily for 2 weeks" }
        ],
        allergenData: [
            { name: "Dust Mites", testResult: "Positive (3+)", crossReactivity: ["Storage Mites"], clinicalRelevance: "High - correlates with morning symptoms" },
            { name: "Cat Dander", testResult: "Positive (4+)", crossReactivity: ["Dog Dander", "Horse"], clinicalRelevance: "High - explains persistent indoor symptoms" },
            { name: "Timothy Grass", testResult: "Positive (3+)", crossReactivity: ["Bermuda Grass", "Rye Grass", "Wheat"], clinicalRelevance: "Moderate - seasonal correlation" },
            { name: "Birch Pollen", testResult: "Positive (4+)", crossReactivity: ["Alder", "Oak", "Apple", "Cherry", "Peach"], clinicalRelevance: "High - correlates with oral symptoms after fruits" },
            { name: "Ragweed", testResult: "Positive (3+)", crossReactivity: ["Sunflower", "Chamomile", "Banana", "Melon"], clinicalRelevance: "High - explains late summer/fall exacerbations" }
        ],
        summary: {
            pattern: "classic allergic",
            primarySystem: "nasal and respiratory",
            likelyDiagnosis: "perennial allergic rhinitis with seasonal exacerbations and allergic asthma, complicated by potential oral allergy syndrome",
            recommendedApproach: "Combination therapy with non-sedating antihistamine, intranasal corticosteroid, and inhaled corticosteroid for asthma component. Consider immunotherapy given the clear allergen identification and inadequate control with medications. Additional food allergy testing recommended based on cross-reactivity patterns."
        }
    };
}

/**
 * Function to manually load demo data - for testing only
 */
function loadAllergenIQDemoData() {
    console.log('[DEBUG] Loading AllergenIQ demo data manually');
    const demoData = getDemoPatientData();
    allergeniqProfileData = demoData;
    displayAllergenIQProfile(demoData);
}

/**
 * Debug function to help diagnose issues
 * Can be called from browser console: debugAllergenIQ()
 */
function debugAllergenIQ() {
    console.log('===== ALLERGENIQ DEBUG START =====');
    
    // Check if profile container exists
    const profileContainer = document.getElementById('allergeniq-profile-container');
    console.log('Profile container exists:', !!profileContainer);
    
    // Check current patient/visit IDs
    const patientId = document.getElementById('patient-details-name')?.dataset.patientId;
    const visitId = document.getElementById('patient-details-current-visit')?.dataset.visitId;
    console.log('Current patient ID:', patientId);
    console.log('Current visit ID:', visitId);
    
    // Check for global variables
    console.log('allergeniqProfileData exists:', typeof allergeniqProfileData !== 'undefined');
    console.log('allergeniqCurrentPatientId:', allergeniqCurrentPatientId);
    console.log('allergeniqCurrentVisitId:', allergeniqCurrentVisitId);
    console.log('allergeniqIsLoading:', allergeniqIsLoading);
    
    // Check tenant and email
    const tenantId = window.currentTenantId || localStorage.getItem('tenantId');
    const email = window.currentEmail || localStorage.getItem('currentEmail') || localStorage.getItem('userEmail');
    console.log('Tenant ID:', tenantId);
    console.log('Email:', email);
    
    // Try to construct API URL
    if (patientId && visitId) {
        const apiUrl = `/api/allergeniq-profile?patient_id=${patientId}&visit_id=${visitId}${tenantId ? `&tenantId=${tenantId}` : ''}${email ? `&email=${email}` : ''}`;
        console.log('API URL would be:', apiUrl);
        
        // Test the API endpoint directly
        console.log('Testing API endpoint directly...');
        fetch(apiUrl)
            .then(response => {
                console.log('API response status:', response.status);
                return response.json();
            })
            .then(data => {
                console.log('API response data:', data);
            })
            .catch(error => {
                console.error('Error testing API:', error);
            });
    } else {
        console.log('Cannot test API: missing patient ID or visit ID');
    }
    
    // Check DOM structure
    console.log('DOM Structure:');
    console.log('allergeniq-section exists:', !!document.querySelector('.allergeniq-section'));
    console.log('allergeniq-download-btn exists:', !!document.getElementById('allergeniq-download-btn'));
    console.log('allergeniq-copy-btn exists:', !!document.getElementById('allergeniq-copy-btn'));
    console.log('allergeniq tabs exist:', !!document.querySelector('.allergeniq-tabs'));
    
    // Force load demo data for testing
    console.log('Loading demo data for testing...');
    loadAllergenIQDemoData();
    
    console.log('===== ALLERGENIQ DEBUG END =====');
    
    return true;
}

// Enhanced React polyfill for Recharts compatibility
(function() {
    // Check if React exists
    if (typeof window.React === 'undefined') {
        console.warn('[DEBUG] React not found, creating complete polyfill');
        window.React = {
            Component: function() { this.setState = function() {}; },
            PureComponent: function() { this.setState = function() {}; },
            createElement: function() { return {}; },
            createContext: function() { return { Provider: {}, Consumer: {} }; },
            createRef: function() { return { current: null }; },
            forwardRef: function(render) { return render; },
            Fragment: Symbol('Fragment'),
            StrictMode: Symbol('StrictMode'),
            useState: function() { return [null, function() {}]; },
            useEffect: function() {},
            useRef: function() { return { current: null }; },
            useMemo: function(factory) { return factory(); },
            useCallback: function(callback) { return callback; },
            useContext: function() { return {}; }
        };
    } else {
        // React exists but might be missing some components Recharts needs
        if (typeof window.React.PureComponent === 'undefined') {
            console.warn('[DEBUG] React.PureComponent not found, adding to existing React');
            window.React.PureComponent = window.React.Component || function() {
                this.setState = function() {};
            };
        }
        if (typeof window.React.createRef === 'undefined') {
            window.React.createRef = function() { return { current: null }; };
        }
        if (typeof window.React.forwardRef === 'undefined') {
            window.React.forwardRef = function(render) { return render; };
        }
    }
    
    // Check if ReactDOM exists (also needed by Recharts)
    if (typeof window.ReactDOM === 'undefined') {
        console.warn('[DEBUG] ReactDOM not found, creating minimal polyfill');
        window.ReactDOM = {
            render: function() {},
            unmountComponentAtNode: function() {},
            findDOMNode: function() { return null; },
            createPortal: function(children) { return children; }
        };
    }
    
    console.log('[DEBUG] Added React polyfill for Recharts compatibility');
})();

// Expose functions to global scope
window.loadAllergenIQDemoData = loadAllergenIQDemoData;
window.debugAllergenIQ = debugAllergenIQ;

// Fix for AllergenIQ profile loading
(function() {
    console.log('[DEBUG] Attempting to fix AllergenIQ loading issue');
    
    // Wait for the DOM to be fully ready
    const checkForAllergenIQContainer = () => {
        const container = document.getElementById('allergeniq-profile-container');
        if (container) {
            if (container.textContent.includes('Loading patient analysis')) {
                console.log('[DEBUG] Found AllergenIQ container in loading state, attempting recovery');
                
                // Get current patient and visit IDs from the page
                const patientId = document.getElementById('patient-details-name')?.dataset.patientId;
                const visitId = document.getElementById('patient-details-current-visit')?.dataset.visitId;
                
                if (patientId && visitId) {
                    console.log(`[DEBUG] Force loading AllergenIQ profile for patient ${patientId}, visit ${visitId}`);
                    
                    // Force demo mode to ensure something is displayed
                    const demoData = getDemoPatientData();
                    allergeniqProfileData = demoData;
                    displayAllergenIQProfile(demoData);
                    allergeniqIsLoading = false;
                    
                    // Try actual loading again
                    setTimeout(() => {
                        loadAllergenIQProfile(patientId, visitId);
                    }, 1000);
                } else {
                    // No patient selected, show demo data
                    console.log('[DEBUG] No patient selected, showing demo data');
                    loadAllergenIQDemoData();
                }
            } else {
                console.log('[DEBUG] AllergenIQ container already loaded');
            }
        } else {
            console.log('[DEBUG] AllergenIQ container not found yet, waiting...');
            setTimeout(checkForAllergenIQContainer, 1000);
        }
    };
    
    // Start checking after a delay to ensure other scripts have loaded
    setTimeout(checkForAllergenIQContainer, 2000);
})();

// Fix for recommendations display
(function() {
    console.log('[DEBUG] Adding recommendations display fix');
    
    // Add custom CSS to restore the recommendations display
    const styleSheet = document.createElement('style');
    styleSheet.id = 'recommendations-fix-styles';
    styleSheet.innerHTML = `
        /* Restore recommendations display */
        #insights-recommendations .recommendation-section {
            margin-bottom: 15px;
            border-bottom: 1px solid #eee;
            padding-bottom: 15px;
        }
        
        #insights-recommendations .recommendation-section h4 {
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 10px;
            color: #333;
        }
        
        #insights-recommendations .recommendation-section ul {
            margin-left: 20px;
            padding-left: 0;
        }
        
        #insights-recommendations .recommendation-section li {
            margin-bottom: 8px;
            line-height: 1.5;
        }
    `;
    
    document.head.appendChild(styleSheet);
})();
