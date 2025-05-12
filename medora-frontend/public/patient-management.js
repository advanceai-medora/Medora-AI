console.log('patient-management.js loaded');
console.log('patient-management.js version: 1.2.5'); // Updated version to confirm deployment

// Initialize user data on page load to ensure correct tenantID
function initializeUserData() {
    try {
        // Get user data from localStorage or wherever you store it
        const userData = JSON.parse(localStorage.getItem('user') || '{}');
        
        // Set the email as the tenantID - this is critical for your DynamoDB GSI
        currentEmail = userData.email || null;
        currentTenantId = userData.email || null; // TenantID must be the email to match DynamoDB GSI
        currentRole = userData.role || null;
        
        console.log('Initialized user data:', { 
            currentEmail, 
            currentTenantId, 
            currentRole 
        });
        
        // Return true if initialization was successful
        return (currentEmail !== null && currentTenantId !== null);
    } catch (error) {
        console.error('Error initializing user data:', error.message);
        return false;
    }
}

// Fetch patients from backend
async function fetchPatients() {
    console.log('Fetching patients for tenant:', currentTenantId);
    window.showSpinner();
    try {
        // Ensure tenantID is set correctly for DynamoDB GSI
        if (typeof currentTenantId === 'undefined' || currentTenantId === null) {
            // If currentTenantId isn't set but email is available, use email
            if (typeof currentEmail !== 'undefined' && currentEmail !== null) {
                currentTenantId = currentEmail;
                console.log('Setting tenantID to email for DynamoDB GSI compatibility:', currentTenantId);
            } else {
                throw new Error('Tenant ID is not defined. Please ensure you are logged in.');
            }
        } else if (currentTenantId !== currentEmail && currentEmail !== null) {
            // If tenantID doesn't match email, update it (they should always match)
            console.warn('TenantID doesn\'t match email, updating for GSI compatibility:', {
                oldTenantId: currentTenantId,
                newTenantId: currentEmail
            });
            currentTenantId = currentEmail;
        }
        
        // Log the exact API URL being called
        const apiUrl = `/api/get-patients?tenantId=${encodeURIComponent(currentTenantId)}`;
        console.log('API call to match DynamoDB GSI query:', apiUrl);
        
        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! Status: ${response.status}, Status Text: ${response.statusText}, Response: ${errorText}`);
        }
        
        const data = await response.json();
        console.log('Patient data received from API:', {
            patientCount: data.patients?.length || 0,
            success: data.success
        });
        
        patients = data.patients || [];
        updatePatientList();
    } catch (error) {
        console.error('Error fetching patients:', error.message);
        alert('Error fetching patients: ' + error.message);
    } finally {
        window.hideSpinner();
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
        return filter === 'today' ? visitType === 'today' : visitType === 'follow-up';
    });
    filteredPatients.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    filteredPatients.forEach(patient => {
        const patientItem = document.createElement('div');
        patientItem.className = 'patient-item';
        // Fixed line to properly handle non-string patient name values
        const initials = (patient.name && typeof patient.name === 'string') ? 
            patient.name.split(' ').map(word => word[0]).join('').substring(0, 2).toUpperCase() : 'NA';
        const visitType = patient.visitType || 'follow-up';
        const badgeHtml = visitType === 'today' ? `<span class="visit-badge today">Today</span>` : '';
        // Ensure createdAt is parsed as UTC and formatted in Eastern Time
        const createdAtDate = new Date(patient.createdAt + (patient.createdAt.endsWith('Z') ? '' : 'Z')); // Ensure UTC
        const createdAtFormatted = createdAtDate.toLocaleString('en-US', {
            timeZone: 'America/New_York',
            month: '2-digit',
            day: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        }).replace(',', '');
        // Determine if it's DST to set the correct timezone label
        const isDST = (date) => {
            const jan = new Date(date.getFullYear(), 0, 1);
            const jul = new Date(date.getFullYear(), 6, 1);
            const stdOffset = Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
            return date.getTimezoneOffset() < stdOffset ? 'EDT' : 'EST';
        };
        const timezoneLabel = isDST(createdAtDate);
        console.log(`[DEBUG] Rendering patient ${patient.name || patient.id}: createdAt=${patient.createdAt}, formatted=${createdAtFormatted} ${timezoneLabel}`);
        patientItem.innerHTML = `
            <div class="patient-initials">${initials}</div>
            <div class="patient-info">
                <div class="name">${patient.name || patient.id}${badgeHtml}</div>
                <div class="details">${patient.age ? patient.age + ' years' : 'Age N/A'}, ${patient.medicalHistory || 'No history'}</div>
                <div class="details">Created: ${createdAtFormatted} ${timezoneLabel}</div>
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
    console.log('Entering showPatientList, preservePatientId:', preservePatientId);
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

        // Reset button states and transcript input
        const startVisitBtn = document.getElementById('start-visit-btn');
        const submitTranscriptBtn = document.getElementById('submit-transcript-btn');
        const startListeningBtn = document.getElementById('start-listening-btn');
        const stopListeningBtn = document.getElementById('stop-listening-btn');
        const transcriptInput = document.getElementById('transcript-input');
        if (startVisitBtn && submitTranscriptBtn && startListeningBtn && stopListeningBtn && transcriptInput) {
            startVisitBtn.disabled = false;
            startVisitBtn.classList.remove('disabled', 'btn-active', 'blink');
            submitTranscriptBtn.disabled = true;
            submitTranscriptBtn.classList.add('disabled');
            submitTranscriptBtn.classList.remove('blink');
            startListeningBtn.disabled = false; // Enable Start Listening
            startListeningBtn.classList.remove('disabled');
            stopListeningBtn.disabled = true; // Disable Stop Listening initially
            stopListeningBtn.classList.add('disabled');
            // Clear the transcript input for a fresh start
            transcriptInput.value = '';
            console.log('Cleared transcript input for new visit, current value:', transcriptInput.value);
            // Reset the transcript state in script-transcript.js
            if (typeof window.resetTranscript === 'function') {
                window.resetTranscript();
                console.log('Called resetTranscript to clear speech recognition state');
            } else {
                console.error('resetTranscript function not found');
            }
            console.log('Buttons reset in showPatientList:', {
                startVisitBtn: { disabled: startVisitBtn.disabled, classList: startVisitBtn.classList.toString() },
                submitTranscriptBtn: { disabled: submitTranscriptBtn.disabled, classList: submitTranscriptBtn.classList.toString() },
                startListeningBtn: { disabled: startListeningBtn.disabled, classList: startListeningBtn.classList.toString() },
                stopListeningBtn: { disabled: stopListeningBtn.disabled, classList: stopListeningBtn.classList.toString() }
            });
        } else {
            console.error('Required elements not found in showPatientList:', {
                startVisitBtn: !!startVisitBtn,
                submitTranscriptBtn: !!submitTranscriptBtn,
                startListeningBtn: !!startListeningBtn,
                stopListeningBtn: !!stopListeningBtn,
                transcriptInput: !!transcriptInput
            });
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
        window.hideReferencesSpinner();
    } else {
        console.error('Required elements not found:', {
            patientDetails: !!patientDetails,
            patientList: !!patientList,
            transcriptSection: !!transcriptSection
        });
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
    
    // Ensure tenantID is set correctly for DynamoDB GSI
    if (typeof currentTenantId === 'undefined' || currentTenantId === null) {
        if (typeof currentEmail !== 'undefined' && currentEmail !== null) {
            currentTenantId = currentEmail;
            console.log('Setting tenantID to email for DynamoDB GSI compatibility:', currentTenantId);
        } else {
            alert('Current email is not defined. Please ensure you are logged in.');
            return;
        }
    } else if (currentTenantId !== currentEmail && currentEmail !== null) {
        console.warn('TenantID doesn\'t match email, updating for GSI compatibility:', {
            oldTenantId: currentTenantId,
            newTenantId: currentEmail
        });
        currentTenantId = currentEmail;
    }
    
    // Additional checks for global variables
    if (typeof currentEmail === 'undefined' || currentEmail === null) {
        alert('Current email is not defined. Please ensure you are logged in.');
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

    // Ensure tenantID matches email for DynamoDB GSI
    if (currentTenantId !== currentEmail) {
        console.warn('Fixing tenantID for DynamoDB GSI compliance:', {
            oldTenantId: currentTenantId, 
            correctTenantId: currentEmail
        });
        currentTenantId = currentEmail;
    }

    console.log('Starting visit for patient:', patientId, 'with email:', currentEmail, 
               'and tenantId:', currentTenantId, 'using template:', currentTemplate.name);
    console.log('Before API call: currentPatientId:', currentPatientId);
    window.showSpinner();
    try {
        // Set up a timeout for the fetch request
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10-second timeout

        const requestBody = {
            patientId, 
            email: currentEmail, 
            tenantId: currentEmail  // Using email as tenantId for DynamoDB GSI
        };
        
        console.log('API request for starting visit:', requestBody);

        const response = await fetch('/api/visit/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
            signal: controller.signal
        });

        clearTimeout(timeoutId); // Clear the timeout if the request completes

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! Status: ${response.status}, Status Text: ${response.statusText}, Body: ${errorText}`);
        }
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
            const stopListeningBtn = document.getElementById('stop-listening-btn');
            console.log('DOM elements found in proceedWithVisit:', {
                startVisitBtn: !!startVisitBtn,
                submitTranscriptBtn: !!submitTranscriptBtn,
                startListeningBtn: !!startListeningBtn,
                stopListeningBtn: !!stopListeningBtn
            });
            if (startVisitBtn && submitTranscriptBtn && startListeningBtn && stopListeningBtn) {
                startVisitBtn.disabled = true;
                startVisitBtn.classList.add('disabled');
                startVisitBtn.classList.remove('blink');
                submitTranscriptBtn.disabled = false;
                submitTranscriptBtn.classList.remove('disabled');
                submitTranscriptBtn.classList.add('blink');
                submitTranscriptBtn.focus();
                startListeningBtn.disabled = false;
                startListeningBtn.classList.remove('disabled');
                // Force a recheck of the button's state
                startListeningBtn.removeAttribute('disabled');
                startListeningBtn.classList.remove('disabled');
                startListeningBtn.style.pointerEvents = 'auto'; // Ensure the button is clickable
                startListeningBtn.style.opacity = '1'; // Ensure the button is fully visible
                console.log('Start Listening button enabled:', {
                    disabled: startListeningBtn.disabled,
                    classList: startListeningBtn.classList.toString(),
                    pointerEvents: startListeningBtn.style.pointerEvents,
                    opacity: startListeningBtn.style.opacity
                });
            } else {
                console.error('Failed to find buttons in proceedWithVisit:', {
                    startVisitBtn: !!startVisitBtn,
                    submitTranscriptBtn: !!submitTranscriptBtn,
                    startListeningBtn: !!startListeningBtn,
                    stopListeningBtn: !!stopListeningBtn
                });
            }
            // Ensure fetchPatients completes before proceeding
            await fetchPatients();
            console.log('Updated patients list after fetch:', patients);
            const newPatient = patients.find(p => p.patientId === currentPatientId);
            if (newPatient) {
                console.log('Selecting new patient:', newPatient);
                await selectPatient(newPatient);
                // Automatically start speech recognition after patient is added
                if (typeof window.startSpeechRecognition === 'function') {
                    console.log('Automatically starting speech recognition...');
                    window.startSpeechRecognition();
                } else {
                    console.error('startSpeechRecognition function not defined, cannot auto-start speech recognition');
                    alert('Speech recognition is unavailable. Please click "Start Listening" manually or refresh the page.');
                }
            } else {
                console.error('New patient not found in updated list:', currentPatientId);
                alert('Visit started, but patient not found in list. Please refresh the page.');
            }
        } else {
            console.error('API error:', result.error);
            alert('Error: ' + (result.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error starting visit:', error.message);
        console.error('Error stack:', error.stack);
        if (error.name === 'AbortError') {
            alert('Failed to start visit: Request timed out after 10 seconds. Please check the server status and try again.');
        } else {
            alert('Failed to start visit: ' + error.message);
        }
    } finally {
        window.hideSpinner();
    }
}

// Select a patient
async function selectPatient(patient) {
    console.log('Before setting patient in selectPatient: currentPatientId:', currentPatientId);
    currentPatientId = patient.patientId;
    currentPatient = patient;
    console.log('After setting patient in selectPatient: currentPatientId:', currentPatientId);
    console.log('Selected patient:', JSON.stringify(patient, null, 2));

    // Declare DOM elements at the top to ensure they are in scope throughout the function
    const patientDetails = document.getElementById('patient-details');
    const patientList = document.getElementById('patient-list');
    const transcriptSection = document.getElementById('transcript-section');
    const nameEl = document.getElementById('patient-details-name');
    const mrnEl = document.getElementById('patient-details-mrn');
    const lastVisitEl = document.getElementById('patient-details-last-visit');
    const currentVisitEl = document.getElementById('patient-details-current-visit');
    const visitHistoryEl = document.getElementById('patient-details-visit-history');

    // Define formatDateTime and isDST functions at the top of the function scope
    const isDST = (date) => {
        const jan = new Date(date.getFullYear(), 0, 1);
        const jul = new Date(date.getFullYear(), 6, 1);
        const stdOffset = Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
        return date.getTimezoneOffset() < stdOffset ? 'EDT' : 'EST';
    };

    const formatDateTime = (dateStr) => {
        if (!dateStr) return 'N/A';
        const date = new Date(dateStr + (dateStr.endsWith('Z') ? '' : 'Z')); // Ensure UTC
        const formatted = date.toLocaleString('en-US', {
            timeZone: 'America/New_York',
            month: '2-digit',
            day: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        }).replace(',', '');
        return `${formatted} ${isDST(date)}`;
    };

    // Show patient details and hide patient list
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
        if (nameEl) {
            nameEl.textContent = patient.name || 'N/A';
            nameEl.dataset.patientId = patient.patientId; // Ensure patientId is set for AllergenIQ
        } else {
            console.error('patient-details-name element not found');
        }
        if (mrnEl) {
            mrnEl.textContent = patient.mrn || 'N/A';
        } else {
            console.error('patient-details-mrn element not found');
        }
        // Format lastVisit and currentVisit in Eastern Time
        const lastVisitFormatted = formatDateTime(patient.lastVisit);
        const currentVisitFormatted = formatDateTime(patient.currentVisit);
        console.log(`[DEBUG] Rendering patient details for ${patient.name || patient.id}: lastVisit=${patient.lastVisit}, formatted=${lastVisitFormatted}, currentVisit=${patient.currentVisit}, formatted=${currentVisitFormatted}`);
        if (lastVisitEl) {
            lastVisitEl.textContent = lastVisitFormatted;
        } else {
            console.error('patient-details-last-visit element not found');
        }
        if (currentVisitEl) {
            currentVisitEl.textContent = currentVisitFormatted;
            currentVisitEl.dataset.visitId = activeVisitId || ''; // Ensure visitId is set for AllergenIQ
        } else {
            console.error('patient-details-current-visit element not found');
        }
        if (visitHistoryEl) {
            visitHistoryEl.innerHTML = '<div>No visit history available.</div>'; // Placeholder
        } else {
            console.error('patient-details-visit-history element not found');
        }
    } else {
        console.error('Required elements for patient details not found:', {
            patientDetails: !!patientDetails,
            patientList: !!patientList,
            transcriptSection: !!transcriptSection
        });
    }

    // Ensure tenantID matches email for DynamoDB GSI
    if (currentTenantId !== currentEmail) {
        console.warn('Fixing tenantID for DynamoDB GSI compliance:', {
            oldTenantId: currentTenantId, 
            correctTenantId: currentEmail
        });
        currentTenantId = currentEmail;
    }

    window.showContentSpinner();
    try {
        // Log the exact API URL being called for debugging
        const apiUrl = `/api/get-patient-history?tenantId=${encodeURIComponent(currentTenantId)}&patientId=${currentPatientId}`;
        console.log('Fetching patient history using tenantID for GSI:', apiUrl);
        
        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to fetch patient history: HTTP ${response.status} - ${errorText}`);
        }
        
        const data = await response.json();
        console.log('Patient history response:', JSON.stringify(data, null, 2));
        // Check if the response has transcripts; if not, display a message
        if (!data.transcripts || data.transcripts.length === 0) {
            console.log('No transcripts found for patient:', currentPatientId);
            const notesSection = document.getElementById('notes-section');
            const subjectiveContent = document.getElementById('subjective-content');
            const objectiveContent = document.getElementById('objective-content');
            const assessmentContent = document.getElementById('assessment-content');
            const planContainer = document.getElementById('plan-content-container');
            const insightsAllergyTriggers = document.getElementById('insights-allergy-triggers');
            const insightsCondition = document.getElementById('insights-condition');
            const insightsRecommendations = document.getElementById('insights-recommendations');

            if (subjectiveContent) subjectiveContent.innerHTML = '<p>No patient history available. Submit a transcript to generate SOAP notes.</p>';
            if (objectiveContent) objectiveContent.innerHTML = '<p>Awaiting transcript submission.</p>';
            if (assessmentContent) assessmentContent.innerHTML = '<p>Awaiting transcript submission.</p>';
            if (planContainer) planContainer.innerHTML = '<p>Awaiting transcript submission.</p>';
            if (insightsAllergyTriggers) insightsAllergyTriggers.innerHTML = '<p>N/A</p>';
            if (insightsCondition) insightsCondition.innerHTML = '<p>N/A</p>';
            if (insightsRecommendations) {
                insightsRecommendations.innerHTML = '<p>N/A</p>';
                insightsRecommendations.classList.add('bulleted');
            }

            if (notesSection) {
                notesSection.style.display = 'block';
                // Force UI refresh
                console.log('Forcing UI refresh for no transcripts...');
                notesSection.style.display = 'none'; // Briefly hide
                setTimeout(() => {
                    notesSection.style.display = 'block'; // Show again to force re-render
                    window.dispatchEvent(new Event('resize'));
                }, 50);
            }
            window.hideContentSpinner();
            return;
        }
        data.transcripts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        // Set lastVisit and currentVisit based on transcripts
        if (data.transcripts.length > 0) {
            patient.currentVisit = data.transcripts[0].createdAt; // Most recent transcript
            if (data.transcripts.length > 1) {
                patient.lastVisit = data.transcripts[1].createdAt; // Second most recent transcript
            }
            // Update the UI with the new values
            const lastVisitFormatted = formatDateTime(patient.lastVisit);
            const currentVisitFormatted = formatDateTime(patient.currentVisit);
            console.log(`[DEBUG] Updated patient details after transcripts for ${patient.name || patient.id}: lastVisit=${patient.lastVisit}, formatted=${lastVisitFormatted}, currentVisit=${patient.currentVisit}, formatted=${currentVisitFormatted}`);
            if (lastVisitEl) {
                lastVisitEl.textContent = lastVisitFormatted;
            } else {
                console.error('patient-details-last-visit element not found when updating after transcripts');
            }
            if (currentVisitEl) {
                currentVisitEl.textContent = currentVisitFormatted;
                currentVisitEl.dataset.visitId = data.transcripts[0].visitId || activeVisitId || '';
            } else {
                console.error('patient-details-current-visit element not found when updating after transcripts');
            }
        }
        // Display visit history with formatted timestamps
        if (visitHistoryEl) {
            if (data.transcripts.length > 0) {
                visitHistoryEl.innerHTML = data.transcripts.map(transcript => {
                    const visitDate = formatDateTime(transcript.createdAt);
                    console.log(`[DEBUG] Rendering visit history entry: createdAt=${transcript.createdAt}, formatted=${visitDate}`);
                    return `<div>Visit on ${visitDate}</div>`;
                }).join('');
            } else {
                visitHistoryEl.innerHTML = '<div>No visit history available.</div>';
            }
        }
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
                        // Split the planText into sections using a more robust regex
                        const sections = planText.split(/(?=In regards to\s+[^:]+:)/i).filter(section => section.trim());
                        console.log('Split Plan Sections (SelectPatient):', sections);
                        sections.forEach(section => {
                            const sectionMatch = section.match(/In regards to\s+(.+?):/i);
                            if (sectionMatch) {
                                const title = sectionMatch[1].trim();
                                // Extract the content after the section header, excluding subsequent headers
                                const sectionContent = section.replace(/In regards to\s+.+?:/i, '').trim();
                                // Split the content into items, stopping at the next section header
                                const items = sectionContent.split('\n')
                                    .filter(item => item.trim() && !item.match(/In regards to\s+.+?:/i))
                                    .map(item => item.replace(/^- /, '').trim());
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
                            console.error(`Error rendering section ${section.title} (SelectPatient):`, error.message);
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
                    
                    // Check if recommendations exists and is a string before splitting
                    const recommendations = transcript.insights?.recommendations || '';
                    const recommendationsItems = (typeof recommendations === 'string') ? 
                        recommendations.split('\n').filter(item => item.trim()) : 
                        ['No recommendations available'];
                    
                    // Initially render as a bulleted list
                    insightsRecommendations.innerHTML = `
                        <ul>
                            ${recommendationsItems.map(item => `<li>${item.trim()}</li>`).join('')}
                        </ul>
                    `;
                    insightsRecommendations.dataset.originalItems = JSON.stringify(recommendationsItems);
                    insightsRecommendations.classList.add('bulleted');
                    
                    // Initialize enhanced recommendations display if available
                    if (typeof window.initRecommendationsDisplay === 'function') {
                        window.initRecommendationsDisplay();
                    } else {
                        console.error('initRecommendationsDisplay function not found');
                    }
                }
                const notesSection = document.getElementById('notes-section');
                if (notesSection) notesSection.style.display = 'block';
                if (transcript.visitId && transcript.visitId !== 'undefined') {
                    activeVisitId = transcript.visitId;
                    console.log('Set activeVisitId in selectPatient:', activeVisitId);
                    window.fetchReferences(currentPatientId, activeVisitId);
                } else {
                    console.log('No valid visit ID available for references');
                    // Hide the spinner since no references will be fetched
                    window.hideReferencesSpinner();
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
        console.error('Error fetching patient history:', error.message);
        // Display message indicating no history
        console.log('No transcripts found for patient:', currentPatientId);
        const notesSection = document.getElementById('notes-section');
        const subjectiveContent = document.getElementById('subjective-content');
        const objectiveContent = document.getElementById('objective-content');
        const assessmentContent = document.getElementById('assessment-content');
        const planContainer = document.getElementById('plan-content-container');
        const insightsAllergyTriggers = document.getElementById('insights-allergy-triggers');
        const insightsCondition = document.getElementById('insights-condition');
        const insightsRecommendations = document.getElementById('insights-recommendations');

        if (subjectiveContent) subjectiveContent.innerHTML = '<p>No patient history available. Submit a transcript to generate SOAP notes.</p>';
        if (objectiveContent) objectiveContent.innerHTML = '<p>Awaiting transcript submission.</p>';
        if (assessmentContent) assessmentContent.innerHTML = '<p>Awaiting transcript submission.</p>';
        if (planContainer) planContainer.innerHTML = '<p>Awaiting transcript submission.</p>';
        if (insightsAllergyTriggers) insightsAllergyTriggers.innerHTML = '<p>N/A</p>';
        if (insightsCondition) insightsCondition.innerHTML = '<p>N/A</p>';
        if (insightsRecommendations) {
            insightsRecommendations.innerHTML = '<p>N/A</p>';
            insightsRecommendations.classList.add('bulleted');
        }

        if (notesSection) {
            notesSection.style.display = 'block';
            // Force UI refresh
            console.log('Forcing UI refresh for no transcripts...');
            notesSection.style.display = 'none'; // Briefly hide
            setTimeout(() => {
                notesSection.style.display = 'block'; // Show again to force re-render
                window.dispatchEvent(new Event('resize'));
            }, 50);
        }
    } finally {
        window.hideContentSpinner();
    }
}

// Delete a patient
async function deletePatient(patientId) {
    if (!confirm('Are you sure you want to delete this patient and all associated transcripts?')) return;
    
    // Ensure tenantID matches email for DynamoDB GSI
    if (currentTenantId !== currentEmail) {
        console.warn('Fixing tenantID for DynamoDB GSI compliance:', {
            oldTenantId: currentTenantId, 
            correctTenantId: currentEmail
        });
        currentTenantId = currentEmail;
    }
    
    window.showSpinner();
    try {
        const requestBody = {
            email: currentEmail,
            patientId: patientId,
            tenantId: currentTenantId  // Using email as tenantId for DynamoDB GSI
        };
        
        console.log('Deleting patient with params:', requestBody);
        
        const response = await fetch('/api/delete-patient', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to delete patient: ${errorText}`);
        }
        
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
                window.hideReferencesSpinner();
            }
        } else {
            alert('Failed to delete patient: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error deleting patient:', error.message);
        alert('Error deleting patient: ' + error.message);
    } finally {
        window.hideSpinner();
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

// Install an initialization function that runs on page load
window.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing user data...');
    const initialized = initializeUserData();
    
    if (initialized) {
        console.log('User data initialized successfully');
        // Fetch patients if on the right page
        if (document.getElementById('patient-list')) {
            console.log('Patient list found, fetching patients...');
            fetchPatients();
        }
    } else {
        console.warn('Failed to initialize user data, may need to log in again');
        // Optionally redirect to login
        // window.location.href = '/login.html';
    }
});

// Expose functions to the global scope
window.initializeUserData = initializeUserData;
window.fetchPatients = fetchPatients;
window.updatePatientList = updatePatientList;
window.filterPatients = filterPatients;
window.showPatientList = showPatientList;
window.openTemplateSelectionModal = openTemplateSelectionModal;
window.startVisit = startVisit;
window.proceedWithVisit = proceedWithVisit;
window.selectPatient = selectPatient;
window.deletePatient = deletePatient;
window.logout = logout;
