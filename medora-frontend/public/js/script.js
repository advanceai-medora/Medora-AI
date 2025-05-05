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

// Function to initialize event listeners with retry mechanism
function initializeWithRetry(attempts = 5, delay = 500) {
    const startVisitBtn = document.getElementById('start-visit-btn');
    const startSpeechBtn = document.getElementById('start-speech-btn');
    const stopSpeechBtn = document.getElementById('stop-speech-btn');
    const smartLearningBadge = document.getElementById('smart-learning-badge');
    const patientIdInput = document.getElementById('patient-id');

    if (startVisitBtn && startSpeechBtn && stopSpeechBtn && smartLearningBadge && patientIdInput) {
        console.log('All elements found, initializing event listeners');
        startVisitBtn.disabled = false;
        startSpeechBtn.disabled = true;
        startSpeechBtn.classList.add('disabled');
        stopSpeechBtn.disabled = true;
        stopSpeechBtn.classList.add('disabled');
        startSpeechBtn.addEventListener('click', startSpeechRecognition);
        stopSpeechBtn.addEventListener('click', () => {
            console.log('Stop Listening button clicked');
            stopSpeechRecognition();
        });
        console.log('Binding Smart Learning badge event listener');
        smartLearningBadge.addEventListener('click', () => {
            console.log('Smart Learning badge clicked');
            openSmartLearningModal();
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

        // Add event listener to patient input to hide tooltip and update button state
        patientIdInput.addEventListener('input', () => {
            if (patientIdInput.value.trim()) {
                tooltip.style.display = 'none';
                startVisitBtn.classList.add('blink'); // Add blinking effect to guide to next step
            } else {
                tooltip.style.display = 'block';
                startVisitBtn.classList.remove('blink');
            }
        });

        // Add event listener to Start Visit button to change color after click
        startVisitBtn.addEventListener('click', () => {
            startVisitBtn.classList.add('btn-active');
            startVisitBtn.classList.remove('blink');
        });

        const planDetailToggle = document.getElementById('plan-detail-toggle');
        const planBulletToggle = document.getElementById('plan-bullet-toggle');
        const insightsDetailToggle = document.getElementById('insights-detail-toggle');
        const insightsBulletToggle = document.getElementById('insights-bullet-toggle');

        if (planDetailToggle) planDetailToggle.addEventListener('click', () => toggleDetail('plan'));
        if (planBulletToggle) planBulletToggle.addEventListener('click', () => toggleBullet('plan'));
        if (insightsDetailToggle) insightsDetailToggle.addEventListener('click', () => toggleDetail('insights'));
        if (insightsBulletToggle) insightsBulletToggle.addEventListener('click', () => toggleBullet('insights'));

        const patientFilter = document.getElementById('patient-filter');
        if (patientFilter) {
            patientFilter.addEventListener('change', filterPatients);
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
    } else {
        if (attempts > 0) {
            console.warn(`Elements not found, retrying (${attempts} attempts left)...`, {
                startVisitBtn: !!startVisitBtn,
                startSpeechBtn: !!startSpeechBtn,
                stopSpeechBtn: !!stopSpeechBtn,
                smartLearningBadge: !!smartLearningBadge,
                patientIdInput: !!patientIdInput
            });
            setTimeout(() => initializeWithRetry(attempts - 1, delay), delay);
        } else {
            console.error('Failed to find Start/Stop/Smart Learning badge after retries:', {
                startVisitBtn: !!startVisitBtn,
                startSpeechBtn: !!startSpeechBtn,
                stopSpeechBtn: !!stopSpeechBtn,
                smartLearningBadge: !!smartLearningBadge,
                patientIdInput: !!patientIdInput
            });
        }
    }
}

// Initialize on page load
console.log('Script loaded, waiting for DOM...');
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded, initializing app...');
    const user = JSON.parse(localStorage.getItem('user'));
    if (user) {
        currentEmail = user.email;
        currentTenantId = user.tenantId || 'default_tenant';
        currentRole = user.role;
        console.log('User initialized:', { currentEmail, currentTenantId, currentRole });
        fetchPatients();
        initializeSpeechRecognition();
        initializeWithRetry();
    } else {
        console.log('No user found in localStorage, redirecting to login...');
        window.location.href = '/login.html';
    }
});

// Show loading spinner for patient list
function showSpinner() {
    console.log('Showing spinner...');
    const spinner = document.getElementById('refresh-spinner');
    const icon = document.getElementById('refresh-icon');
    if (spinner && icon) {
        spinner.style.display = 'inline-block';
        icon.style.display = 'none';
    }
}

// Hide loading spinner for patient list
function hideSpinner() {
    console.log('Hiding spinner...');
    const spinner = document.getElementById('refresh-spinner');
    const icon = document.getElementById('refresh-icon');
    if (spinner && icon) {
        spinner.style.display = 'none';
        icon.style.display = 'inline-block';
    }
}

// Show content spinner and skeleton UI for patient switch
function showContentSpinner() {
    const contentSpinner = document.getElementById('content-spinner');
    if (contentSpinner) {
        contentSpinner.style.display = 'block';
    }
    const soapSections = document.querySelectorAll('.soap-section .content');
    soapSections.forEach(section => {
        section.classList.add('skeleton');
        section.innerHTML = `
            <p style="width: 100%;"></p>
            <p style="width: 80%;"></p>
            <p style="width: 90%;"></p>
        `;
    });
    const insightSections = document.querySelectorAll('.insights-section .content');
    insightSections.forEach(section => {
        section.classList.add('skeleton');
        section.innerHTML = `
            <p style="width: 100%;"></p>
            <p style="width: 80%;"></p>
        `;
    });
}

// Hide content spinner and remove skeleton UI
function hideContentSpinner() {
    const contentSpinner = document.getElementById('content-spinner');
    if (contentSpinner) {
        contentSpinner.style.display = 'none';
    }
    const soapSections = document.querySelectorAll('.soap-section .content');
    soapSections.forEach(section => {
        section.classList.remove('skeleton');
    });
    const insightSections = document.querySelectorAll('.insights-section .content');
    insightSections.forEach(section => {
        section.classList.remove('skeleton');
    });
}

// Show transcript spinner
function showTranscriptSpinner() {
    const spinner = document.getElementById('transcript-spinner');
    const submitBtn = document.getElementById('submit-transcript-btn');
    if (spinner && submitBtn) {
        spinner.style.display = 'block';
        submitBtn.disabled = true;
    }
}

// Hide transcript spinner
function hideTranscriptSpinner() {
    const spinner = document.getElementById('transcript-spinner');
    const submitBtn = document.getElementById('submit-transcript-btn');
    if (spinner && submitBtn) {
        spinner.style.display = 'none';
        submitBtn.disabled = false;
    }
}

// Show references spinner and skeleton UI
function showReferencesSpinner() {
    const referencesSpinner = document.getElementById('references-spinner');
    const referencesTable = document.getElementById('references-table');
    if (referencesSpinner && referencesTable) {
        console.log('Showing references spinner');
        referencesSpinner.style.display = 'block';
        referencesTable.classList.add('skeleton');
        const tableBody = document.getElementById('references-table-body');
        tableBody.innerHTML = `
            <tr>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
            </tr>
            <tr>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
            </tr>
        `;
    } else {
        console.error('References spinner or table not found');
    }
}

// Hide references spinner and remove skeleton UI with a minimum display time
function hideReferencesSpinner() {
    const referencesSpinner = document.getElementById('references-spinner');
    const referencesTable = document.getElementById('references-table');
    if (referencesSpinner && referencesTable) {
        console.log('Hiding references spinner');
        setTimeout(() => {
            referencesSpinner.style.display = 'none';
            referencesTable.classList.remove('skeleton');
        }, 1000);
    } else {
        console.error('References spinner or table not found');
    }
}

// Fetch patients from backend
async function fetchPatients() {
    console.log('Fetching patients for tenant:', currentTenantId);
    showSpinner();
    try {
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
function showPatientList() {
    const patientDetails = document.getElementById('patient-details');
    const patientList = document.getElementById('patient-list');
    const transcriptSection = document.getElementById('transcript-section');
    if (patientDetails && patientList && transcriptSection) {
        patientDetails.style.display = 'none';
        patientList.style.display = 'block';
        transcriptSection.style.display = 'block';
        currentPatientId = null;
        currentPatient = null;
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
    const patientIdInput = document.getElementById('patient-id');
    const patientId = patientIdInput?.value.trim();
    if (!patientId) {
        alert('Please enter a patient name or ID.');
        return;
    }
    if (!currentEmail) {
        alert('Please log in to start a visit.');
        return;
    }

    // Check for default template
    const defaultTemplate = templates.find(template => template.isDefault);
    if (defaultTemplate) {
        currentTemplate = defaultTemplate;
        console.log('Using default template:', currentTemplate.name);
        proceedWithVisit(patientId);
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
            alert(`Visit started for ${result.patientId} with template ${currentTemplate.name}!`);
            const patientIdInput = document.getElementById('patient-id');
            if (patientIdInput) patientIdInput.value = '';
            const startVisitBtn = document.getElementById('start-visit-btn');
            const startSpeechBtn = document.getElementById('start-speech-btn');
            const stopSpeechBtn = document.getElementById('stop-speech-btn');
            if (startVisitBtn && startSpeechBtn && stopSpeechBtn) {
                startVisitBtn.disabled = true;
                startVisitBtn.classList.add('disabled');
                startSpeechBtn.disabled = false;
                startSpeechBtn.classList.remove('disabled');
                startSpeechBtn.classList.add('blink'); // Add blinking effect to guide to next step
                stopSpeechBtn.disabled = true;
                stopSpeechBtn.classList.add('disabled');
            }
            // Ensure fetchPatients completes before proceeding
            await fetchPatients();
            console.log('Updated patients list after fetch:', patients);
            const newPatient = patients.find(p => p.patientId === currentPatientId);
            if (newPatient) {
                console.log('Selecting new patient:', newPatient);
                await selectPatient(newPatient);
                startSpeechRecognition();
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

// Upload audio for transcription
async function uploadAudio() {
    console.log('Uploading audio...');
    const audioInput = document.getElementById('audio-input');
    const audioStatus = document.getElementById('audio-status');
    const formData = new FormData();
    if (!audioInput || !audioInput.files[0]) {
        if (audioStatus) audioStatus.textContent = 'Please select an audio file';
        return;
    }
    formData.append('audio', audioInput.files[0]);
    formData.append('tenantId', currentTenantId);
    if (audioStatus) audioStatus.textContent = 'Uploading and transcribing audio...';
    try {
        const response = await fetch('/api/transcribe-audio', { method: 'POST', body: formData });
        const data = await response.json();
        if (data.success) {
            if (audioStatus) {
                audioStatus.textContent = 'Audio transcribed successfully';
                audioStatus.style.color = 'green';
            }
            finalTranscript = data.transcript;
            const transcriptInput = document.getElementById('transcript-input');
            if (transcriptInput) transcriptInput.value = finalTranscript;
        } else {
            if (audioStatus) {
                audioStatus.textContent = data.error || 'Failed to transcribe audio';
                audioStatus.style.color = 'red';
            }
        }
    } catch (error) {
        console.error('Error transcribing audio:', error);
        if (audioStatus) audioStatus.textContent = 'Error transcribing audio: ' + error.message;
    }
}

// Select a patient
async function selectPatient(patient) {
    currentPatientId = patient.patientId;
    currentPatient = patient;
    console.log('Selected patient:', JSON.stringify(patient, null, 2));

    // Show patient details and hide patient list
    const patientDetails = document.getElementById('patient-details');
    const patientList = document.getElementById('patient-list');
    const transcriptSection = document.getElementById('transcript-section');
    if (patientDetails && patientList && transcriptSection) {
        patientDetails.style.display = 'block';
        patientList.style.display = 'none';
        transcriptSection.style.display = 'block';

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
            if (notesSection) notesSection.classList.add('hidden');
            const tableBody = document.getElementById('references-table-body');
            if (tableBody) tableBody.innerHTML = `<tr><td colspan="5">No transcripts available</td></tr>`;
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
                        console.log('Plan of Care is empty (SelectPatient), using fallback items');
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
                    insightsRecommendations.innerHTML = recommendationsItems.map(item => `<p>${item.trim()}</p>`).join('');
                    insightsRecommendations.dataset.originalItems = JSON.stringify(recommendationsItems);
                    insightsRecommendations.classList.add('bulleted');
                }
                const notesSection = document.getElementById('notes-section');
                if (notesSection) notesSection.classList.remove('hidden');
                if (transcript.visitId && transcript.visitId !== 'undefined') {
                    activeVisitId = transcript.visitId;
                    fetchReferences(currentPatientId, activeVisitId);
                } else {
                    const tableBody = document.getElementById('references-table-body');
                    if (tableBody) tableBody.innerHTML = `<tr><td colspan="5">No valid visit ID available for references</td></tr>`;
                }
            }
        });
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
                if (notesSection) notesSection.classList.add('hidden');
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

// Initialize speech recognition
function initializeSpeechRecognition() {
    if ('webkitSpeechRecognition' in window) {
        recognition = new webkitSpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = doctorLang === 'EN' ? 'en-US' : 'es-ES';

        recognition.onstart = () => {
            console.log('Speech recognition started');
            isRecognizing = true;
            const startSpeechBtn = document.getElementById('start-speech-btn');
            const stopSpeechBtn = document.getElementById('stop-speech-btn');
            if (startSpeechBtn && stopSpeechBtn) {
                startSpeechBtn.classList.add('hidden');
                startSpeechBtn.classList.remove('active-start');
                stopSpeechBtn.classList.remove('hidden');
                stopSpeechBtn.classList.add('active-stop');
                stopSpeechBtn.disabled = false;
                stopSpeechBtn.classList.remove('disabled');
            }
        };

        recognition.onresult = (event) => {
            console.log('Speech recognition result received');
            let interimTranscript = '';
            let finalTranscriptPiece = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    if (!finalTranscript.endsWith(transcript)) finalTranscriptPiece += transcript + ' ';
                } else {
                    interimTranscript += transcript;
                }
            }
            finalTranscript += finalTranscriptPiece;
            const transcriptInput = document.getElementById('transcript-input');
            if (transcriptInput) {
                transcriptInput.value = finalTranscript + interimTranscript;
                transcriptInput.scrollTop = transcriptInput.scrollHeight;
            }
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            if (event.error === 'no-speech' || event.error === 'aborted' || event.error === 'network') {
                console.log('Speech recognition error type:', event.error, 'isRecognizing:', isRecognizing);
                if (isRecognizing) {
                    console.log('Attempting to restart speech recognition after error');
                    setTimeout(() => {
                        if (isRecognizing) {
                            try {
                                console.log('Restarting recognition');
                                recognition.start();
                            } catch (error) {
                                console.error('Error restarting speech recognition:', error);
                                stopSpeechRecognition();
                            }
                        } else {
                            console.log('Not restarting, isRecognizing is false');
                        }
                    }, 1000);
                }
            } else {
                console.error('Critical speech recognition error:', event.error);
                alert('Speech recognition error: ' + event.error);
                stopSpeechRecognition();
            }
        };

        recognition.onend = () => {
            console.log('Speech recognition ended, isRecognizing:', isRecognizing);
            if (isRecognizing) {
                console.log('Attempting to restart speech recognition');
                setTimeout(() => {
                    if (isRecognizing) {
                        try {
                            console.log('Restarting recognition');
                            recognition.start();
                        } catch (error) {
                            console.error('Error restarting speech recognition on end:', error);
                            stopSpeechRecognition();
                        }
                    } else {
                        console.log('Not restarting, isRecognizing is false');
                    }
                }, 1000);
            } else {
                console.log('Speech recognition stopped, not restarting');
            }
        };
    } else {
        console.error('Speech recognition not supported in this browser');
        alert('Speech recognition not supported in this browser.');
        const startSpeechBtn = document.getElementById('start-speech-btn');
        const stopSpeechBtn = document.getElementById('stop-speech-btn');
        if (startSpeechBtn && stopSpeechBtn) {
            startSpeechBtn.disabled = true;
            startSpeechBtn.classList.add('disabled');
            stopSpeechBtn.disabled = true;
            stopSpeechBtn.classList.add('disabled');
        }
    }
}

// Start speech recognition
function startSpeechRecognition() {
    if (!activeVisitId) {
        alert('Please start a visit first.');
        return;
    }
    if (recognition && !isRecognizing) {
        console.log('Starting speech recognition');
        finalTranscript = '';
        isRecognizing = true;
        recognition.lang = 'en-US'; // Default to English for now
        try {
            recognition.start();
        } catch (error) {
            console.error('Error starting speech recognition:', error);
            stopSpeechRecognition();
        }
    } else {
        console.log('Recognition object not initialized or already recognizing:', { recognition: !!recognition, isRecognizing });
    }
}

// Stop speech recognition
function stopSpeechRecognition() {
    console.log('stopSpeechRecognition called, current state:', { isRecognizing, recognition: !!recognition });
    if (recognition && isRecognizing) {
        isRecognizing = false;
        try {
            console.log('Calling recognition.stop()');
            // Clear all event handlers to prevent restarts
            recognition.onstart = null;
            recognition.onresult = null;
            recognition.onerror = null;
            recognition.onend = null;
            recognition.stop();
            console.log('recognition.stop() called successfully');
            // Forcefully reset recognition immediately
            recognition = null;
            console.log('Recognition object reset');
            initializeSpeechRecognition();
        } catch (error) {
            console.error('Error stopping speech recognition:', error);
            recognition = null;
            initializeSpeechRecognition();
        }
        const startSpeechBtn = document.getElementById('start-speech-btn');
        const stopSpeechBtn = document.getElementById('stop-speech-btn');
        if (startSpeechBtn && stopSpeechBtn) {
            console.log('Updating button states');
            startSpeechBtn.classList.remove('hidden');
            startSpeechBtn.classList.add('active-start');
            stopSpeechBtn.classList.remove('active-stop');
            stopSpeechBtn.classList.add('hidden');
            startSpeechBtn.disabled = false;
            startSpeechBtn.classList.remove('disabled');
            stopSpeechBtn.disabled = true;
            stopSpeechBtn.classList.add('disabled');
        } else {
            console.error('Button elements not found:', { startSpeechBtn: !!startSpeechBtn, stopSpeechBtn: !!stopSpeechBtn });
        }
    } else {
        console.log('No active recognition to stop');
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
    const tableBody = document.getElementById('references-table-body');
    if (!patientId || !visitId || visitId === 'undefined') {
        if (tableBody) tableBody.innerHTML = `<tr><td colspan="5">No valid visit ID available for references</td></tr>`;
        hideReferencesSpinner();
        return;
    }
    showReferencesSpinner();
    try {
        const response = await fetch(`/get-insights?patient_id=${patientId}&visit_id=${visitId}&conditions=${encodeURIComponent(latestAnalysis?.soapNotes?.differential_diagnosis || '')}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const data = await response.json();
        console.log('References response:', JSON.stringify(data, null, 2));
        if (!tableBody) return;
        tableBody.innerHTML = '';
        if (data.insights && Array.isArray(data.insights) && data.insights.length > 0) {
            data.insights.forEach(insight => {
                const confidenceIcons = {
                    "Strongly Recommended": '●●●●●',
                    "Recommended": '●●●●',
                    "Moderately Recommended": '●●●',
                    "Neutral": '●●',
                    "Not Recommended": '●'
                };
                const confidenceIcon = confidenceIcons[insight.confidence] || '●●';
                const row = document.createElement('tr');
                const url = insight.url || '#';
                let href = url;
                if (url.startsWith('http://') || url.startsWith('https://')) {
                    href = url;
                } else {
                    href = `https://test.medoramd.ai/${url}`;
                }
                const doiPattern = /https:\/\/test\.medoramd\.ai\/(10\.\d{4,9}\/[-._;()/:A-Z0-9]+)$/i;
                const match = href.match(doiPattern);
                if (match) {
                    href = `https://doi.org/${match[1]}`;
                }
                row.innerHTML = `
                    <td>${insight.title || 'N/A'}</td>
                    <td data-summary="${insight.summary || 'N/A'}">${insight.summary || 'N/A'}</td>
                    <td><a href="${href}" target="_blank" rel="noopener noreferrer">${insight.pubmed_id || 'N/A'}</a></td>
                    <td>${confidenceIcon} ${insight.confidence || 'N/A'}</td>
                    <td><span class="brain-icon">🧠</span> ${insight.relevance_tag || 'N/A'}</td>
                `;
                tableBody.appendChild(row);
            });
        } else {
            tableBody.innerHTML = `<tr><td colspan="5">No references available</td></tr>`;
        }
    } catch (error) {
        console.error('Error fetching references:', error);
        if (tableBody) tableBody.innerHTML = `<tr><td colspan="5">Error fetching references: ${error.message}</td></tr>`;
    } finally {
        hideReferencesSpinner();
    }
}
// Submit transcript
async function submitTranscript() {
    const transcript = document.getElementById('transcript-input').value.trim();
    if (!transcript) {
        alert('Please enter a transcript.');
        return;
    }
    if (!activeVisitId) {
        alert('Please start a visit first.');
        return;
    }
    console.log('Submitting transcript:', transcript);
    showTranscriptSpinner();
    showContentSpinner();
    try {
        const response = await fetch('/submit-transcript', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ patient_id: currentPatientId, transcript, visit_id: activeVisitId })
        });
        const result = await response.json();
        console.log('Backend response from /submit-transcript:', JSON.stringify(result, null, 2));
        if (!response.ok) throw new Error('Failed to submit transcript');
        if (response.ok && result.statusCode === 200) {
            latestAnalysis = { soapNotes: result.body.soap_notes };
            activeVisitId = result.body.visit_id;
            const subjectiveContent = document.getElementById('subjective-content');
            if (subjectiveContent) {
                const chiefComplaint = result.body.soap_notes.patient_history?.chief_complaint || 'Not specified';
                const historyOfPresentIllness = result.body.soap_notes.patient_history?.history_of_present_illness || 'Not specified';
                const pastMedicalHistory = result.body.soap_notes.patient_history?.past_medical_history || 'Not specified';
                const allergies = result.body.soap_notes.patient_history?.allergies || 'Not specified';
                const socialHistory = result.body.soap_notes.patient_history?.social_history || 'Not specified';
                const reviewOfSystems = result.body.soap_notes.patient_history?.review_of_systems || 'Not specified';
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
                console.log('Subjective section updated:', subjectiveContent.innerHTML);
            }
            const objectiveContent = document.getElementById('objective-content');
            if (objectiveContent) {
                const physicalExamination = result.body.soap_notes.physical_examination || 'Not specified';
                objectiveContent.innerHTML = `
                    <strong>Physical Examination:</strong><br>
                    ${physicalExamination}. Vital signs include blood pressure, heart rate, respiratory rate, and temperature. Physical findings indicate the patient's current health status, with specific attention to respiratory, cardiovascular, ENT, and general appearance. Additional observations include skin condition, neurological status, and musculoskeletal findings.
                `;
                console.log('Objective section updated:', objectiveContent.innerHTML);
            }
            const assessmentContent = document.getElementById('assessment-content');
            if (assessmentContent) {
                let assessmentText = result.body.soap_notes.differential_diagnosis || 'Not specified';
                assessmentText = assessmentText.replace(/\*/g, '<br>*');
                assessmentContent.innerHTML = `
                    ${assessmentText}<br><br>
                    The assessment considers the patient's symptoms, history, and physical findings to determine potential diagnoses and contributing factors. Differential diagnoses are prioritized based on clinical presentation, with recommendations for further evaluation to confirm the primary diagnosis.
                `;
                console.log('Assessment section updated:', assessmentContent.innerHTML);
            }
            const planContainer = document.getElementById('plan-content-container');
            if (planContainer) {
                const planText = result.body.soap_notes.plan_of_care || '';
                console.log('Raw Plan of Care Data (Submit):', JSON.stringify(planText));
                let planSections = [];
                if (!planText) {
                    console.log('Plan of Care is empty (Submit), using fallback items');
                    planSections = [{
                        title: "General Plan",
                        items: ['No specific plan recommendations available. Please follow up with standard care protocols.']
                    }];
                } else {
                    const sections = planText.split(/(?=In regards to\s+[\w\s]+:)/i).filter(section => section.trim());
                    console.log('Split Plan Sections (Submit):', sections);
                    sections.forEach(section => {
                        const sectionMatch = section.match(/In regards to\s+(.+?)(?::|$)/i);
                        if (sectionMatch) {
                            const title = sectionMatch[1].trim();
                            const items = section.replace(/In regards to\s+.+?(?::|$)/i, '').trim().split('\n').filter(item => item.trim()).map(item => item.replace(/^- /, ''));
                            console.log(`Parsed Section (Submit) - ${title}:`, items);
                            if (items.length > 0) {
                                planSections.push({ title, items });
                            }
                        }
                    });
                    if (planSections.length === 0 && planText.trim()) {
                        console.log('No "In regards to" sections found (Submit), treating planText as a single section');
                        const items = planText.split(/[\n•-]/).filter(item => item.trim()).map(item => item.trim());
                        planSections = [{ title: "General Plan", items }];
                    }
                }
                if (planSections.length === 0) {
                    console.log('No plan sections parsed (Submit), rendering placeholder');
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
                        console.log(`Rendering section (Submit): ${section.title} with items:`, section.items);
                        planContainer.appendChild(sectionDiv);
                    } catch (error) {
                        console.error(`Error rendering section ${section.title} (Submit):`, error);
                    }
                });
                planContainer.style.display = 'block';
            } else {
                console.error('Plan container element not found in DOM (Submit)');
            }
            const insightsAllergyTriggers = document.getElementById('insights-allergy-triggers');
            const insightsCondition = document.getElementById('insights-condition');
            const insightsRecommendations = document.getElementById('insights-recommendations');
            if (insightsAllergyTriggers && insightsCondition && insightsRecommendations) {
                insightsAllergyTriggers.innerHTML = `<p>${result.body.soap_notes.patient_history?.allergies || 'Not specified'}</p>`;
                insightsCondition.innerHTML = `<p>${result.body.soap_notes.differential_diagnosis || 'Not specified'}</p>`;
                const conditions = result.body.soap_notes.differential_diagnosis?.toLowerCase().split(/,|\n/) || [];
                const allRecommendations = (result.body.soap_notes.patient_education || '').split('\n').filter(item => item.trim());
                const relevantRecommendations = allRecommendations.filter(rec => {
                    return conditions.some(condition => rec.toLowerCase().includes(condition.trim()));
                });
                insightsRecommendations.innerHTML = relevantRecommendations.length ? relevantRecommendations.map(item => `<p>${item.trim()}</p>`).join('') : '<p>No specific recommendations available.</p>';
                insightsRecommendations.dataset.originalItems = JSON.stringify(relevantRecommendations);
                insightsRecommendations.classList.add('bulleted');
            }
            const notesSection = document.getElementById('notes-section');
            if (notesSection) notesSection.classList.remove('hidden');
            fetchReferences(currentPatientId, activeVisitId);
        } else {
            alert('Error: ' + result.error);
        }
    } catch (error) {
        console.error('Error submitting transcript:', error);
        alert('Failed to submit transcript: ' + error.message);
    } finally {
        hideTranscriptSpinner();
        hideContentSpinner();
    }
}

// Copy SOAP notes
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

// Separate (Enhanced Magic Edit)
function separateSOAP() {
    const modal = document.getElementById('separate-modal');
    if (modal) {
        modal.style.display = 'block';
        const sectionSelect = document.getElementById('separate-section');
        const instructionsInput = document.getElementById('separate-instructions');
        const preview = document.getElementById('separate-preview');
        if (sectionSelect && instructionsInput && preview) {
            sectionSelect.value = 'subjective-content';
            instructionsInput.value = '';
            preview.textContent = 'No changes yet. Enter instructions to see a preview.';
            instructionsInput.addEventListener('input', () => {
                const sectionId = sectionSelect.value;
                const instructions = instructionsInput.value.trim();
                if (instructions) {
                    const targetElement = document.getElementById(sectionId);
                    if (targetElement) {
                        const currentContent = targetElement.textContent;
                        preview.textContent = `${currentContent}\n\nProposed Change: ${instructions}`;
                    } else {
                        preview.textContent = 'Error: Selected section not found.';
                    }
                } else {
                    preview.textContent = 'No changes yet. Enter instructions to see a preview.';
                }
            });
        }
    }
}

function closeSeparateModal() {
    const modal = document.getElementById('separate-modal');
    if (modal) modal.style.display = 'none';
}

async function applySeparate() {
    const sectionId = document.getElementById('separate-section').value;
    const instructions = document.getElementById('separate-instructions').value.trim();
    if (!instructions) {
        alert('Please enter editing instructions.');
        return;
    }
    const targetElement = document.getElementById(sectionId);
    if (!targetElement) {
        alert('Selected section not found.');
        return;
    }
    editHistory.push({ sectionId, previousContent: targetElement.innerHTML });
    const currentContent = targetElement.textContent;
    targetElement.innerHTML = `${currentContent}\n\n${instructions}`;
    closeSeparateModal();
}

// Copy section
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

// Edit section
function editSection(sectionId) {
    const modal = document.getElementById('separate-modal');
    const sectionSelect = document.getElementById('separate-section');
    if (sectionSelect) {
        sectionSelect.value = sectionId.includes('subjective') ? 'subjective-content' :
                             sectionId.includes('objective') ? 'objective-content' :
                             sectionId.includes('assessment') ? 'assessment-content' :
                             sectionId.includes('plan') ? 'plan-content-general-plan' :
                             sectionId.includes('insights') ? 'insights-allergy-triggers' : sectionId;
        separateSOAP();
    }
}

// Toggle concise/detailed
function toggleDetail(section) {
    const toggleBtn = document.getElementById(`${section}-detail-toggle`);
    if (toggleBtn) {
        const isConcise = toggleBtn.textContent === 'Concise';
        toggleBtn.textContent = isConcise ? 'Detailed' : 'Concise';
        toggleBtn.classList.toggle('active');
        if (section === 'insights') {
            const allergyTriggers = document.getElementById('insights-allergy-triggers');
            const condition = document.getElementById('insights-condition');
            const recommendations = document.getElementById('insights-recommendations');
            if (allergyTriggers && condition && recommendations) {
                if (isConcise) {
                    allergyTriggers.innerHTML = `<p>${latestAnalysis.soapNotes.patient_history?.allergies.split('.')[0] || 'Not specified'}</p>`;
                    condition.innerHTML = `<p>${latestAnalysis.soapNotes.differential_diagnosis?.split('\n')[0] || 'Not specified'}</p>`;
                    const recItems = latestAnalysis.soapNotes.patient_education?.split('\n').filter(item => item.trim()) || [];
                    recommendations.innerHTML = recItems.length ? `<p>${recItems[0]}</p>` : '<p>Not specified</p>';
                    recommendations.classList.add('bulleted');
                } else {
                    allergyTriggers.innerHTML = `<p>${latestAnalysis.soapNotes.patient_history?.allergies || 'Not specified'}</p>`;
                    condition.innerHTML = `<p>${latestAnalysis.soapNotes.differential_diagnosis || 'Not specified'}</p>`;
                    const recItems = latestAnalysis.soapNotes.patient_education?.split('\n').filter(item => item.trim()) || [];
                    recommendations.innerHTML = recItems.map(item => `<p>${item.trim()}</p>`).join('');
                    recommendations.classList.add('bulleted');
                }
            }
        } else if (section === 'plan') {
            const planContainer = document.getElementById('plan-content-container');
            if (planContainer) {
                const sections = planContainer.querySelectorAll('.plan-section');
                sections.forEach(section => {
                    const ulElement = section.querySelector('ul');
                    const items = JSON.parse(ulElement.dataset.originalItems || '[]');
                    if (isConcise) {
                        ulElement.innerHTML = items.length ? `<li>${items[0]}</li>` : '<li>Not specified</li>';
                    } else {
                        ulElement.innerHTML = items.map(item => `<li>${item.trim()}</li>`).join('');
                    }
                });
            }
        }
    }
}

// Toggle bulleted format
function toggleBullet(section) {
    const toggleBtn = document.getElementById(`${section}-bullet-toggle`);
    if (toggleBtn) {
        const isBulleted = toggleBtn.textContent === 'Bullet';
        toggleBtn.textContent = isBulleted ? 'No Bullet' : 'Bullet';
        toggleBtn.classList.toggle('active');
        if (section === 'insights') {
            const recommendations = document.getElementById('insights-recommendations');
            if (recommendations) {
                let items = recommendations.dataset.originalItems
                    ? JSON.parse(recommendations.dataset.originalItems)
                    : recommendations.textContent.split('\n').filter(item => item.trim());
                if (!recommendations.dataset.originalItems) {
                    recommendations.dataset.originalItems = JSON.stringify(items);
                }
                if (isBulleted) {
                    recommendations.innerHTML = items.map(item => `<p>${item.trim()}</p>`).join('');
                    recommendations.classList.add('bulleted');
                } else {
                    recommendations.innerHTML = items.join(' ');
                    recommendations.classList.remove('bulleted');
                }
            }
        } else if (section === 'plan') {
            const planContainer = document.getElementById('plan-content-container');
            if (planContainer) {
                const sections = planContainer.querySelectorAll('.plan-section');
                sections.forEach(section => {
                    const ulElement = section.querySelector('ul');
                    let items = ulElement.dataset.originalItems
                        ? JSON.parse(ulElement.dataset.originalItems)
                        : ulElement.textContent.split('\n').filter(item => item.trim());
                    if (!ulElement.dataset.originalItems) {
                        ulElement.dataset.originalItems = JSON.stringify(items);
                    }
                    if (isBulleted) {
                        ulElement.innerHTML = items.map(item => `<li>${item.trim()}</li>`).join('');
                    } else {
                        ulElement.innerHTML = items.join(' ');
                    }
                });
            }
        }
    }
}

// Smart Learning Modal Functions
function openSmartLearningModal() {
    const modal = document.getElementById('smart-learning-modal');
    if (modal) {
        console.log('Opening Smart Learning modal');
        modal.style.display = 'block';
        modal.innerHTML = `
            <button class="close-btn" onclick="closeSmartLearningModal()">✖</button>
            <h3>Manage Clinical Note Templates</h3>
            <div style="margin-bottom: 10px;">
                <label for="template-select">Select Template to Edit:</label>
                <select id="template-select" style="margin-left: 10px;">
                    <option value="">-- Create New Template --</option>
                    ${templates.map(template => `<option value="${template.name}">${template.name} (${template.category})</option>`).join('')}
                </select>
                <button onclick="loadTemplate()" style="margin-left: 10px; padding: 5px 10px; background: #5a9bd5; color: #fff; border: none; border-radius: 4px; cursor: pointer;">Load</button>
                <button onclick="deleteTemplate()" style="margin-left: 10px; padding: 5px 10px; background: #e63946; color: #fff; border: none; border-radius: 4px; cursor: pointer;">Delete</button>
            </div>
            <div id="template-form">
                <h4>Template Settings</h4>
                <div style="margin-bottom: 10px;">
                    <label for="template-name">Template Name:</label>
                    <input type="text" id="template-name" style="margin-left: 10px; padding: 5px; width: 300px;">
                </div>
                <div style="margin-bottom: 10px;">
                    <label for="template-category">Template Category:</label>
                    <select id="template-category" style="margin-left: 10px; padding: 5px;">
                        <option value="New Consult">New Consult</option>
                        <option value="Follow-Up">Follow-Up</option>
                        <option value="Testing Review">Testing Review</option>
                        <option value="Immunotherapy Visit">Immunotherapy Visit</option>
                        <option value="Custom">Custom</option>
                    </select>
                </div>
                <div style="margin-bottom: 10px;">
                    <label for="template-default">Default Template?</label>
                    <input type="checkbox" id="template-default" style="margin-left: 10px;">
                    <span style="margin-left: 5px;">Yes, set as default for new notes</span>
                </div>
                <h4>Add Sections</h4>
                <div style="margin-bottom: 10px;">
                    <label style="display: block; margin-bottom: 5px;">Select Sections:</label>
                    <label style="margin-right: 15px;"><input type="checkbox" class="section-checkbox" value="Chief Complaint"> Chief Complaint</label>
                    <label style="margin-right: 15px;"><input type="checkbox" class="section-checkbox" value="History of Present Illness (HPI)"> History of Present Illness (HPI)</label>
                    <label style="margin-right: 15px;"><input type="checkbox" class="section-checkbox" value="Environmental Allergy History"> Environmental Allergy History</label>
                    <label style="margin-right: 15px;"><input type="checkbox" class="section-checkbox" value="Food Allergy History"> Food Allergy History</label>
                    <label style="margin-right: 15px;"><input type="checkbox" class="section-checkbox" value="Medication Allergy History"> Medication Allergy History</label>
                    <label style="margin-right: 15px;"><input type="checkbox" class="section-checkbox" value="Family History"> Family History</label>
                    <label style="margin-right: 15px;"><input type="checkbox" class="section-checkbox" value="Social History (Pets, Smoking)"> Social History (Pets, Smoking)</label>
                    <label style="margin-right: 15px;"><input type="checkbox" class="section-checkbox" value="Prior Testing"> Prior Testing</label>
                    <label style="margin-right: 15px;"><input type="checkbox" class="section-checkbox" value="Current Medications"> Current Medications</label>
                    <label style="margin-right: 15px;"><input type="checkbox" class="section-checkbox" value="Physical Exam"> Physical Exam</label>
                    <label style="margin-right: 15px;"><input type="checkbox" class="section-checkbox" value="Assessment and Plan"> Assessment and Plan</label>
                    <label style="margin-right: 15px;"><input type="checkbox" class="section-checkbox" value="Patient Education"> Patient Education</label>
                </div>
                <div id="section-details"></div>
                <button onclick="saveTemplate()" style="margin-top: 20px; padding: 8px 16px; background: #4caf50; color: #fff; border: none; border-radius: 4px; cursor: pointer;">Save Template</button>
            </div>
        `;

        // Add event listeners for section checkboxes
        const sectionCheckboxes = document.querySelectorAll('.section-checkbox');
        sectionCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', updateSectionDetails);
        });
    } else {
        console.error('Smart Learning modal not found');
    }
}

function closeSmartLearningModal() {
    const modal = document.getElementById('smart-learning-modal');
    if (modal) modal.style.display = 'none';
}

function updateSectionDetails() {
    const sectionDetails = document.getElementById('section-details');
    const selectedSections = Array.from(document.querySelectorAll('.section-checkbox:checked')).map(cb => cb.value);
    sectionDetails.innerHTML = selectedSections.map(section => `
        <div class="section-config" data-section="${section}" style="margin-bottom: 20px; border: 1px solid #d1d5db; padding: 10px; border-radius: 4px;">
            <h5>${section}</h5>
            <div style="margin-bottom: 10px;">
                <label for="${section}-default-text">Default Text:</label>
                <textarea id="${section}-default-text" style="width: 100%; height: 50px; padding: 5px;"></textarea>
            </div>
            <div style="margin-bottom: 10px;">
                <label for="${section}-prompts">Add Prompt (comma-separated):</label>
                <input type="text" id="${section}-prompts" style="width: 100%; padding: 5px;" placeholder="e.g., Seasonal vs. perennial symptoms?">
            </div>
            <div style="margin-bottom: 10px;">
                <label for="${section}-dropdowns">Drop-Downs (comma-separated):</label>
                <input type="text" id="${section}-dropdowns" style="width: 100%; padding: 5px;" placeholder="e.g., House dust mites, Pollen">
            </div>
            <div style="margin-bottom: 10px;">
                <label for="${section}-checkbox-options">Checkbox Options (comma-separated):</label>
                <input type="text" id="${section}-checkbox-options" style="width: 100%; padding: 5px;" placeholder="e.g., Option1, Option2">
            </div>
            <div>
                <label for="${section}-ai-smart-suggest">AI Smart Suggest:</label>
                <input type="checkbox" id="${section}-ai-smart-suggest" style="margin-left: 10px;">
            </div>
        </div>
    `).join('');
}

function loadTemplate() {
    const templateSelect = document.getElementById('template-select');
    const templateNameInput = document.getElementById('template-name');
    const templateCategorySelect = document.getElementById('template-category');
    const templateDefaultCheckbox = document.getElementById('template-default');
    const sectionCheckboxes = document.querySelectorAll('.section-checkbox');

    if (templateSelect.value === '') {
        // Clear form for new template
        templateNameInput.value = '';
        templateCategorySelect.value = 'Custom';
        templateDefaultCheckbox.checked = false;
        sectionCheckboxes.forEach(cb => cb.checked = false);
        updateSectionDetails();
        return;
    }

    const selectedTemplate = templates.find(t => t.name === templateSelect.value);
    if (selectedTemplate) {
        templateNameInput.value = selectedTemplate.name;
        templateCategorySelect.value = selectedTemplate.category;
        templateDefaultCheckbox.checked = selectedTemplate.isDefault;

        // Reset all checkboxes
        sectionCheckboxes.forEach(cb => cb.checked = false);

        // Check the sections that are present in the template
        selectedTemplate.sections.forEach(section => {
            const checkbox = Array.from(sectionCheckboxes).find(cb => cb.value === section.name);
            if (checkbox) checkbox.checked = true;
        });

        updateSectionDetails();

        // Populate section details
        selectedTemplate.sections.forEach(section => {
            const defaultTextInput = document.getElementById(`${section.name}-default-text`);
            const promptsInput = document.getElementById(`${section.name}-prompts`);
            const dropdownsInput = document.getElementById(`${section.name}-dropdowns`);
            const checkboxOptionsInput = document.getElementById(`${section.name}-checkbox-options`);
            const aiSmartSuggestInput = document.getElementById(`${section.name}-ai-smart-suggest`);

            if (defaultTextInput) defaultTextInput.value = section.defaultText || '';
            if (promptsInput) promptsInput.value = section.prompts.join(', ') || '';
            if (dropdownsInput) dropdownsInput.value = section.dropdowns.join(', ') || '';
            if (checkboxOptionsInput) checkboxOptionsInput.value = section.checkboxOptions.join(', ') || '';
            if (aiSmartSuggestInput) aiSmartSuggestInput.checked = section.aiSmartSuggest || false;
        });
    }
}

function saveTemplate() {
    const templateNameInput = document.getElementById('template-name');
    const templateCategorySelect = document.getElementById('template-category');
    const templateDefaultCheckbox = document.getElementById('template-default');
    const selectedSections = Array.from(document.querySelectorAll('.section-checkbox:checked')).map(cb => cb.value);

    const templateName = templateNameInput.value.trim();
    if (!templateName) {
        alert('Please enter a template name.');
        return;
    }

    if (selectedSections.length === 0) {
        alert('Please select at least one section.');
        return;
    }

    // Check for duplicate template names (excluding the current template being edited)
    const templateSelect = document.getElementById('template-select');
    const originalTemplateName = templateSelect.value;
    const existingTemplate = templates.find(t => t.name === templateName && t.name !== originalTemplateName);
    if (existingTemplate) {
        alert('A template with this name already exists. Please choose a different name.');
        return;
    }

    // Gather section details
    const sections = selectedSections.map(section => {
        const defaultText = document.getElementById(`${section}-default-text`)?.value || '';
        const promptsInput = document.getElementById(`${section}-prompts`)?.value || '';
        const dropdownsInput = document.getElementById(`${section}-dropdowns`)?.value || '';
        const checkboxOptionsInput = document.getElementById(`${section}-checkbox-options`)?.value || '';
        const aiSmartSuggest = document.getElementById(`${section}-ai-smart-suggest`)?.checked || false;

        return {
            name: section,
            defaultText,
            prompts: promptsInput ? promptsInput.split(',').map(p => p.trim()).filter(p => p) : [],
            dropdowns: dropdownsInput ? dropdownsInput.split(',').map(d => d.trim()).filter(d => d) : [],
            checkboxOptions: checkboxOptionsInput ? checkboxOptionsInput.split(',').map(c => c.trim()).filter(c => c) : [],
            aiSmartSuggest
        };
    });

    // Create or update the template
    const newTemplate = {
        name: templateName,
        category: templateCategorySelect.value,
        isDefault: templateDefaultCheckbox.checked,
        sections
    };

    // If this template is set as default, unset the default flag from all other templates
    if (newTemplate.isDefault) {
        templates.forEach(t => t.isDefault = false);
    }

    // Update or add the template to the templates array
    if (originalTemplateName) {
        // Editing an existing template
        const templateIndex = templates.findIndex(t => t.name === originalTemplateName);
        templates[templateIndex] = newTemplate;
    } else {
        // Adding a new template
        templates.push(newTemplate);
    }

    // Save to localStorage
    saveTemplates();

    // Refresh the template selection dropdown
    templateSelect.innerHTML = `
        <option value="">-- Create New Template --</option>
        ${templates.map(template => `<option value="${template.name}">${template.name} (${template.category})</option>`).join('')}
    `;

    // Clear the form
    templateNameInput.value = '';
    templateCategorySelect.value = 'Custom';
    templateDefaultCheckbox.checked = false;
    sectionCheckboxes.forEach(cb => cb.checked = false);
    updateSectionDetails();

    alert('Template saved successfully!');
}

function deleteTemplate() {
    const templateSelect = document.getElementById('template-select');
    const templateName = templateSelect.value;

    if (!templateName) {
        alert('Please select a template to delete.');
        return;
    }

    if (!confirm(`Are you sure you want to delete the template "${templateName}"?`)) {
        return;
    }

    // Remove the template from the templates array
    templates = templates.filter(t => t.name !== templateName);

    // Save to localStorage
    saveTemplates();

    // Refresh the template selection dropdown
    templateSelect.innerHTML = `
        <option value="">-- Create New Template --</option>
        ${templates.map(template => `<option value="${template.name}">${template.name} (${template.category})</option>`).join('')}
    `;

    // Clear the form
    const templateNameInput = document.getElementById('template-name');
    const templateCategorySelect = document.getElementById('template-category');
    const templateDefaultCheckbox = document.getElementById('template-default');
    const sectionCheckboxes = document.querySelectorAll('.section-checkbox');

    templateNameInput.value = '';
    templateCategorySelect.value = 'Custom';
    templateDefaultCheckbox.checked = false;
    sectionCheckboxes.forEach(cb => cb.checked = false);
    updateSectionDetails();

    alert('Template deleted successfully!');
}
