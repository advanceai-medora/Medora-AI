let patients = [];
let activeVisitId = null;
let currentEmail = null;
let currentTenantId = null;
let currentRole = null;
let currentPatientId = null;
let currentPatient = null;
let latestAnalysis = null;
let recognition = null;
let isRecognizing = false;
let finalTranscript = '';
let isInterpreterMode = false;
let doctorLang = 'EN';
let patientLang = 'ES';
let currentSpeaker = 'doctor';
let autoRefreshInterval = null;
let editHistory = [];
let noteLengthPreference = 'Concise';
let currentTemplate = null;

// Default templates (used as fallback if none in localStorage)
const defaultTemplates = [
    {
        name: "New Allergy Consult",
        category: "New Consult",
        isDefault: true,
        sections: [
            {
                name: "Chief Complaint",
                defaultText: "Patient reports worsening nasal congestion in spring season.",
                prompts: ["What seasonal symptoms?", "Trigger exposures?"],
                dropdowns: ["Pollen", "Dust", "Pet", "Mold"],
                checkboxOptions: [],
                aiSmartSuggest: true
            },
            {
                name: "History of Present Illness (HPI)",
                defaultText: "",
                prompts: [],
                dropdowns: [],
                checkboxOptions: [],
                aiSmartSuggest: false
            },
            {
                name: "Environmental Allergy History",
                defaultText: "",
                prompts: [],
                dropdowns: [],
                checkboxOptions: [],
                aiSmartSuggest: false
            },
            {
                name: "Food Allergy History",
                defaultText: "",
                prompts: [],
                dropdowns: [],
                checkboxOptions: [],
                aiSmartSuggest: false
            },
            {
                name: "Medication Allergy History",
                defaultText: "",
                prompts: [],
                dropdowns: [],
                checkboxOptions: [],
                aiSmartSuggest: false
            },
            {
                name: "Family History",
                defaultText: "",
                prompts: [],
                dropdowns: [],
                checkboxOptions: [],
                aiSmartSuggest: false
            },
            {
                name: "Social History (Pets, Smoking)",
                defaultText: "",
                prompts: [],
                dropdowns: [],
                checkboxOptions: [],
                aiSmartSuggest: false
            },
            {
                name: "Prior Testing",
                defaultText: "",
                prompts: [],
                dropdowns: [],
                checkboxOptions: [],
                aiSmartSuggest: false
            },
            {
                name: "Current Medications",
                defaultText: "",
                prompts: [],
                dropdowns: [],
                checkboxOptions: [],
                aiSmartSuggest: false
            },
            {
                name: "Physical Exam",
                defaultText: "",
                prompts: [],
                dropdowns: [],
                checkboxOptions: [],
                aiSmartSuggest: false
            },
            {
                name: "Assessment and Plan",
                defaultText: "",
                prompts: [],
                dropdowns: [],
                checkboxOptions: [],
                aiSmartSuggest: false
            },
            {
                name: "Patient Education",
                defaultText: "",
                prompts: [],
                dropdowns: [],
                checkboxOptions: [],
                aiSmartSuggest: false
            }
        ]
    },
    {
        name: "Immunotherapy Visit Note",
        category: "Immunotherapy Visit",
        isDefault: false,
        sections: [
            {
                name: "Chief Complaint",
                defaultText: "Patient here for immunotherapy follow-up.",
                prompts: ["Any reactions since last visit?", "Symptom changes?"],
                dropdowns: [],
                checkboxOptions: ["Local Reaction", "Systemic Reaction", "No Reaction"],
                aiSmartSuggest: true
            },
            {
                name: "Assessment and Plan",
                defaultText: "Continue immunotherapy as scheduled.",
                prompts: [],
                dropdowns: [],
                checkboxOptions: [],
                aiSmartSuggest: false
            }
        ]
    },
    {
        name: "Allergy Follow-Up",
        category: "Follow-Up",
        isDefault: false,
        sections: [
            {
                name: "Chief Complaint",
                defaultText: "Patient reports well-controlled allergic rhinitis. Symptoms improved with avoidance measures and antihistamine use.",
                prompts: ["Seasonal vs. perennial symptoms?"],
                dropdowns: ["House dust mites", "Pollen"],
                checkboxOptions: [],
                aiSmartSuggest: true
            }
        ]
    }
];

// Load templates from localStorage or use default
let templates = JSON.parse(localStorage.getItem('medoraTemplates')) || defaultTemplates;
console.log('Loaded templates from localStorage:', templates);

// Save templates to localStorage
function saveTemplates() {
    console.log('Saving templates to localStorage:', templates);
    localStorage.setItem('medoraTemplates', JSON.stringify(templates));
}

// Declare updateTooltipVisibility as a global variable
window.updateTooltipVisibility = null;

// Function to call a function with retries if it's not defined
function callWithRetry(funcName, maxAttempts = 5, delay = 500) {
    return new Promise((resolve, reject) => {
        let attempts = 0;

        const attempt = () => {
            console.log(`Attempt ${attempts + 1}: ${funcName} not defined, retrying in ${delay}ms...`);
            console.log(`Current window[${funcName}]:`, typeof window[funcName]);
            if (typeof window[funcName] === 'function') {
                window[funcName]();
                resolve();
            } else {
                attempts++;
                if (attempts >= maxAttempts) {
                    console.error(`${funcName} function not defined after ${maxAttempts} attempts`);
                    alert(`Error: ${funcName} functionality is unavailable. Please ensure all scripts are loaded correctly and try refreshing the page.`);
                    reject(new Error(`${funcName} function not defined`));
                    return;
                }
                setTimeout(attempt, delay);
            }
        };

        attempt();
    });
}

// Function to initialize event listeners with retry mechanism
function initializeEventListeners(attempts = 20, delay = 2000) {
    console.log('initializeEventListeners called with attempts:', attempts);
    
    const startVisitBtn = document.getElementById('start-visit-btn');
    const startListeningBtn = document.getElementById('start-listening-btn');
    const stopListeningBtn = document.getElementById('stop-listening-btn');
    const submitTranscriptBtn = document.getElementById('submit-transcript-btn');
    const smartLearningBadge = document.getElementById('smart-learning-badge');
    const patientIdInput = document.getElementById('patient-id');
    let logoutBtn = document.getElementById('logout-btn');

    // Log the actual elements to inspect their values
    const elements = {
        startVisitBtn: startVisitBtn,
        startListeningBtn: startListeningBtn,
        stopListeningBtn: stopListeningBtn,
        submitTranscriptBtn: submitTranscriptBtn,
        smartLearningBadge: smartLearningBadge,
        patientIdInput: patientIdInput,
        logoutBtn: logoutBtn
    };
    console.log('Checking elements (actual values):', elements);

    // Convert to boolean for logging
    const elementsBoolean = {
        startVisitBtn: !!startVisitBtn,
        startListeningBtn: !!startListeningBtn,
        stopListeningBtn: !!stopListeningBtn,
        submitTranscriptBtn: !!submitTranscriptBtn,
        smartLearningBadge: !!smartLearningBadge,
        patientIdInput: !!patientIdInput,
        logoutBtn: !!logoutBtn
    };
    console.log('Checking elements (boolean):', elementsBoolean);

    // Explicitly check required elements for null or undefined (exclude logoutBtn for now)
    const missingElements = [];
    if (startVisitBtn === null || startVisitBtn === undefined) missingElements.push('startVisitBtn');
    if (startListeningBtn === null || startListeningBtn === undefined) missingElements.push('startListeningBtn');
    if (stopListeningBtn === null || stopListeningBtn === undefined) missingElements.push('stopListeningBtn');
    if (submitTranscriptBtn === null || submitTranscriptBtn === undefined) missingElements.push('submitTranscriptBtn');
    if (smartLearningBadge === null || smartLearningBadge === undefined) missingElements.push('smartLearningBadge');
    if (patientIdInput === null || patientIdInput === undefined) missingElements.push('patientIdInput');

    const requiredElementsFound = missingElements.length === 0;
    console.log('Required elements found:', requiredElementsFound);
    if (!requiredElementsFound) {
        console.warn('Missing required elements:', missingElements);
    }

    if (!requiredElementsFound) {
        if (attempts > 0) {
            console.warn(`Some required elements were not found, retrying (${attempts} attempts left)...`, elementsBoolean);
            setTimeout(() => initializeEventListeners(attempts - 1, delay), delay);
        } else {
            console.error('Failed to initialize event listeners after retries:', elementsBoolean);
        }
        return;
    }

    console.log('All required elements found, setting up event listeners');

    // Set initial button states
    startVisitBtn.disabled = false;
    startListeningBtn.disabled = true;
    startListeningBtn.classList.add('disabled');
    stopListeningBtn.disabled = true;
    stopListeningBtn.classList.add('disabled');
    submitTranscriptBtn.disabled = true;
    submitTranscriptBtn.classList.add('disabled');

    // Add event listeners for required elements
    startListeningBtn.addEventListener('click', () => {
        console.log('Start Listening button clicked');
        callWithRetry('startSpeechRecognition')
            .catch(err => console.error(err.message));
    });

    stopListeningBtn.addEventListener('click', () => {
        console.log('Stop Listening button clicked');
        callWithRetry('stopSpeechRecognition')
            .catch(err => console.error(err.message));
    });

    submitTranscriptBtn.addEventListener('click', () => {
        console.log('Submit Transcript button clicked');
        callWithRetry('submitTranscript')
            .catch(err => console.error(err.message));
    });

    console.log('Binding Smart Learning badge event listener');
    smartLearningBadge.addEventListener('click', () => {
        console.log('Smart Learning badge clicked');
        if (typeof window.openSmartLearningModal === 'function') {
            window.openSmartLearningModal();
        } else {
            console.error('openSmartLearningModal function not defined');
        }
    });

    // Show onboarding tooltip for patient input
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    tooltip.innerText = "Enter the patient's name before starting your visit\n\nImprove note quality and access background info and follow-ups from their last visit.";
    patientIdInput.style.position = 'relative';
    patientIdInput.parentNode.appendChild(tooltip);

    // Position the tooltip below the input
    const inputRect = patientIdInput.getBoundingClientRect();
    tooltip.style.top = `${inputRect.bottom + window.scrollY + 10}px`;
    tooltip.style.left = `${inputRect.left + window.scrollX}px`;

    // Function to update tooltip visibility based on input and patient selection
    window.updateTooltipVisibility = () => {
        const inputValue = patientIdInput.value.trim();
        if (currentPatientId) {
            // Patient is selected, hide tooltip and stop blinking
            tooltip.style.display = 'none';
            startVisitBtn.classList.remove('blink');
        } else if (inputValue.length >= 2) {
            // Patient ID entered but no patient selected, show blinking to guide user to start visit
            tooltip.style.display = 'none';
            startVisitBtn.classList.add('blink');
        } else {
            // No patient selected and input is empty, show tooltip and stop blinking
            tooltip.style.display = 'block';
            startVisitBtn.classList.remove('blink');
        }
    };

    // Initial check for tooltip visibility
    window.updateTooltipVisibility();

    // Add event listener to patient input to show/hide tooltip and enable Start Visit button
    patientIdInput.addEventListener('input', () => {
        window.updateTooltipVisibility();
    });

    // Add keydown event to trigger Start Visit on Enter key
    patientIdInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            const inputValue = patientIdInput.value.trim();
            if (inputValue.length >= 2) { // Only trigger if input is valid
                event.preventDefault(); // Prevent form submission if any
                startVisitBtn.classList.add('btn-active');
                startVisitBtn.classList.remove('blink');
                if (typeof window.startVisit === 'function') {
                    window.startVisit();
                } else {
                    console.error('startVisit function not defined');
                }
            }
        }
    });

    // Add event listener to Start Visit button to call startVisit()
    startVisitBtn.addEventListener('click', () => {
        console.log('Start Visit button clicked');
        const inputValue = patientIdInput.value.trim();
        if (inputValue.length >= 2) { // Only proceed if input is valid
            startVisitBtn.classList.add('btn-active');
            startVisitBtn.classList.remove('blink');
            if (typeof window.startVisit === 'function') {
                window.startVisit();
            } else {
                console.error('startVisit function not defined');
            }
        } else {
            alert('Please enter a valid patient name or ID (at least 2 characters).');
        }
    });

    const planDetailToggle = document.getElementById('plan-detail-toggle');
    const planBulletToggle = document.getElementById('plan-bullet-toggle');
    const insightsDetailToggle = document.getElementById('insights-detail-toggle');
    const insightsBulletToggle = document.getElementById('insights-bullet-toggle');

    if (planDetailToggle) planDetailToggle.addEventListener('click', () => {
        if (typeof window.togglePlanDetail === 'function') {
            window.togglePlanDetail();
        } else {
            console.error('togglePlanDetail function not defined');
        }
    });

    if (planBulletToggle) planBulletToggle.addEventListener('click', () => {
        if (typeof window.togglePlanBullets === 'function') {
            window.togglePlanBullets();
        } else {
            console.error('togglePlanBullets function not defined');
        }
    });

    if (insightsDetailToggle) insightsDetailToggle.addEventListener('click', () => {
        if (typeof window.toggleDetail === 'function') {
            window.toggleDetail();
        } else {
            console.error('toggleDetail function not defined');
        }
    });

    if (insightsBulletToggle) insightsBulletToggle.addEventListener('click', () => {
        if (typeof window.toggleBullets === 'function') {
            window.toggleBullets();
        } else {
            console.error('toggleBullets function not defined');
        }
    });

    const patientFilter = document.getElementById('patient-filter');
    if (patientFilter) {
        patientFilter.addEventListener('change', () => {
            if (typeof window.filterPatients === 'function') {
                window.filterPatients();
            } else {
                console.error('filterPatients function not defined');
            }
        });
    } else {
        console.error('Patient filter dropdown not found');
    }

    const noteLengthSlider = document.getElementById('note-length');
    const noteLengthLabel = document.getElementById('note-length-label');
    if (noteLengthSlider && noteLengthLabel) {
        noteLengthSlider.addEventListener('input', () => {
            const value = noteLengthSlider.value;
            noteLengthLabel.textContent = value === '1' ? 'Concise' : value === '2' ? 'Moderate' : 'Detailed';
        });
    }

    // Retry setting up logoutBtn event listener separately
    let logoutAttempts = 10;
    const setupLogoutListener = () => {
        logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            console.log('Binding Logout button event listener');
            logoutBtn.addEventListener('click', () => {
                console.log('Logout button clicked');
                if (typeof window.logout === 'function') {
                    window.logout();
                } else {
                    console.error('Logout function is not defined. Ensure patient-management.js is loaded.');
                }
            });
        } else if (logoutAttempts > 0) {
            console.warn(`logout-btn not found, retrying (${logoutAttempts} attempts left)...`);
            logoutAttempts--;
            setTimeout(setupLogoutListener, 2000);
        } else {
            console.error('Failed to find logout-btn after retries. Logout functionality will be unavailable.');
        }
    };
    setupLogoutListener();

    console.log('Event listeners set up successfully for required elements');
}

// Initialize after all scripts and resources are loaded
console.log('Script loaded, waiting for window load...');
window.addEventListener('load', () => {
    console.log('Window load event fired');
    // Delay initialization to ensure all scripts (including menu.js) and resources are fully loaded
    setTimeout(() => {
        console.log('Initializing app after delay...');
        // Use localStorage.currentEmail instead of localStorage.getItem('user')
        currentEmail = localStorage.getItem('currentEmail');
        // Set default values for tenantId and role since they're not provided
        currentTenantId = 'default_tenant';
        currentRole = 'doctor'; // Assuming a default role since it's not set elsewhere

        if (currentEmail) {
            console.log('User initialized:', { currentEmail, currentTenantId, currentRole });
            initializeEventListeners();
        } else {
            console.log('No user email found in localStorage, relying on index.html to handle redirect...');
        }

        // Fetch patients after initialization
        if (currentEmail) {
            console.log('Attempting to fetch patients...');
            if (typeof window.fetchPatients === 'function') {
                window.fetchPatients();
            } else {
                console.error('fetchPatients function not defined');
            }
        } else {
            console.error('Cannot call fetchPatients: User is not logged in', {
                isLoggedIn: !!currentEmail
            });
        }
    }, 3000); // Delay to 3 seconds to ensure DOM stability
});
