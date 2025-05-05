console.log('script-patient.js loaded'); // Confirm script is loaded

// Minimum display time for loading indicators (in milliseconds)
const MIN_SPINNER_DISPLAY_TIME = 1000;

// Timeout for references spinner (in milliseconds)
const REFERENCES_SPINNER_TIMEOUT = 5000; // 5 seconds

// Track loading start times to enforce minimum display duration
let spinnerStartTimes = {
    patientList: 0,
    content: 0,
    transcript: 0,
    references: 0
};

// Track timeout for references spinner
let referencesSpinnerTimeout = null;

// Show faint "Loading..." text for patient list
function showSpinner() {
    console.log('Showing loading text for patient list...');
    const patientList = document.getElementById('patient-list');

    if (patientList) {
        // Record start time for minimum display duration
        spinnerStartTimes.patientList = Date.now();

        // Clear existing content to prevent overlap
        patientList.innerHTML = '';

        // Create a faint "Loading..." text overlay
        let loadingText = document.getElementById('patient-list-loading-text');
        if (!loadingText) {
            loadingText = document.createElement('div');
            loadingText.id = 'patient-list-loading-text';
            loadingText.className = 'patient-list-loading-text';
            loadingText.innerText = 'Loading...';
            patientList.appendChild(loadingText);
        }

        // Fade-in the loading text
        loadingText.style.opacity = '0';
        loadingText.style.display = 'block';
        loadingText.setAttribute('aria-busy', 'true'); // Accessibility
        loadingText.setAttribute('aria-label', 'Loading patient list');
        loadingText.style.transition = 'opacity 0.3s ease';
        setTimeout(() => {
            loadingText.style.opacity = '1';
        }, 50);
    } else {
        console.error('Patient list element not found');
    }
}

// Hide faint "Loading..." text for patient list with minimum display time
function hideSpinner() {
    console.log('Hiding loading text for patient list...');
    const loadingText = document.getElementById('patient-list-loading-text');

    if (loadingText) {
        const elapsedTime = Date.now() - spinnerStartTimes.patientList;
        const remainingTime = Math.max(0, MIN_SPINNER_DISPLAY_TIME - elapsedTime);

        setTimeout(() => {
            // Fade-out the loading text
            loadingText.style.transition = 'opacity 0.3s ease';
            loadingText.style.opacity = '0';
            setTimeout(() => {
                loadingText.style.display = 'none';
                loadingText.setAttribute('aria-busy', 'false'); // Accessibility
                // Remove the element to clean up DOM
                if (loadingText.parentNode) {
                    loadingText.parentNode.removeChild(loadingText);
                }
            }, 300);
        }, remainingTime);
    } else {
        console.warn('Patient list loading text not found; may have been removed or not initialized');
    }
}

// Show faint "Loading..." text and skeleton UI for patient switch
function showContentSpinner() {
    console.log('Showing content loading text...');
    const mainContent = document.getElementById('main-content');

    if (mainContent) {
        // Record start time
        spinnerStartTimes.content = Date.now();

        // Create a faint "Loading..." text overlay
        let loadingText = document.getElementById('content-loading-text');
        if (!loadingText) {
            loadingText = document.createElement('div');
            loadingText.id = 'content-loading-text';
            loadingText.className = 'content-loading-text';
            loadingText.innerText = 'Loading...';
            mainContent.appendChild(loadingText);
        }

        // Fade-in the loading text
        loadingText.style.opacity = '0';
        loadingText.style.display = 'block';
        loadingText.setAttribute('aria-busy', 'true'); // Accessibility
        loadingText.setAttribute('aria-label', 'Loading patient details');
        loadingText.style.transition = 'opacity 0.3s ease';
        setTimeout(() => {
            loadingText.style.opacity = '1';
        }, 50);
    } else {
        console.error('Main content area not found');
    }

    // Enhanced skeleton UI for SOAP sections with more realistic placeholders
    const soapSections = document.querySelectorAll('.soap-section .content');
    soapSections.forEach(section => {
        section.classList.add('skeleton');
        section.setAttribute('aria-hidden', 'true'); // Accessibility: Hide skeleton from screen readers
        section.innerHTML = `
            <p style="width: 100%; height: 14px; margin-bottom: 8px;"></p>
            <p style="width: 80%; height: 14px; margin-bottom: 8px;"></p>
            <p style="width: 90%; height: 14px;"></p>
        `;
    });

    // Enhanced skeleton UI for Insights sections
    const insightSections = document.querySelectorAll('.insights-section .content');
    insightSections.forEach(section => {
        section.classList.add('skeleton');
        section.setAttribute('aria-hidden', 'true'); // Accessibility
        section.innerHTML = `
            <p style="width: 100%; height: 14px; margin-bottom: 8px;"></p>
            <p style="width: 80%; height: 14px;"></p>
        `;
    });
}

// Hide faint "Loading..." text and remove skeleton UI with minimum display time
function hideContentSpinner() {
    console.log('Hiding content loading text...');
    const loadingText = document.getElementById('content-loading-text');

    if (loadingText) {
        const elapsedTime = Date.now() - spinnerStartTimes.content;
        const remainingTime = Math.max(0, MIN_SPINNER_DISPLAY_TIME - elapsedTime);

        setTimeout(() => {
            // Fade-out the loading text
            loadingText.style.transition = 'opacity 0.3s ease';
            loadingText.style.opacity = '0';
            setTimeout(() => {
                loadingText.style.display = 'none';
                loadingText.setAttribute('aria-busy', 'false'); // Accessibility
                // Remove the element to clean up DOM
                if (loadingText.parentNode) {
                    loadingText.parentNode.removeChild(loadingText);
                }
            }, 300);
        }, remainingTime);
    } else {
        console.warn('Content loading text not found; may have been removed or not initialized');
    }

    // Remove skeleton UI with a slight delay for smooth transition
    const soapSections = document.querySelectorAll('.soap-section .content');
    soapSections.forEach(section => {
        section.classList.remove('skeleton');
        section.removeAttribute('aria-hidden'); // Accessibility: Make content accessible again
    });

    const insightSections = document.querySelectorAll('.insights-section .content');
    insightSections.forEach(section => {
        section.classList.remove('skeleton');
        section.removeAttribute('aria-hidden'); // Accessibility
    });
}

// Show transcript spinner with fade-in effect
function showTranscriptSpinner() {
    console.log('Showing transcript spinner...');
    const submitBtn = document.getElementById('submit-transcript-btn');

    if (submitBtn) {
        // Record start time
        spinnerStartTimes.transcript = Date.now();

        // Create spinner element if not already present
        let spinnerElement = document.getElementById('transcript-spinner');
        if (!spinnerElement) {
            spinnerElement = document.createElement('span');
            spinnerElement.id = 'transcript-spinner';
            spinnerElement.className = 'spinner';
            submitBtn.appendChild(spinnerElement);
        }

        // Fade-in spinner
        spinnerElement.style.opacity = '0';
        spinnerElement.style.display = 'inline-block';
        spinnerElement.setAttribute('aria-busy', 'true'); // Accessibility
        spinnerElement.setAttribute('aria-label', 'Submitting transcript');
        spinnerElement.style.transition = 'opacity 0.3s ease';
        setTimeout(() => {
            spinnerElement.style.opacity = '1';
        }, 50);

        // Disable button
        submitBtn.disabled = true;
        submitBtn.classList.add('disabled');
    } else {
        console.error('Submit Transcript button not found');
    }
}

// Hide transcript spinner with fade-out effect and minimum display time
function hideTranscriptSpinner() {
    console.log('Hiding transcript spinner...');
    const spinner = document.getElementById('transcript-spinner');
    const submitBtn = document.getElementById('submit-transcript-btn');

    if (spinner && submitBtn) {
        const elapsedTime = Date.now() - spinnerStartTimes.transcript;
        const remainingTime = Math.max(0, MIN_SPINNER_DISPLAY_TIME - elapsedTime);

        setTimeout(() => {
            // Fade-out spinner
            spinner.style.transition = 'opacity 0.3s ease';
            spinner.style.opacity = '0';
            setTimeout(() => {
                spinner.style.display = 'none';
                spinner.setAttribute('aria-busy', 'false'); // Accessibility
                // Remove spinner element to clean up DOM
                if (spinner.parentNode) {
                    spinner.parentNode.removeChild(spinner);
                }
            }, 300);

            // Enable button
            submitBtn.disabled = false;
            submitBtn.classList.remove('disabled');
        }, remainingTime);
    } else {
        console.error('Transcript spinner or submit button not found', {
            spinner: !!spinner,
            submitBtn: !!submitBtn
        });
    }
}

// Show references spinner and enhanced skeleton UI with fade-in effect
function showReferencesSpinner() {
    console.log('Showing references spinner...');
    const referencesSpinner = document.getElementById('references-spinner');
    const referencesTable = document.getElementById('references-table');

    if (referencesSpinner && referencesTable) {
        // Record start time
        spinnerStartTimes.references = Date.now();

        // Fade-in spinner
        referencesSpinner.style.opacity = '0';
        referencesSpinner.style.display = 'block';
        referencesSpinner.setAttribute('aria-busy', 'true'); // Accessibility
        referencesSpinner.setAttribute('aria-label', 'Loading references');
        referencesSpinner.style.transition = 'opacity 0.3s ease';
        setTimeout(() => {
            referencesSpinner.style.opacity = '1';
        }, 50);

        // Enhanced skeleton UI for references table
        referencesTable.classList.add('skeleton');
        const tableBody = document.getElementById('references-table-body');
        if (tableBody) {
            tableBody.setAttribute('aria-hidden', 'true'); // Accessibility
            tableBody.innerHTML = `
                <tr>
                    <td style="height: 20px;"></td>
                    <td style="height: 20px;"></td>
                    <td style="height: 20px;"></td>
                    <td style="height: 20px;"></td>
                    <td style="height: 20px;"></td>
                </tr>
                <tr>
                    <td style="height: 20px;"></td>
                    <td style="height: 20px;"></td>
                    <td style="height: 20px;"></td>
                    <td style="height: 20px;"></td>
                    <td style="height: 20px;"></td>
                </tr>
                <tr>
                    <td style="height: 20px;"></td>
                    <td style="height: 20px;"></td>
                    <td style="height: 20px;"></td>
                    <td style="height: 20px;"></td>
                    <td style="height: 20px;"></td>
                </tr>
            `;
        } else {
            console.error('References table body not found');
        }

        // Set a timeout to hide the spinner if fetchReferences doesn't complete
        if (referencesSpinnerTimeout) {
            clearTimeout(referencesSpinnerTimeout);
        }
        referencesSpinnerTimeout = setTimeout(() => {
            console.warn('References spinner timeout reached, hiding spinner...');
            hideReferencesSpinner();
        }, REFERENCES_SPINNER_TIMEOUT);
    } else {
        console.error('References spinner or table not found', {
            referencesSpinner: !!referencesSpinner,
            referencesTable: !!referencesTable
        });
    }
}

// Hide references spinner and remove skeleton UI with minimum display time and fade-out effect
function hideReferencesSpinner() {
    console.log('Hiding references spinner...');
    const referencesSpinner = document.getElementById('references-spinner');
    const referencesTable = document.getElementById('references-table');

    // Clear the timeout since we're hiding the spinner
    if (referencesSpinnerTimeout) {
        clearTimeout(referencesSpinnerTimeout);
        referencesSpinnerTimeout = null;
    }

    if (referencesSpinner && referencesTable) {
        const elapsedTime = Date.now() - spinnerStartTimes.references;
        const remainingTime = Math.max(0, MIN_SPINNER_DISPLAY_TIME - elapsedTime);

        setTimeout(() => {
            // Fade-out spinner
            referencesSpinner.style.transition = 'opacity 0.3s ease';
            referencesSpinner.style.opacity = '0';
            setTimeout(() => {
                referencesSpinner.style.display = 'none';
                referencesSpinner.setAttribute('aria-busy', 'false'); // Accessibility
            }, 300);

            // Remove skeleton UI
            referencesTable.classList.remove('skeleton');
            const tableBody = document.getElementById('references-table-body');
            if (tableBody) {
                tableBody.removeAttribute('aria-hidden'); // Accessibility
            }
        }, remainingTime);
    } else {
        console.error('References spinner or table not found', {
            referencesSpinner: !!referencesSpinner,
            referencesTable: !!referencesTable
        });
    }
}

// Fetch patients from backend
async function fetchPatients() {
    console.log('Fetching patients for tenant:', currentTenantId);
    showSpinner();
    try {
        // Check if currentTenantId is defined
        if (typeof currentTenantId === 'undefined' || currentTenantId === null) {
            throw new Error('Tenant ID is not defined. Please ensure you are logged in.');
        }
        const response = await fetch(`/api/get-patients?tenantId=${currentTenantId}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const data = await response.json();
        patients = data.patients || [];
        updatePatientList();
    } catch (error) {
        console.error('Error fetching patients:', error);
        alert('Error fetching patients: ' + error.message);
    } finally {
        hideSpinner();
    }
}

// Update patient list in sidebar (sort by createdAt descending)
function updatePatientList() {
    console.log('Updating patient list...');
    const patientList = document.getElementById('patient-list');
    if (!patientList) {
        console.error('Patient list element not found');
        return;
    }
    patientList.innerHTML = '';
    const filter = document.getElementById('patient-filter')?.value || 'all';
    const filteredPatients = patients.filter(patient => {
        if (filter === 'all') return true;
        const visitType = patient.visitType || 'follow-up';
        return filter === visitType;
    });
    filteredPatients.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    filteredPatients.forEach(patient => {
        const patientItem = document.createElement('div');
        patientItem.className = 'patient-item';
        const initials = patient.name ? patient.name.split(' ').map(word => word[0]).join('').substring(0, 2).toUpperCase() : 'NA';
        const visitType = patient.visitType || 'follow-up';
        const badgeHtml = visitType === 'today' ? `<span class="visit-badge today">Today</span>` : '';
        patientItem.innerHTML = `
            <div class="patient-initials">${initials}</div>
            <div class="patient-info">
                <div class="name">${patient.name || patient.id}${badgeHtml}</div>
                <div class="details">${patient.age ? patient.age + ' years' : 'Age N/A'}, ${patient.medicalHistory || 'No history'}</div>
                <div class="details">Created: ${new Date(patient.createdAt).toLocaleString()}</div>
            </div>
            <button class="delete-btn" data-patient-id="${patient.patientId}">🗑️</button>
        `;
        patientItem.querySelector('.patient-info').addEventListener('click', () => selectPatient(patient));
        patientItem.querySelector('.delete-btn').addEventListener('click', () => deletePatient(patient.patientId));
        patientList.appendChild(patientItem);
    });
    console.log('Patient list updated with', filteredPatients.length, 'patients');
}

// Filter patients based on dropdown selection
function filterPatients() {
    updatePatientList();
}

// Show patient list and hide patient details
function showPatientList(preservePatientId = true) {
    const patientDetails = document.getElementById('patient-details');
    const patientList = document.getElementById('patient-list');
    const transcriptSection = document.getElementById('transcript-section');
    if (patientDetails && patientList && transcriptSection) {
        patientDetails.style.display = 'none';
        patientList.style.display = 'block';
        transcriptSection.style.display = 'block';

        // Add these lines to expand sidebar
        document.getElementById('patient-sidebar').classList.remove('collapsed');
        document.querySelector('.container').classList.remove('patient-view');

        // Hide patient details
        document.getElementById('patient-details').style.display = 'none';

        // Force a reflow
        window.setTimeout(function() {
            window.dispatchEvent(new Event('resize'));
        }, 50);

        // Only reset patient state if preservePatientId is false
        if (!preservePatientId) {
            console.log('Resetting patient state: currentPatientId before reset:', currentPatientId);
            currentPatientId = null;
            currentPatient = null;
            console.log('Resetting patient state: currentPatientId after reset:', currentPatientId);
        } else {
            console.log('Preserving patient state: currentPatientId:', currentPatientId);
        }

        // Reset button states
        const startVisitBtn = document.getElementById('start-visit-btn');
        const submitTranscriptBtn = document.getElementById('submit-transcript-btn');
        const startListeningBtn = document.getElementById('start-listening-btn');
        if (startVisitBtn && submitTranscriptBtn && startListeningBtn) {
            startVisitBtn.disabled = false;
            startVisitBtn.classList.remove('disabled', 'btn-active', 'blink');
            submitTranscriptBtn.disabled = true;
            submitTranscriptBtn.classList.add('disabled');
            submitTranscriptBtn.classList.remove('blink');
            startListeningBtn.disabled = true;
            startListeningBtn.classList.add('disabled');
        }

        // Clear SOAP notes section
        const subjectiveContent = document.getElementById('subjective-content');
        const objectiveContent = document.getElementById('objective-content');
        const assessmentContent = document.getElementById('assessment-content');
        const planContainer = document.getElementById('plan-content-container');
        if (subjectiveContent) subjectiveContent.innerHTML = '';
        if (objectiveContent) objectiveContent.innerHTML = '';
        if (assessmentContent) assessmentContent.innerHTML = '';
        if (planContainer) planContainer.innerHTML = '';

        // Clear AI Insights and References
        const insightsAllergyTriggers = document.getElementById('insights-allergy-triggers');
        const insightsCondition = document.getElementById('insights-condition');
        const insightsRecommendations = document.getElementById('insights-recommendations');
        const referencesTableBody = document.getElementById('references-table-body');
        if (insightsAllergyTriggers) insightsAllergyTriggers.innerHTML = '<p>N/A</p>';
        if (insightsCondition) insightsCondition.innerHTML = '<p>N/A</p>';
        if (insightsRecommendations) {
            insightsRecommendations.innerHTML = '<p>N/A</p>';
            insightsRecommendations.classList.add('bulleted');
        }
        if (referencesTableBody) referencesTableBody.innerHTML = '';

        // Ensure SOAP notes section is visible (will show as empty until a transcript is submitted)
        const notesSection = document.getElementById('notes-section');
        if (notesSection) notesSection.style.display = 'block';

        // Ensure references spinner is hidden since no patient is selected
        hideReferencesSpinner();
    }
}

// Open template selection modal
function openTemplateSelectionModal(callback) {
    const modal = document.createElement('div');
    modal.id = 'template-selection-modal';
    modal.style.position = 'fixed';
    modal.style.top = '50%';
    modal.style.left = '50%';
    modal.style.transform = 'translate(-50%, -50%)';
    modal.style.background = '#fff';
    modal.style.padding = '20px';
    modal.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.1)';
    modal.style.zIndex = '1000';
    modal.style.borderRadius = '8px';
    modal.innerHTML = `
        <h3>Select a Template</h3>
        <select id="template-select">
            ${templates.map(template => `<option value="${template.name}">${template.name} (${template.category})</option>`).join('')}
        </select>
        <button id="select-template-btn" style="margin-top: 10px; padding: 8px 16px; background: #4caf50; color: #fff; border: none; border-radius: 4px; cursor: pointer;">Select</button>
        <button id="cancel-template-btn" style="margin-top: 10px; margin-left: 10px; padding: 8px 16px; background: #e63946; color: #fff; border: none; border-radius: 4px; cursor: pointer;">Cancel</button>
    `;
    document.body.appendChild(modal);

    document.getElementById('select-template-btn').addEventListener('click', () => {
        const selectedTemplateName = document.getElementById('template-select').value;
        currentTemplate = templates.find(template => template.name === selectedTemplateName);
        document.body.removeChild(modal);
        callback();
    });

    document.getElementById('cancel-template-btn').addEventListener('click', () => {
        document.body.removeChild(modal);
        alert('Template selection canceled. Please select a template to start a visit.');
    });
}

// Start a visit
async function startVisit() {
    console.log('Starting visit...');
    console.log('Before starting visit: currentPatientId:', currentPatientId);
    const patientIdInput = document.getElementById('patient-id');
    const patientId = patientIdInput?.value.trim();
    if (!patientId) {
        alert('Please enter a patient name or ID.');
        return;
    }
    // Additional checks for global variables
    if (typeof currentEmail === 'undefined' || currentEmail === null) {
        alert('Current email is not defined. Please ensure you are logged in.');
        return;
    }
    if (typeof currentTenantId === 'undefined' || currentTenantId === null) {
        alert('Tenant ID is not defined. Please ensure you are logged in.');
        return;
    }
    if (typeof templates === 'undefined' || !Array.isArray(templates)) {
        alert('Templates are not defined. Please ensure the application is properly initialized.');
        return;
    }

    // Check for default template
    const defaultTemplate = templates.find(template => template.isDefault);
    if (defaultTemplate) {
        currentTemplate = defaultTemplate;
        console.log('Using default template:', currentTemplate.name);
        await proceedWithVisit(patientId);
    } else {
        console.log('No default template found, prompting for selection');
        openTemplateSelectionModal(() => proceedWithVisit(patientId));
    }
}

// Proceed with visit after template selection
async function proceedWithVisit(patientId) {
    if (!currentTemplate) {
        alert('No template selected. Please select a template to start a visit.');
        return;
    }

    console.log('Starting visit for patient:', patientId, 'with email:', currentEmail, 'and tenantId:', currentTenantId, 'using template:', currentTemplate.name);
    console.log('Before API call: currentPatientId:', currentPatientId);
    showSpinner();
    try {
        const response = await fetch('/api/visit/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ patientId, email: currentEmail, tenantId: currentTenantId })
        });
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const result = await response.json();
        console.log('API response from /api/visit/start:', result);
        if (response.ok && result.success) {
            activeVisitId = result.visitId;
            currentPatientId = result.patientId;
            console.log('Set currentPatientId after visit start:', currentPatientId);
            alert(`Visit started for ${result.patientId} with template ${currentTemplate.name}!`);
            const patientIdInput = document.getElementById('patient-id');
            if (patientIdInput) patientIdInput.value = '';
            const startVisitBtn = document.getElementById('start-visit-btn');
            const submitTranscriptBtn = document.getElementById('submit-transcript-btn');
            const startListeningBtn = document.getElementById('start-listening-btn');
            if (startVisitBtn && submitTranscriptBtn && startListeningBtn) {
                startVisitBtn.disabled = true;
                startVisitBtn.classList.add('disabled');
                startVisitBtn.classList.remove('blink');
                submitTranscriptBtn.disabled = false;
                submitTranscriptBtn.classList.remove('disabled');
                submitTranscriptBtn.classList.add('blink'); // Add blinking effect to guide to submitting
                submitTranscriptBtn.focus(); // Focus on the button to guide the user
                startListeningBtn.disabled = false;
                startListeningBtn.classList.remove('disabled');
            }
            // Ensure fetchPatients completes before proceeding
            await fetchPatients();
            console.log('Updated patients list after fetch:', patients);
            const newPatient = patients.find(p => p.patientId === currentPatientId);
            if (newPatient) {
                console.log('Selecting new patient:', newPatient);
                await selectPatient(newPatient);
            } else {
                console.error('New patient not found in updated list:', currentPatientId);
                alert('Visit started, but patient not found in list. Please refresh the page.');
            }
        } else {
            console.error('API error:', result.error);
            alert('Error: ' + (result.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error starting visit:', error);
        alert('Failed to start visit: ' + error.message);
    } finally {
        hideSpinner();
    }
}

// Select a patient
async function selectPatient(patient) {
    console.log('Before setting patient in selectPatient: currentPatientId:', currentPatientId);
    currentPatientId = patient.patientId;
    currentPatient = patient;
    console.log('After setting patient in selectPatient: currentPatientId:', currentPatientId);
    console.log('Selected patient:', JSON.stringify(patient, null, 2));

    // Show patient details and hide patient list
    const patientDetails = document.getElementById('patient-details');
    const patientList = document.getElementById('patient-list');
    const transcriptSection = document.getElementById('transcript-section');
    if (patientDetails && patientList && transcriptSection) {
        patientDetails.style.display = 'block';
        patientList.style.display = 'none';
        transcriptSection.style.display = 'block';

        // Add these lines to fully collapse sidebar
        document.getElementById('patient-sidebar').classList.add('collapsed');
        document.querySelector('.container').classList.add('patient-view');

        // Show patient details
        document.getElementById('patient-details').style.display = 'block';

        // Force a reflow to ensure the layout updates
        window.setTimeout(function() {
            window.dispatchEvent(new Event('resize'));
        }, 50);

        // Populate patient details
        const nameEl = document.getElementById('patient-details-name');
        const mrnEl = document.getElementById('patient-details-mrn');
        const lastVisitEl = document.getElementById('patient-details-last-visit');
        const currentVisitEl = document.getElementById('patient-details-current-visit');
        const visitHistoryEl = document.getElementById('patient-details-visit-history');

        if (nameEl) nameEl.textContent = patient.name || 'N/A';
        if (mrnEl) mrnEl.textContent = patient.mrn || 'N/A';
        if (lastVisitEl) lastVisitEl.textContent = patient.lastVisit || 'N/A';
        if (currentVisitEl) currentVisitEl.textContent = patient.currentVisit || 'N/A';

        // Populate visit history (mock data for now)
        if (visitHistoryEl) {
            visitHistoryEl.innerHTML = `
                <div>04/15/2025 - Peanut Challenge</div>
                <div>03/22/2025 - Allergy Consult</div>
            `;
        }
    }

    showContentSpinner();
    try {
        const response = await fetch(`/api/get-patient-history?tenantId=${currentTenantId}&patientId=${currentPatientId}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        if (!response.ok) throw new Error('Failed to fetch patient history');
        const data = await response.json();
        console.log('Patient history response:', JSON.stringify(data, null, 2));
        if (!data.transcripts || data.transcripts.length === 0) {
            console.log('No transcripts found for patient:', currentPatientId);
            const notesSection = document.getElementById('notes-section');
            if (notesSection) notesSection.style.display = 'block'; // Ensure it's visible even if empty
            hideContentSpinner();
            return;
        }
        data.transcripts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        data.transcripts.forEach(transcript => {
            if (transcript.soapNotes) {
                latestAnalysis = { soapNotes: transcript.soapNotes, insights: transcript.insights || {} };
                const subjectiveContent = document.getElementById('subjective-content');
                if (subjectiveContent) {
                    const chiefComplaint = transcript.soapNotes.patient_history?.chief_complaint || 'Not specified';
                    const historyOfPresentIllness = transcript.soapNotes.patient_history?.history_of_present_illness || 'Not specified';
                    const pastMedicalHistory = transcript.soapNotes.patient_history?.past_medical_history || 'Not specified';
                    const allergies = transcript.soapNotes.patient_history?.allergies || 'Not specified';
                    const socialHistory = transcript.soapNotes.patient_history?.social_history || 'Not specified';
                    const reviewOfSystems = transcript.soapNotes.patient_history?.review_of_systems || 'Not specified';
                    subjectiveContent.innerHTML = `
                        <strong>Chief Complaint:</strong><br>
                        The patient presents with ${chiefComplaint.toLowerCase()}.<br><br>
                        <strong>History of Present Illness:</strong><br>
                        ${historyOfPresentIllness}. The symptoms have persisted, affecting the patient's daily activities and quality of life. The patient reports the onset and progression of symptoms, including any triggering factors, duration, and associated complaints.<br><br>
                        <strong>Past Medical History:</strong><br>
                        The patient's medical history includes ${pastMedicalHistory.toLowerCase()}. They have a history of managing these conditions, with varying degrees of control and past interventions noted.<br><br>
                        <strong>Allergies:</strong><br>
                        ${allergies}. The patient confirms any known allergic reactions and their severity, which may influence treatment plans.<br><br>
                        <strong>Social History:</strong><br>
                        ${socialHistory}. The patient reports lifestyle factors that may contribute to their condition, including occupational, environmental, and social determinants of health.<br><br>
                        <strong>Review of Systems:</strong><br>
                        ${reviewOfSystems}. Additional symptoms may be present, impacting multiple systems, and are noted for a comprehensive understanding of the patient's health status.
                    `;
                }
                const objectiveContent = document.getElementById('objective-content');
                if (objectiveContent) {
                    const physicalExamination = transcript.soapNotes.physical_examination || 'Not specified';
                    objectiveContent.innerHTML = `
                        <strong>Physical Examination:</strong><br>
                        ${physicalExamination}. Vital signs include blood pressure, heart rate, respiratory rate, and temperature. Physical findings indicate the patient's current health status, with specific attention to respiratory, cardiovascular, ENT, and general appearance. Additional observations include skin condition, neurological status, and musculoskeletal findings.
                    `;
                }
                const assessmentContent = document.getElementById('assessment-content');
                if (assessmentContent) {
                    let assessmentText = transcript.soapNotes.differential_diagnosis || 'Not specified';
                    assessmentText = assessmentText.replace(/\*/g, '<br>*');
                    assessmentContent.innerHTML = `
                        ${assessmentText}<br><br>
                        The assessment considers the patient's symptoms, history, and physical findings to determine potential diagnoses and contributing factors. Differential diagnoses are prioritized based on clinical presentation, with recommendations for further evaluation to confirm the primary diagnosis.
                    `;
                }
                const planContainer = document.getElementById('plan-content-container');
                if (planContainer) {
                    const planText = transcript.soapNotes.plan_of_care || '';
                    console.log('Raw Plan of Care Data (SelectPatient):', JSON.stringify(planText));
                    let planSections = [];
                    if (!planText) {
                        console.log('Plan of Care is empty (SelectPatient)');
                        planSections = [{
                            title: "General Plan",
                            items: ['No specific plan recommendations available. Please follow up with standard care protocols.']
                        }];
                    } else {
                        const sections = planText.split(/(?=In regards to\s+[\w\s]+:)/i).filter(section => section.trim());
                        console.log('Split Plan Sections (SelectPatient):', sections);
                        sections.forEach(section => {
                            const sectionMatch = section.match(/In regards to\s+(.+?)(?::|$)/i);
                            if (sectionMatch) {
                                const title = sectionMatch[1].trim();
                                const items = section.replace(/In regards to\s+.+?(?::|$)/i, '').trim().split('\n').filter(item => item.trim()).map(item => item.replace(/^- /, ''));
                                console.log(`Parsed Section (SelectPatient) - ${title}:`, items);
                                if (items.length > 0) {
                                    planSections.push({ title, items });
                                }
                            }
                        });
                        if (planSections.length === 0 && planText.trim()) {
                            console.log('No "In regards to" sections found (SelectPatient), treating planText as a single section');
                            const items = planText.split(/[\n•-]/).filter(item => item.trim()).map(item => item.trim());
                            planSections = [{ title: "General Plan", items }];
                        }
                    }
                    if (planSections.length === 0) {
                        console.log('No plan sections parsed (SelectPatient), rendering placeholder');
                        planSections = [{ title: "General Plan", items: ['No specific plan recommendations available.'] }];
                    }
                    planContainer.innerHTML = '';
                    planSections.forEach(section => {
                        try {
                            const sectionDiv = document.createElement('div');
                            sectionDiv.className = 'plan-section';
                            const safeTitle = section.title.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
                            sectionDiv.innerHTML = `
                                <h3>In regards to ${section.title}:</h3>
                                <ul id="plan-content-${safeTitle}" data-original-items='${JSON.stringify(section.items)}'>
                                    ${section.items.map(item => `<li>${item.trim()}</li>`).join('')}
                                </ul>
                            `;
                            console.log(`Rendering section (SelectPatient): ${section.title} with items:`, section.items);
                            planContainer.appendChild(sectionDiv);
                        } catch (error) {
                            console.error(`Error rendering section ${section.title} (SelectPatient):`, error);
                        }
                    });
                    planContainer.style.display = 'block';
                } else {
                    console.error('Plan container element not found in DOM (SelectPatient)');
                }
                const insightsAllergyTriggers = document.getElementById('insights-allergy-triggers');
                const insightsCondition = document.getElementById('insights-condition');
                const insightsRecommendations = document.getElementById('insights-recommendations');
                if (insightsAllergyTriggers && insightsCondition && insightsRecommendations) {
                    insightsAllergyTriggers.innerHTML = `<p>${transcript.insights?.allergy_triggers || 'Not specified'}</p>`;
                    insightsCondition.innerHTML = `<p>${transcript.insights?.condition || 'Not specified'}</p>`;
                    const recommendationsItems = (transcript.insights?.recommendations || '').split('\n').filter(item => item.trim());
                    // Initially render as a bulleted list
                    insightsRecommendations.innerHTML = `
                        <ul>
                            ${recommendationsItems.map(item => `<li>${item.trim()}</li>`).join('')}
                        </ul>
                    `;
                    insightsRecommendations.dataset.originalItems = JSON.stringify(recommendationsItems);
                    insightsRecommendations.classList.add('bulleted');
                }
                const notesSection = document.getElementById('notes-section');
                if (notesSection) notesSection.style.display = 'block';
                if (transcript.visitId && transcript.visitId !== 'undefined') {
                    activeVisitId = transcript.visitId;
                    console.log('Set activeVisitId in selectPatient:', activeVisitId);
                    fetchReferences(currentPatientId, activeVisitId);
                } else {
                    console.log('No valid visit ID available for references');
                    // Hide the spinner since no references will be fetched
                    hideReferencesSpinner();
                }
            }
        });

        // Update tooltip visibility after selecting a patient
        if (typeof window.updateTooltipVisibility === 'function') {
            window.updateTooltipVisibility();
        } else {
            console.error('updateTooltipVisibility function not found');
        }
    } catch (error) {
        console.error('Error fetching patient history:', error);
        alert('Error fetching patient history: ' + error.message);
    } finally {
        hideContentSpinner();
    }
}

// Delete a patient
async function deletePatient(patientId) {
    if (!confirm('Are you sure you want to delete this patient and all associated transcripts?')) return;
    showSpinner();
    try {
        const response = await fetch('/api/delete-patient', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: currentEmail, patientId: patientId, tenantId: currentTenantId })
        });
        if (!response.ok) throw new Error('Failed to delete patient');
        const data = await response.json();
        if (data.success) {
            alert('Patient deleted successfully');
            patients = patients.filter(p => p.patientId !== patientId);
            updatePatientList();
            if (currentPatientId === patientId) {
                currentPatientId = null;
                currentPatient = null;
                activeVisitId = null;
                const patientDetails = document.getElementById('patient-details');
                if (patientDetails) patientDetails.style.display = 'none';
                const notesSection = document.getElementById('notes-section');
                if (notesSection) notesSection.style.display = 'block';
                // Hide the references spinner since the patient is deleted
                hideReferencesSpinner();
            }
        } else {
            alert('Failed to delete patient');
        }
    } catch (error) {
        console.error('Error deleting patient:', error);
        alert('Error deleting patient: ' + error.message);
    } finally {
        hideSpinner();
    }
}

// Logout function
function logout() {
    console.log('Logging out...');
    // Clear user data from localStorage
    localStorage.removeItem('user');
    // Reset global variables
    currentEmail = null;
    currentTenantId = null;
    currentRole = null;
    currentPatientId = null;
    currentPatient = null;
    activeVisitId = null;
    patients = [];
    // Redirect to login page
    window.location.href = '/login.html';
}
// Fetch references (using /get-insights)
async function fetchReferences(patientId, visitId) {
    console.log('Fetching references for patient:', patientId, 'visit:', visitId);
    console.log('Current latestAnalysis state:', JSON.stringify(latestAnalysis, null, 2));
    if (!patientId || !visitId) {
        console.log('Patient ID or Visit ID missing, skipping fetchReferences');
        hideReferencesSpinner(); // Ensure spinner is hidden if we skip
        return;
    }

    showReferencesSpinner();

    // Define mock references as a fallback
    const mockReferences = [
        {
            article: "General Allergy Management Strategies",
            author: "Wood RA",
            journal: "Allergy and Asthma Proceedings",
            year: 2017,
            link: "https://pubmed.ncbi.nlm.nih.gov/28234061/"
        },
        {
            article: "Overview of Allergic Reactions",
            author: "Sicherer SH",
            journal: "Journal of Allergy and Clinical Immunology",
            year: 2019,
            link: "https://pubmed.ncbi.nlm.nih.gov/31466691/"
        }
    ];

    try {
        // Extract conditions from latestAnalysis
        let conditions = '';
        if (latestAnalysis && latestAnalysis.soapNotes && latestAnalysis.soapNotes.differential_diagnosis) {
            conditions = latestAnalysis.soapNotes.differential_diagnosis;
            console.log('Conditions extracted for /get-insights:', conditions);
        } else {
            console.warn('latestAnalysis or differential_diagnosis not available, proceeding without conditions', {
                latestAnalysisExists: !!latestAnalysis,
                soapNotesExists: !!(latestAnalysis && latestAnalysis.soapNotes),
                diagnosisExists: !!(latestAnalysis && latestAnalysis.soapNotes && latestAnalysis.soapNotes.differential_diagnosis)
            });
        }

        // Construct the URL with conditions parameter
        const queryParams = new URLSearchParams({
            patient_id: patientId,
            visit_id: visitId
        });
        if (conditions) {
            queryParams.append('conditions', conditions);
        }
        const url = `/get-insights?${queryParams.toString()}`;
        console.log('Fetching references from:', url);

        // Attempt to fetch references from the backend
        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        if (!response.ok) throw new Error(`Failed to fetch references: ${response.statusText}`);
        const data = await response.json();
        console.log('References API response:', data);

        let references = [];
        if (data.insights && data.insights.length > 0) {
            // Map the backend insights to the frontend format
            references = data.insights.map(insight => ({
                article: insight.title || 'N/A',
                author: insight.summary ? insight.summary.split(' ').slice(0, 2).join(' ') : 'Unknown Author', // Placeholder author extraction
                journal: 'PubMed', // Since it's from PubMed
                year: new Date().getFullYear(), // Placeholder year
                link: insight.url || '#'
            }));
        } else {
            console.log('No insights returned from API, using mock references');
            references = mockReferences;
        }

        const tableBody = document.getElementById('references-table-body');
        if (tableBody) {
            console.log('Populating references table with data:', references);
            tableBody.innerHTML = references.map(ref => `
                <tr>
                    <td>${ref.article}</td>
                    <td>${ref.author}</td>
                    <td>${ref.journal}</td>
                    <td>${ref.year}</td>
                    <td><a href="${ref.link}" target="_blank">Link</a></td>
                </tr>
            `).join('');
        } else {
            console.error('References table body not found in DOM');
        }
    } catch (error) {
        console.error('Error fetching references:', error);
        // Use mock data as a fallback
        const tableBody = document.getElementById('references-table-body');
        if (tableBody) {
            console.log('Populating references table with mock data:', mockReferences);
            tableBody.innerHTML = mockReferences.map(ref => `
                <tr>
                    <td>${ref.article}</td>
                    <td>${ref.author}</td>
                    <td>${ref.journal}</td>
                    <td>${ref.year}</td>
                    <td><a href="${ref.link}" target="_blank">Link</a></td>
                </tr>
            `).join('');
        } else {
            console.error('References table body not found in DOM');
        }
    } finally {
        hideReferencesSpinner();
    }
}

// Copy the content of a section to clipboard
function copySection(sectionId) {
    let text = '';
    if (sectionId === 'subjective') {
        const content = document.getElementById('subjective-content').textContent;
        text = `SUBJECTIVE\n\n${content}`;
    } else if (sectionId === 'objective') {
        const content = document.getElementById('objective-content').textContent;
        text = `OBJECTIVE\n\n${content}`;
    } else if (sectionId === 'assessment') {
        const content = document.getElementById('assessment-content').textContent;
        text = `ASSESSMENT\n\n${content}`;
    } else if (sectionId === 'plan') {
        const planContainer = document.getElementById('plan-content-container');
        let planContent = '';
        if (planContainer) {
            const sections = planContainer.querySelectorAll('.plan-section');
            sections.forEach(section => {
                const title = section.querySelector('h3').textContent;
                const items = Array.from(section.querySelector('ul').querySelectorAll('li')).map(li => li.textContent).join('\n');
                planContent += `${title}\n${items}\n\n`;
            });
        }
        text = `PLAN\n\n${planContent}`;
    } else if (sectionId === 'insights') {
        const allergyTriggers = document.getElementById('insights-allergy-triggers').textContent;
        const condition = document.getElementById('insights-condition').textContent;
        const recommendations = document.getElementById('insights-recommendations').textContent;
        text = `AI INSIGHTS\n\nAllergy Triggers:\n${allergyTriggers}\n\nCondition:\n${condition}\n\nRecommendations:\n${recommendations}`;
    } else {
        const content = document.getElementById(sectionId);
        if (content) text = content.textContent;
    }
    navigator.clipboard.writeText(text).then(() => {
        alert('Section copied to clipboard!');
    }).catch(error => {
        alert('Error copying section: ' + error.message);
    });
}

// Copy all SOAP notes
function copySOAP() {
    const subjectiveContent = document.getElementById('subjective-content')?.textContent || 'N/A';
    const objectiveContent = document.getElementById('objective-content')?.textContent || 'N/A';
    const assessmentContent = document.getElementById('assessment-content')?.textContent || 'N/A';
    const planContainer = document.getElementById('plan-content-container');
    let planContent = '';
    if (planContainer) {
        const sections = planContainer.querySelectorAll('.plan-section');
        sections.forEach(section => {
            const title = section.querySelector('h3').textContent;
            const items = Array.from(section.querySelector('ul').querySelectorAll('li')).map(li => li.textContent).join('\n');
            planContent += `${title}\n${items}\n\n`;
        });
    }
    const insightsAllergyTriggers = document.getElementById('insights-allergy-triggers')?.textContent || 'N/A';
    const insightsCondition = document.getElementById('insights-condition')?.textContent || 'N/A';
    const insightsRecommendations = document.getElementById('insights-recommendations')?.textContent || 'N/A';
    const soapContent = `
SUBJECTIVE
${subjectiveContent}

OBJECTIVE
${objectiveContent}

ASSESSMENT
${assessmentContent}

PLAN
${planContent}

AI INSIGHTS
Allergy Triggers: ${insightsAllergyTriggers}
Condition: ${insightsCondition}
Recommendations: ${insightsRecommendations}
    `;
    navigator.clipboard.writeText(soapContent).then(() => {
        alert('SOAP notes copied to clipboard!');
    }).catch(error => {
        alert('Error copying SOAP notes: ' + error.message);
    });
}

// Edit the content of a SOAP section by opening the modal
function editSection(sectionId) {
    console.log(`editSection called with sectionId: ${sectionId}`);
    // Open the modal with the specified section
    openEditModal(sectionId);
}

// Add the editPlanSection function
function editPlanSection() {
    console.log('editPlanSection called');
    const planContainer = document.getElementById('plan-content-container');

    if (!planContainer) {
        console.error('Plan container not found');
        return;
    }

    const originalContent = planContainer.innerHTML;
    planContainer.dataset.originalContent = originalContent;

    const currentContent = planContainer.innerText;
    planContainer.innerHTML = `
        <textarea id="plan-edit-textarea" style="width: 100%; height: 200px; padding: 8px; margin-bottom: 10px;">${currentContent}</textarea>
        <div class="edit-buttons">
            <button class="save-btn">Save</button>
            <button class="cancel-btn">Cancel</button>
        </div>
    `;

    planContainer.classList.add('editing');

    // Add event listeners for the Save and Cancel buttons
    const saveBtn = planContainer.querySelector('.save-btn');
    const cancelBtn = planContainer.querySelector('.cancel-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', savePlanSection);
    }
    if (cancelBtn) {
        cancelBtn.addEventListener('click', cancelPlanEdit);
    }
}

// Improved function to load section content when section is selected
function loadSectionContent() {
    const sectionId = document.getElementById('separate-section-select').value;
    const preview = document.getElementById('separate-preview');
    const textarea = document.getElementById('separate-input');

    // Get the content from the selected section
    const contentElement = document.getElementById(sectionId);
    if (contentElement) {
        // Get the current content as plain text
        const plainText = contentElement.innerText || '';

        // Set content in textarea for editing
        textarea.value = plainText;

        // Show preview of current content
        preview.innerHTML = contentElement.innerHTML || '';
    } else {
        // Handle case where the section is not found
        textarea.value = '';
        preview.innerHTML = '<p>No content found for this section</p>';
    }
}

// Make sure to call loadSectionContent when edit modal is opened
function openEditModal(sectionId) {
    const modal = document.getElementById('separate-modal');
    const sectionSelect = document.getElementById('separate-section-select');

    // Set the appropriate section in dropdown if specified
    if (sectionId) {
        // Adjust sectionId to match the dropdown value (e.g., 'subjective' -> 'subjective-content')
        let sectionValue;
        if (sectionId === 'plan') {
            sectionValue = 'plan-content-container';
        } else if (sectionId === 'insights') {
            sectionValue = 'insights-recommendations';
        } else {
            sectionValue = `${sectionId}-content`;
        }
        for (let i = 0; i < sectionSelect.options.length; i++) {
            if (sectionSelect.options[i].value === sectionValue) {
                sectionSelect.selectedIndex = i;
                break;
            }
        }
    }

    // Load the selected section's content
    loadSectionContent();

    // Show the modal
    modal.style.display = 'block';
}

// Apply the edited content from the modal
function applySeparateEdits() {
    console.log('Applying separate edits');
    const sectionId = document.getElementById('separate-section-select').value;
    const textarea = document.getElementById('separate-input');
    const contentElement = document.getElementById(sectionId);

    if (!contentElement) {
        console.error(`Section with ID ${sectionId} not found`);
        alert('Error: Section not found.');
        return;
    }

    const editedContent = textarea.value.trim();

    if (sectionId === 'plan-content-container') {
        // Parse the edited content back into plan sections
        const planSections = editedContent.split(/\n\s*\n/).filter(section => section.trim());
        contentElement.innerHTML = '';

        if (planSections.length === 0) {
            contentElement.innerHTML = `
                <div class="plan-section">
                    <h3>In regards to General Plan:</h3>
                    <ul id="plan-content-general-plan">
                        <li>No specific plan recommendations available.</li>
                    </ul>
                </div>
            `;
        } else {
            planSections.forEach(sectionText => {
                const lines = sectionText.split('\n').filter(line => line.trim());
                if (lines.length === 0) return;

                let title, items;

                if (lines[0].includes('In regards to') || lines[0].includes(':')) {
                    title = lines[0];
                    items = lines.slice(1).map(item => item.replace(/^[-*•]\s*/, '')).filter(item => item.trim());
                } else {
                    title = 'In regards to General Plan:';
                    items = lines.map(item => item.replace(/^[-*•]\s*/, '')).filter(item => item.trim());
                }

                if (items.length === 0) {
                    items = ['No specific plan recommendations available.'];
                }

                const safeTitle = title.replace(/In regards to\s+/i, '').replace(/:/g, '').replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
                const sectionDiv = document.createElement('div');
                sectionDiv.className = 'plan-section';
                sectionDiv.innerHTML = `
                    <h3>${title}</h3>
                    <ul id="plan-content-${safeTitle}" data-original-items='${JSON.stringify(items)}'>
                        ${items.map(item => `<li>${item}</li>`).join('')}
                    </ul>
                `;
                contentElement.appendChild(sectionDiv);
            });
        }
    } else if (sectionId === 'insights-recommendations') {
        // Handle the recommendations section, which may be bulleted
        const isBulleted = contentElement.classList.contains('bulleted');
        const items = editedContent.split('\n').filter(item => item.trim());
        if (isBulleted) {
            contentElement.innerHTML = `
                <ul>
                    ${items.map(item => `<li>${item}</li>`).join('')}
                </ul>
            `;
        } else {
            contentElement.innerHTML = items.map(item => `<p>${item}</p>`).join('');
        }
        contentElement.dataset.originalItems = JSON.stringify(items);
    } else {
        // For other sections, format the edited content into paragraphs
        const formattedContent = editedContent.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .map(line => `<p>${line}</p>`)
            .join('');
        contentElement.innerHTML = formattedContent;
    }

    // Add success animation
    contentElement.classList.add('success-pulse');
    setTimeout(() => {
        contentElement.classList.remove('success-pulse');
    }, 1500);

    // Update backend if needed
    updateNotesOnBackend();

    // Close the modal
    closeSeparateModal();
}

// Close the separate modal
function closeSeparateModal() {
    const modal = document.getElementById('separate-modal');
    if (modal) {
        modal.style.display = 'none';
        // Reset the modal content
        document.getElementById('separate-input').value = '';
        document.getElementById('separate-preview').innerHTML = '';
    }
}

// Save the edited content of a SOAP section (retained for compatibility with inline editing)
function saveSection(sectionId) {
    console.log(`saveSection called for ${sectionId}`);

    const contentElement = document.getElementById(`${sectionId}-content`);

    if (!contentElement) {
        console.error(`Content element for ${sectionId} not found`);
        return;
    }

    const textarea = contentElement.querySelector('#plan-edit-textarea') || contentElement.querySelector('.edit-textarea');
    if (!textarea) {
        console.error('Textarea not found in section');
        return;
    }

    const editedContent = textarea.value.trim();

    // Remove editing state
    contentElement.classList.remove('editing');

    // Format content with paragraphs
    const formattedContent = editedContent.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(line => `<p>${line}</p>`)
        .join('');

    contentElement.innerHTML = formattedContent;

    // Add success animation
    contentElement.classList.add('success-pulse');
    setTimeout(() => {
        contentElement.classList.remove('success-pulse');
    }, 1500);

    // Update backend if needed
    updateNotesOnBackend();
}

// Save the edited plan section (retained for compatibility with inline editing)
function savePlanSection() {
    console.log('Saving plan section');
    const planContainer = document.getElementById('plan-content-container');

    if (!planContainer) {
        console.error('Plan container not found');
        return;
    }

    const textarea = planContainer.querySelector('#plan-edit-textarea');
    if (!textarea) {
        console.error('Textarea not found in plan section');
        return;
    }

    const editedContent = textarea.value.trim();

    // Remove editing state
    planContainer.classList.remove('editing');

    // Parse the edited content back into plan sections
    const planSections = editedContent.split(/\n\s*\n/).filter(section => section.trim());
    planContainer.innerHTML = '';

    if (planSections.length === 0) {
        // If no content, add a default empty section
        planContainer.innerHTML = `
            <div class="plan-section">
                <h3>In regards to General Plan:</h3>
                <ul id="plan-content-general-plan">
                    <li>No specific plan recommendations available.</li>
                </ul>
            </div>
        `;
    } else {
        planSections.forEach(sectionText => {
            const lines = sectionText.split('\n').filter(line => line.trim());
            if (lines.length === 0) return;

            let title, items;

            // Check if first line looks like a title
            if (lines[0].includes('In regards to') || lines[0].includes(':')) {
                title = lines[0];
                items = lines.slice(1).map(item => item.replace(/^[-*•]\s*/, '')).filter(item => item.trim());
            } else {
                title = 'In regards to General Plan:';
                items = lines.map(item => item.replace(/^[-*•]\s*/, '')).filter(item => item.trim());
            }

            // If no items found, add a default one
            if (items.length === 0) {
                items = ['No specific plan recommendations available.'];
            }

            const safeTitle = title.replace(/In regards to\s+/i, '').replace(/:/g, '').replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
            const sectionDiv = document.createElement('div');
            sectionDiv.className = 'plan-section';
            sectionDiv.innerHTML = `
                <h3>${title}</h3>
                <ul id="plan-content-${safeTitle}" data-original-items='${JSON.stringify(items)}'>
                    ${items.map(item => `<li>${item}</li>`).join('')}
                </ul>
            `;
            planContainer.appendChild(sectionDiv);
        });
    }

    // Add success animation
    planContainer.classList.add('success-pulse');
    setTimeout(() => {
        planContainer.classList.remove('success-pulse');
    }, 1500);

    // Update backend if needed
    updateNotesOnBackend();
}

// Cancel editing a SOAP section (retained for compatibility with inline editing)
function cancelEdit(sectionId) {
    console.log(`cancelEdit called for ${sectionId}`);

    const contentElement = document.getElementById(`${sectionId}-content`);

    if (!contentElement) {
        console.error(`Content element for ${sectionId} not found`);
        return;
    }

    // Remove editing state
    contentElement.classList.remove('editing');

    // Restore original content from dataset
    if (contentElement.dataset.originalContent) {
        contentElement.innerHTML = contentElement.dataset.originalContent;
        delete contentElement.dataset.originalContent;
    } else {
        // Fallback using latestAnalysis if available
        if (latestAnalysis && latestAnalysis.soapNotes) {
            if (sectionId === 'subjective') {
                const chiefComplaint = latestAnalysis.soapNotes.patient_history?.chief_complaint || 'Not specified';
                const historyOfPresentIllness = latestAnalysis.soapNotes.patient_history?.history_of_present_illness || 'Not specified';
                const pastMedicalHistory = latestAnalysis.soapNotes.patient_history?.past_medical_history || 'Not specified';
                const allergies = latestAnalysis.soapNotes.patient_history?.allergies || 'Not specified';
                const socialHistory = latestAnalysis.soapNotes.patient_history?.social_history || 'Not specified';
                const reviewOfSystems = latestAnalysis.soapNotes.patient_history?.review_of_systems || 'Not specified';
                contentElement.innerHTML = `
                    <strong>Chief Complaint:</strong><br>
                    The patient presents with ${chiefComplaint.toLowerCase()}.<br><br>
                    <strong>History of Present Illness:</strong><br>
                    ${historyOfPresentIllness}. The symptoms have persisted, affecting the patient's daily activities and quality of life. The patient reports the onset and progression of symptoms, including any triggering factors, duration, and associated complaints.<br><br>
                    <strong>Past Medical History:</strong><br>
                    The patient's medical history includes ${pastMedicalHistory.toLowerCase()}. They have a history of managing these conditions, with varying degrees of control and past interventions noted.<br><br>
                    <strong>Allergies:</strong><br>
                    ${allergies}. The patient confirms any known allergic reactions and their severity, which may influence treatment plans.<br><br>
                    <strong>Social History:</strong><br>
                    ${socialHistory}. The patient reports lifestyle factors that may contribute to their condition, including occupational, environmental, and social determinants of health.<br><br>
                    <strong>Review of Systems:</strong><br>
                    ${reviewOfSystems}. Additional symptoms may be present, impacting multiple systems, and are noted for a comprehensive understanding of the patient's health status.
                `;
            } else if (sectionId === 'objective') {
                const physicalExamination = latestAnalysis.soapNotes.physical_examination || 'Not specified';
                contentElement.innerHTML = `
                    <strong>Physical Examination:</strong><br>
                    ${physicalExamination}. Vital signs include blood pressure, heart rate, respiratory rate, and temperature. Physical findings indicate the patient's current health status, with specific attention to respiratory, cardiovascular, ENT, and general appearance. Additional observations include skin condition, neurological status, and musculoskeletal findings.
                `;
            } else if (sectionId === 'assessment') {
                let assessmentText = latestAnalysis.soapNotes.differential_diagnosis || 'Not specified';
                assessmentText = assessmentText.replace(/\*/g, '<br>*');
                contentElement.innerHTML = `
                    ${assessmentText}<br><br>
                    The assessment considers the patient's symptoms, history, and physical findings to determine potential diagnoses and contributing factors. Differential diagnoses are prioritized based on clinical presentation, with recommendations for further evaluation to confirm the primary diagnosis.
                `;
            }
        }
    }
}

// Cancel editing the plan section (retained for compatibility with inline editing)
function cancelPlanEdit() {
    console.log('Canceling plan edit');
    const planContainer = document.getElementById('plan-content-container');

    if (!planContainer) {
        console.error('Plan container not found');
        return;
    }

    // Remove editing state
    planContainer.classList.remove('editing');

    // Restore original content from dataset
    if (planContainer.dataset.originalContent) {
        planContainer.innerHTML = planContainer.dataset.originalContent;
        delete planContainer.dataset.originalContent;
    } else {
        // Fallback using latestAnalysis if available
        if (latestAnalysis && latestAnalysis.soapNotes) {
            const planText = latestAnalysis.soapNotes.plan_of_care || '';
            let planSections = [];

            if (!planText) {
                planSections = [{
                    title: "General Plan",
                    items: ['No specific plan recommendations available. Please follow up with standard care protocols.']
                }];
            } else {
                const sections = planText.split(/(?=In regards to\s+[\w\s]+:)/i).filter(section => section.trim());
                sections.forEach(section => {
                    const sectionMatch = section.match(/In regards to\s+(.+?)(?::|$)/i);
                    if (sectionMatch) {
                        const title = sectionMatch[1].trim();
                        const items = section.replace(/In regards to\s+.+?(?::|$)/i, '').trim().split('\n').filter(item => item.trim()).map(item => item.replace(/^- /, ''));
                        if (items.length > 0) {
                            planSections.push({ title, items });
                        }
                    }
                });

                if (planSections.length === 0 && planText.trim()) {
                    const items = planText.split(/[\n•-]/).filter(item => item.trim()).map(item => item.trim());
                    planSections = [{ title: "General Plan", items }];
                }
            }

            if (planSections.length === 0) {
                planSections = [{ title: "General Plan", items: ['No specific plan recommendations available.'] }];
            }

            planContainer.innerHTML = '';
            planSections.forEach(section => {
                const sectionDiv = document.createElement('div');
                sectionDiv.className = 'plan-section';
                const safeTitle = section.title.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
                sectionDiv.innerHTML = `
                    <h3>In regards to ${section.title}:</h3>
                    <ul id="plan-content-${safeTitle}" data-original-items='${JSON.stringify(section.items)}'>
                        ${section.items.map(item => `<li>${item.trim()}</li>`).join('')}
                    </ul>
                `;
                planContainer.appendChild(sectionDiv);
            });
        }
    }
}

// Helper function to update notes on the backend
function updateNotesOnBackend() {
    // Only proceed if we have active visit and patient
    if (!activeVisitId || !currentPatientId) {
        console.log('No active visit or patient, skipping backend update');
        return;
    }

    // Collect all section content
    const updatedNotes = {
        subjective: document.getElementById('subjective-content')?.innerText || '',
        objective: document.getElementById('objective-content')?.innerText || '',
        assessment: document.getElementById('assessment-content')?.innerText || '',
        plan: document.getElementById('plan-content-container')?.innerText || ''
    };

    // Send to backend
    fetch('/api/update-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            patientId: currentPatientId,
            visitId: activeVisitId,
            notes: updatedNotes,
            tenantId: currentTenantId
        })
    })
    .then(response => {
        if (!response.ok) throw new Error('Failed to save updated notes');
        return response.json();
    })
    .then(data => {
        console.log('Notes updated successfully:', data);
    })
    .catch(error => {
        console.error('Error saving updated notes:', error);
        // Don't show alert to avoid disrupting the user experience
    });
}

// Toggle bullet points in the Recommendations section
function toggleBullets() {
    console.log('toggleBullets called');
    const recommendations = document.getElementById('insights-recommendations');
    const bulletToggleBtn = document.getElementById('insights-bullet-toggle');
    if (recommendations && bulletToggleBtn) {
        const isBulleted = recommendations.classList.contains('bulleted');
        const originalItems = JSON.parse(recommendations.dataset.originalItems || '[]');

        if (isBulleted) {
            // Switch to non-bulleted format
            recommendations.classList.remove('bulleted');
            recommendations.innerHTML = originalItems.map(item => `<p>${item.trim()}</p>`).join('');
            bulletToggleBtn.classList.remove('active');
            bulletToggleBtn.textContent = 'Bullet';
        } else {
            // Switch to bulleted format
            recommendations.classList.add('bulleted');
            recommendations.innerHTML = `
                <ul>
                    ${originalItems.map(item => `<li>${item.trim()}</li>`).join('')}
                </ul>
            `;
            bulletToggleBtn.classList.add('active');
            bulletToggleBtn.textContent = 'Unbullet';
        }
    } else {
        console.error('Recommendations section or bullet toggle button not found');
    }
}

// Toggle detail level in the Recommendations section
function toggleDetail() {
    console.log('toggleDetail called');
    const recommendations = document.getElementById('insights-recommendations');
    const detailToggleBtn = document.getElementById('insights-detail-toggle');
    if (recommendations && detailToggleBtn) {
        const isDetailed = recommendations.classList.contains('detailed');
        const originalItems = JSON.parse(recommendations.dataset.originalItems || '[]');

        if (isDetailed) {
            // Switch to summary mode
            recommendations.classList.remove('detailed');
            recommendations.classList.add('summary');
            // For simplicity, we'll keep the content the same but toggle the class
            if (recommendations.classList.contains('bulleted')) {
                recommendations.innerHTML = `
                    <ul>
                        ${originalItems.map(item => `<li>${item.trim()}</li>`).join('')}
                    </ul>
                `;
            } else {
                recommendations.innerHTML = originalItems.map(item => `<p>${item.trim()}</p>`).join('');
            }
            detailToggleBtn.classList.remove('active');
            detailToggleBtn.textContent = 'Detailed';
        } else {
            // Switch to detailed mode
            recommendations.classList.remove('summary');
            recommendations.classList.add('detailed');
            if (recommendations.classList.contains('bulleted')) {
                recommendations.innerHTML = `
                    <ul>
                        ${originalItems.map(item => `<li>${item.trim()}</li>`).join('')}
                    </ul>
                `;
            } else {
                recommendations.innerHTML = originalItems.map(item => `<p>${item.trim()}</p>`).join('');
            }
            detailToggleBtn.classList.add('active');
            detailToggleBtn.textContent = 'Concise';
        }
    } else {
        console.error('Recommendations section or detail toggle button not found');
    }
}

// Toggle bullet points in the Plan section
function togglePlanBullets() {
    console.log('togglePlanBullets called');
    const planContainer = document.getElementById('plan-content-container');
    const bulletToggleBtn = document.getElementById('plan-bullet-toggle');
    if (planContainer && bulletToggleBtn) {
        const isBulleted = planContainer.classList.contains('bulleted');
        const sections = planContainer.querySelectorAll('.plan-section');

        sections.forEach(section => {
            const ulElement = section.querySelector('ul') || section.querySelector('div');
            if (ulElement && ulElement.dataset.originalItems) {
                const items = JSON.parse(ulElement.dataset.originalItems);
                if (isBulleted) {
                    // Switch to non-bulleted format
                    const pElements = items.map(item => `<p>${item.trim()}</p>`).join('');
                    const newDiv = document.createElement('div');
                    newDiv.innerHTML = pElements;
                    ulElement.parentNode.replaceChild(newDiv, ulElement);
                } else {
                    // Switch to bulleted format
                    const ul = document.createElement('ul');
                    ul.id = ulElement.id;
                    ul.dataset.originalItems = JSON.stringify(items);
                    ul.innerHTML = items.map(item => `<li>${item.trim()}</li>`).join('');
                    ulElement.parentNode.replaceChild(ul, ulElement);
                }
            }
        });

        if (isBulleted) {
            planContainer.classList.remove('bulleted');
            bulletToggleBtn.classList.remove('active');
            bulletToggleBtn.textContent = 'Bullet';
        } else {
            planContainer.classList.add('bulleted');
            bulletToggleBtn.classList.add('active');
            bulletToggleBtn.textContent = 'Unbullet';
        }
    } else {
        console.error('Plan container or bullet toggle button not found');
    }
}

// Toggle detail level in the Plan section
function togglePlanDetail() {
    console.log('togglePlanDetail called');
    const planContainer = document.getElementById('plan-content-container');
    const detailToggleBtn = document.getElementById('plan-detail-toggle');
    if (planContainer && detailToggleBtn) {
        const isDetailed = planContainer.classList.contains('detailed');
        const sections = planContainer.querySelectorAll('.plan-section');

        sections.forEach(section => {
            const contentElement = section.querySelector('ul') || section.querySelector('div');
            if (contentElement && contentElement.dataset.originalItems) {
                const items = JSON.parse(contentElement.dataset.originalItems);
                if (isDetailed) {
                    // Switch to summary mode
                    if (items.length > 0) {
                        if (contentElement.tagName.toLowerCase() === 'ul') {
                            contentElement.innerHTML = `<li>${items[0]}</li>`;
                        } else {
                            contentElement.innerHTML = `<p>${items[0]}</p>`;
                        }
                    }
                } else {
                    // Switch to detailed mode
                    if (contentElement.tagName.toLowerCase() === 'ul') {
                        contentElement.innerHTML = items.map(item => `<li>${item.trim()}</li>`).join('');
                    } else {
                        contentElement.innerHTML = items.map(item => `<p>${item.trim()}</p>`).join('');
                    }
                }
            }
        });

        if (isDetailed) {
            planContainer.classList.remove('detailed');
            planContainer.classList.add('summary');
            detailToggleBtn.classList.remove('active');
            detailToggleBtn.textContent = 'Detailed';
        } else {
            planContainer.classList.remove('summary');
            planContainer.classList.add('detailed');
            detailToggleBtn.classList.add('active');
            detailToggleBtn.textContent = 'Concise';
        }
    } else {
        console.error('Plan container or detail toggle button not found');
    }
}

// Expose functions to the global scope for access in script-core.js and index.html
window.fetchPatients = fetchPatients;
window.showPatientList = showPatientList;
window.copySection = copySection;
window.copySOAP = copySOAP;
window.editSection = editSection;
window.saveSection = saveSection
