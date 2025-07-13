console.log('patient-management.js loaded');
console.log('patient-management.js version: 4.1.6 - Complete Enhanced Allergy Triggers Display WITH AUTH');

// ===============================
// AUTHENTICATION HELPER FUNCTIONS
// ===============================

/**
 * Get authentication headers for API calls
 * Supports both Cognito JWT tokens and fallback compatibility
 */
function getAuthHeaders() {
    const headers = {
        'Content-Type': 'application/json'
    };
    
    // Try to get Cognito JWT token first
    const idToken = localStorage.getItem('idToken');
    if (idToken) {
        headers['Authorization'] = `Bearer ${idToken}`;
        console.log('🔐 Using Cognito JWT token for authentication');
    } else {
        console.log('⚠️ No JWT token found, using session-based auth fallback');
    }
    
    return headers;
}

/**
 * Check if JWT token is expired and refresh if needed
 */
function isTokenExpired() {
    const idToken = localStorage.getItem('idToken');
    if (!idToken) return true;
    
    try {
        const tokenPayload = JSON.parse(atob(idToken.split('.')[1]));
        const currentTime = Math.floor(Date.now() / 1000);
        return tokenPayload.exp < currentTime;
    } catch (e) {
        console.error('Error checking token expiration:', e);
        return true;
    }
}

// ===============================
// ENHANCED ALLERGY TRIGGERS DISPLAY FUNCTIONS
// ===============================

/**
 * Parse allergy triggers from complex strings - ENHANCED FOR COMPLEX DESCRIPTIONS
 */
function parseAllergyTriggersFromString(allergyTriggersString) {
    console.log('🔍 ENHANCED PARSING: Processing allergy string:', allergyTriggersString);
    
    if (!allergyTriggersString || 
        allergyTriggersString.toLowerCase().includes('no known') ||
        allergyTriggersString.toLowerCase().includes('none') ||
        allergyTriggersString.toLowerCase().includes('no allergies')) {
        return [];
    }
    
    const triggers = [];
    const lowerText = allergyTriggersString.toLowerCase();
    
    // Enhanced parsing for complex medical descriptions
    const allergenPatterns = [
        // Food allergens with medical terms
        { patterns: ['anaphylactic to peanuts', 'peanut allergy', 'peanuts', 'peanut'], display: 'Peanuts' },
        { patterns: ['allergic to hazelnuts', 'hazelnut allergy', 'hazelnuts', 'hazelnut'], display: 'Hazelnuts' },
        { patterns: ['tree nuts', 'tree nut'], display: 'Tree nuts' },
        { patterns: ['shellfish'], display: 'Shellfish' },
        { patterns: ['nuts'], display: 'Nuts' },
        { patterns: ['eggs'], display: 'Eggs' },
        { patterns: ['milk', 'dairy'], display: 'Dairy' },
        { patterns: ['wheat'], display: 'Wheat' },
        { patterns: ['soy'], display: 'Soy' },
        { patterns: ['fish'], display: 'Fish' },
        { patterns: ['sesame'], display: 'Sesame' },
        
        // Environmental allergens
        { patterns: ['pollen', 'seasonal'], display: 'Pollen' },
        { patterns: ['dust mite', 'dust'], display: 'Dust mites' },
        { patterns: ['pet dander', 'cat', 'dog', 'animal dander'], display: 'Pet dander' },
        { patterns: ['mold', 'mildew'], display: 'Mold' },
        { patterns: ['grass'], display: 'Grass pollen' },
        { patterns: ['tree'], display: 'Tree pollen' },
        { patterns: ['ragweed'], display: 'Ragweed' },
        
        // Other triggers
        { patterns: ['bee sting', 'bee'], display: 'Bee stings' },
        { patterns: ['wasp'], display: 'Wasp stings' },
        { patterns: ['perfume', 'fragrance'], display: 'Fragrances' },
        { patterns: ['smoke'], display: 'Smoke' },
        { patterns: ['latex'], display: 'Latex' }
    ];
    
    allergenPatterns.forEach(allergen => {
        // Check if any of the patterns match
        const found = allergen.patterns.some(pattern => lowerText.includes(pattern));
        if (found && !triggers.includes(allergen.display)) {
            triggers.push(allergen.display);
        }
    });
    
    console.log('🔍 ENHANCED PARSING: Extracted triggers:', triggers);
    return triggers;
}

/**
 * Extract allergy triggers from diagnostic workup section - ENHANCED
 */
function extractTriggersFromDiagnostic(diagnosticWorkup) {
    const triggers = [];
    
    if (!diagnosticWorkup) return triggers;
    
    const diagnosticText = diagnosticWorkup.toLowerCase();
    console.log('🔍 DIAGNOSTIC PARSING: Processing diagnostic workup:', diagnosticText);
    
    // Extract specific allergens from diagnostic testing mentions
    if (diagnosticText.includes('pollen')) {
        triggers.push('Pollen');
    }
    if (diagnosticText.includes('cat')) {
        triggers.push('Cat dander');
    }
    if (diagnosticText.includes('dog')) {
        triggers.push('Dog dander');
    }
    if (diagnosticText.includes('dust mites')) {
        triggers.push('Dust mites');
    }
    if (diagnosticText.includes('mold')) {
        triggers.push('Mold');
    }
    if (diagnosticText.includes('grass')) {
        triggers.push('Grass pollen');
    }
    if (diagnosticText.includes('tree')) {
        triggers.push('Tree pollen');
    }
    if (diagnosticText.includes('ragweed')) {
        triggers.push('Ragweed');
    }
    if (diagnosticText.includes('peanut')) {
        triggers.push('Peanuts');
    }
    if (diagnosticText.includes('nut')) {
        triggers.push('Tree nuts');
    }
    
    console.log('🔍 DIAGNOSTIC PARSING: Extracted triggers from diagnostic workup:', triggers);
    return triggers;
}

/**
 * Extract allergy triggers from SOAP notes patient history - ENHANCED VERSION
 */
function extractTriggersFromSOAP(soapNotes) {
    const triggers = [];
    
    if (!soapNotes?.patient_history?.history_of_present_illness) {
        return triggers;
    }
    
    const historyText = soapNotes.patient_history.history_of_present_illness.toLowerCase();
    console.log('🔍 SOAP PARSING: Processing patient history:', historyText);
    
    // Environmental triggers - ENHANCED DETECTION
    if (historyText.includes('pollen') || historyText.includes('seasonal')) {
        triggers.push('Pollen');
    }
    if (historyText.includes('dust mite') || historyText.includes('dust')) {
        triggers.push('Dust mites');
    }
    if (historyText.includes('pet dander') || historyText.includes('cat') || historyText.includes('dog')) {
        triggers.push('Pet dander');
    }
    if (historyText.includes('mold') || historyText.includes('mildew')) {
        triggers.push('Mold');
    }
    if (historyText.includes('grass')) {
        triggers.push('Grass pollen');
    }
    if (historyText.includes('tree')) {
        triggers.push('Tree pollen');
    }
    if (historyText.includes('ragweed')) {
        triggers.push('Ragweed');
    }
    
    // Weather/Environmental
    if (historyText.includes('humid') || historyText.includes('moisture')) {
        triggers.push('Humidity');
    }
    if (historyText.includes('wind') || historyText.includes('outdoor')) {
        triggers.push('Wind/Outdoor air');
    }
    
    // Indoor triggers
    if (historyText.includes('indoor') || historyText.includes('house')) {
        triggers.push('Indoor allergens');
    }
    
    console.log('🔍 SOAP PARSING: Extracted triggers from SOAP:', triggers);
    return triggers;
}

/**
 * Parse and display allergy triggers in pill format matching the wireframe - ENHANCED FINAL VERSION
 */
function renderAllergyTriggers(allergyTriggersString, soapNotes = null) {
    console.log('🔧 ENHANCED FINAL: Rendering allergy triggers:', allergyTriggersString);
    console.log('🔧 ENHANCED FINAL: SOAP Notes provided:', !!soapNotes);
    
    let triggers = [];
    
    // 1. First, try to extract triggers from SOAP notes if available
    if (soapNotes?.patient_history?.history_of_present_illness) {
        triggers = extractTriggersFromSOAP(soapNotes);
        console.log('🔧 ENHANCED FINAL: Extracted from SOAP history:', triggers);
    }
    
    // 2. Also check diagnostic workup for allergens being tested
    if (soapNotes?.diagnostic_workup) {
        const diagnosticTriggers = extractTriggersFromDiagnostic(soapNotes.diagnostic_workup);
        console.log('🔧 ENHANCED FINAL: Extracted from diagnostic workup:', diagnosticTriggers);
        // Merge without duplicates
        diagnosticTriggers.forEach(trigger => {
            if (!triggers.includes(trigger)) {
                triggers.push(trigger);
            }
        });
    }
    
    // 3. If no triggers found in SOAP, try to parse from the allergy triggers string
    if (triggers.length === 0 && allergyTriggersString) {
        triggers = parseAllergyTriggersFromString(allergyTriggersString);
        console.log('🔧 ENHANCED FINAL: Extracted from allergy string:', triggers);
    }
    
    console.log('🔧 ENHANCED FINAL: Final triggers to render:', triggers);
    
    // Generate the HTML for the triggers
    if (triggers.length > 0) {
        return `
            <div style="display: flex; flex-direction: column; gap: 8px;">
                ${triggers.map(trigger => `
                    <div style="
                        padding: 12px 16px;
                        background: #dbeafe;
                        color: #1d4ed8;
                        border-radius: 8px;
                        font-size: 14px;
                        font-weight: 500;
                        border: 1px solid #bfdbfe;
                        transition: all 0.2s ease;
                    ">
                        ${trigger}
                    </div>
                `).join('')}
            </div>
        `;
    } else {
        // Show the original string or default message
        const displayText = allergyTriggersString || 'No specific triggers identified';
        return `
            <div style="
                padding: 16px;
                background: #f9fafb;
                color: #6b7280;
                border-radius: 8px;
                font-size: 14px;
                font-style: italic;
                border: 1px solid #e5e7eb;
                text-align: center;
            ">
                ${displayText}
            </div>
        `;
    }
}

/**
 * Update allergy triggers display with wireframe styling - ENHANCED FINAL VERSION
 */
function updateAllergyTriggersDisplay(transcript) {
    console.log('✅ ENHANCED FINAL: Updating allergy triggers display');
    console.log('✅ ENHANCED FINAL: Transcript insights:', transcript.insights);
    console.log('✅ ENHANCED FINAL: SOAP Notes available:', !!transcript.soapNotes);
    
    const insightsAllergyTriggers = document.getElementById('insights-allergy-triggers');
    if (insightsAllergyTriggers) {
        const allergyTriggersHTML = renderAllergyTriggers(
            transcript.insights?.allergy_triggers, 
            transcript.soapNotes
        );
        // Clear existing content completely and replace with new content
        insightsAllergyTriggers.innerHTML = allergyTriggersHTML;
        console.log('✅ ENHANCED FINAL: Successfully updated allergy triggers display');
    } else {
        console.error('❌ insights-allergy-triggers element not found in DOM');
    }
}

/**
 * Update condition display to match wireframe - ENHANCED FINAL VERSION
 */
function updateConditionDisplay(transcript) {
    console.log('✅ ENHANCED FINAL: Updating condition display');
    
    const insightsCondition = document.getElementById('insights-condition');
    if (insightsCondition) {
        const conditions = transcript.insights?.condition ? 
            transcript.insights.condition.split(',').map(c => c.trim()) : 
            ['No conditions identified'];
            
        const conditionsHTML = `
            <div style="display: flex; flex-direction: column; gap: 8px;">
                ${conditions.map(condition => `
                    <div style="
                        padding: 12px 16px;
                        background: #dcfce7;
                        color: #15803d;
                        border-radius: 8px;
                        font-size: 14px;
                        font-weight: 500;
                        border: 1px solid #bbf7d0;
                        transition: all 0.2s ease;
                    ">
                        ${condition}
                    </div>
                `).join('')}
            </div>
        `;
        
        // Clear existing content completely and replace
        insightsCondition.innerHTML = conditionsHTML;
        console.log('✅ ENHANCED FINAL: Successfully updated condition display');
    } else {
        console.error('❌ insights-condition element not found in DOM');
    }
}

// Helper function to normalize data to arrays (CRITICAL FIX)
function normalizeToArray(value) {
    if (Array.isArray(value)) {
        return value;
    } else if (typeof value === 'string' && value.trim() !== '') {
        return [value];
    } else {
        return [];
    }
}

// Helper function to safely access array methods
function safeArrayOperation(value, operation = 'filter', callback) {
    const arr = normalizeToArray(value);
    return arr[operation] ? arr[operation](callback) : arr;
}

// Enhanced Freed-Style Plan Parser with better pattern matching
class EnhancedFreedStylePlanParser {
    constructor() {
        this.conditionRegex = /In regards to\s+([^:]+):/gi;
    }

    parseFreedStylePlan(planText) {
        console.log('Parsing Enhanced Freed-style plan from SOAP notes...');
        console.log('Plan text received:', planText);
        
        if (!planText || typeof planText !== 'string' || !planText.trim()) {
            console.log('No plan text available for parsing');
            return this.createDefaultPlan();
        }

        try {
            // Parse the plan by medical conditions
            const conditionSections = this.extractConditionSections(planText);
            
            if (conditionSections.length === 0) {
                console.log('No "In regards to" sections found, parsing as narrative');
                return this.parseAsNarrativePlan(planText);
            }

            console.log('Successfully parsed condition sections:', conditionSections);
            return conditionSections;

        } catch (error) {
            console.error('Error parsing Freed-style plan:', error);
            return this.parseAsNarrativePlan(planText);
        }
    }

    extractConditionSections(planText) {
        const sections = [];
        
        // First, try to split by "In regards to" pattern
        const parts = planText.split(/(?=In regards to\s+[^:]+:)/gi);
        
        console.log('Split parts:', parts);
        
        parts.forEach((part, index) => {
            const trimmedPart = part.trim();
            if (!trimmedPart) return;
            
            // Check if this part starts with "In regards to"
            const match = trimmedPart.match(/^In regards to\s+([^:]+):\s*([\s\S]*)$/i);
            
            if (match) {
                const conditionName = match[1].trim();
                const content = match[2].trim();
                
                console.log(`Found condition: "${conditionName}" with content length: ${content.length}`);
                
                // Parse the bullet points for this condition
                const bulletPoints = this.extractBulletPoints(content);
                
                if (bulletPoints.length > 0) {
                    sections.push({
                        title: conditionName,
                        type: 'condition',
                        content: bulletPoints,
                        isNarrative: true
                    });
                    console.log(`Added section for "${conditionName}" with ${bulletPoints.length} points`);
                }
            } else if (trimmedPart.length > 50 && index === 0) {
                // If the first part doesn't match pattern but has content, might be unformatted plan
                console.log('First part does not match pattern, treating as general plan');
                const bulletPoints = this.extractBulletPoints(trimmedPart);
                if (bulletPoints.length > 0) {
                    sections.push({
                        title: 'Treatment Plan',
                        type: 'general',
                        content: bulletPoints,
                        isNarrative: true
                    });
                }
            }
        });
        
        return sections;
    }

    extractBulletPoints(content) {
        const points = [];
        
        // Split by asterisks, bullets, or dashes, preserving the narrative style
        const lines = content.split(/\n\s*[\*\•\-]\s*/).filter(line => line.trim());
        
        lines.forEach(line => {
            const cleanedLine = line.trim();
            if (cleanedLine && cleanedLine.length > 15) { // Minimum length for meaningful content
                // Keep the full narrative sentence
                points.push(cleanedLine);
            }
        });
        
        // If no bullet points found, try splitting by sentences
        if (points.length === 0) {
            const sentences = content.split(/\.\s+/).filter(sentence => sentence.trim().length > 30);
            sentences.forEach(sentence => {
                if (sentence.trim()) {
                    const finalSentence = sentence.trim() + (sentence.endsWith('.') ? '' : '.');
                    points.push(finalSentence);
                }
            });
        }
        
        // If still no points, try splitting by line breaks
        if (points.length === 0) {
            const lineBreaks = content.split(/\n+/).filter(line => line.trim().length > 20);
            lineBreaks.forEach(line => {
                const cleanedLine = line.trim();
                if (cleanedLine) {
                    points.push(cleanedLine);
                }
            });
        }
        
        console.log(`Extracted ${points.length} bullet points from content`);
        return points;
    }

    parseAsNarrativePlan(planText) {
        console.log('Parsing as narrative plan without condition headers');
        
        // Try to identify natural sections or paragraphs
        const paragraphs = planText.split(/\n\n+/).filter(p => p.trim());
        
        if (paragraphs.length > 1) {
            // Multiple paragraphs - treat each as a section
            return paragraphs.map((paragraph, index) => {
                const bullets = this.extractBulletPoints(paragraph);
                return {
                    title: `Clinical Plan ${index + 1}`,
                    type: 'narrative',
                    content: bullets.length > 0 ? bullets : [paragraph.trim()],
                    isNarrative: true
                };
            });
        } else {
            // Single block - extract bullet points or sentences
            const bullets = this.extractBulletPoints(planText);
            return [{
                title: 'Treatment Plan',
                type: 'narrative',
                content: bullets.length > 0 ? bullets : [planText.trim()],
                isNarrative: true
            }];
        }
    }

    createDefaultPlan() {
        return [{
            title: 'Treatment Plan',
            type: 'default',
            content: ['No treatment plan available. Please submit a transcript to generate comprehensive plan.'],
            isNarrative: true
        }];
    }
}

// Function to submit transcript using Freed-style endpoint - FIXED WITH AUTH
async function submitTranscriptFreedStyle(transcript, patientId, visitId, email, tenantId) {
    try {
        console.log('Submitting transcript for Freed-style analysis...');
        
        const response = await fetch('/api/analyze-transcript-freed', {
            method: 'POST',
            headers: getAuthHeaders(), // ✅ FIXED: Added authentication
            body: JSON.stringify({
                transcript: transcript,
                patientId: patientId,
                visitId: visitId,
                email: email,
                tenantId: tenantId
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Freed-style analysis response:', data);
        
        return data;
    } catch (error) {
        console.error('Error submitting transcript for Freed-style analysis:', error);
        throw error;
    }
}

// Enhanced Freed-style plan parsing function
function parseFreedStylePlanEnhanced(soapNotes) {
    console.log('Using Enhanced Freed-Style Narrative Plan Parsing');
    console.log('SOAP Notes received:', soapNotes);
    
    if (!soapNotes || !soapNotes.plan_of_care) {
        console.log('No plan_of_care found in SOAP notes');
        return new EnhancedFreedStylePlanParser().createDefaultPlan();
    }
    
    const parser = new EnhancedFreedStylePlanParser();
    const planSections = parser.parseFreedStylePlan(soapNotes.plan_of_care);
    
    console.log('Enhanced Freed-Style Plan Parsed:', planSections);
    return planSections;
}

// Initialize user data on page load to ensure correct tenantID
async function initializeUserData() {
    try {
        let attempts = 0;
        const maxAttempts = 10;
        const retryInterval = 500; // 500ms

        while (attempts < maxAttempts) {
            if (window.currentEmail) {
                currentEmail = window.currentEmail;
                currentTenantId = window.currentEmail;
                currentRole = null;
                console.log('Initialized user data from window.currentEmail:', { 
                    currentEmail, 
                    currentTenantId, 
                    currentRole 
                });
                return true;
            }

            const userData = JSON.parse(localStorage.getItem('user') || '{}');
            if (userData.email) {
                currentEmail = userData.email;
                currentTenantId = userData.email;
                currentRole = userData.role || null;
                console.log('Initialized user data from localStorage:', { 
                    currentEmail, 
                    currentTenantId, 
                    currentRole 
                });
                return true;
            }

            console.log(`User data not ready, retrying (${attempts + 1}/${maxAttempts})...`);
            await new Promise(resolve => setTimeout(resolve, retryInterval));
            attempts++;
        }

        console.error('Failed to initialize user data after max attempts');
        return false;
    } catch (error) {
        console.error('Error initializing user data:', error.message);
        return false;
    }
}

// Fetch patients from backend - FIXED WITH AUTH
async function fetchPatients() {
    console.log('Fetching patients for tenant:', currentTenantId);
    window.showSpinner();
    try {
        if (typeof currentTenantId === 'undefined' || currentTenantId === null) {
            if (typeof currentEmail !== 'undefined' && currentEmail !== null) {
                currentTenantId = currentEmail;
                console.log('Setting tenantID to email for DynamoDB GSI compatibility:', currentTenantId);
            } else {
                throw new Error('Tenant ID is not defined. Please ensure you are logged in.');
            }
        } else if (currentTenantId !== currentEmail && currentEmail !== null) {
            console.warn('TenantID doesn\'t match email, updating for GSI compatibility:', {
                oldTenantId: currentTenantId,
                newTenantId: currentEmail
            });
            currentTenantId = currentEmail;
        }
        
        const apiUrl = `/api/get-patients?tenantId=${encodeURIComponent(currentTenantId)}`;
        console.log('API call to match DynamoDB GSI query:', apiUrl);
        
        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: getAuthHeaders() // ✅ FIXED: Added authentication
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
        const initials = (patient.name && typeof patient.name === 'string') ? 
            patient.name.split(' ').map(word => word[0]).join('').substring(0, 2).toUpperCase() : 'NA';
        const visitType = patient.visitType || 'follow-up';
        const badgeHtml = visitType === 'today' ? `<span class="visit-badge today">Today</span>` : '';
        const createdAtDate = new Date(patient.createdAt + (patient.createdAt.endsWith('Z') ? '' : 'Z'));
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

        document.getElementById('patient-sidebar').classList.remove('collapsed');
        document.querySelector('.container').classList.remove('patient-view');
        document.getElementById('patient-details').style.display = 'none';

        window.setTimeout(function() {
            window.dispatchEvent(new Event('resize'));
        }, 50);

        if (!preservePatientId) {
            console.log('Resetting patient state: currentPatientId before reset:', currentPatientId);
            currentPatientId = null;
            currentPatient = null;
            console.log('Resetting patient state: currentPatientId after reset:', currentPatientId);
        } else {
            console.log('Preserving patient state: currentPatientId:', currentPatientId);
        }

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
            startListeningBtn.disabled = false;
            startListeningBtn.classList.remove('disabled');
            stopListeningBtn.disabled = true;
            stopListeningBtn.classList.add('disabled');
            transcriptInput.value = '';
            console.log('Cleared transcript input for new visit, current value:', transcriptInput.value);
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

        const subjectiveContent = document.getElementById('subjective-content');
        const objectiveContent = document.getElementById('objective-content');
        const assessmentContent = document.getElementById('assessment-content');
        const planContainer = document.getElementById('plan-content-container');
        if (subjectiveContent) subjectiveContent.innerHTML = '';
        if (objectiveContent) objectiveContent.innerHTML = '';
        if (assessmentContent) assessmentContent.innerHTML = '';
        if (planContainer) planContainer.innerHTML = '';

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

        const notesSection = document.getElementById('notes-section');
        if (notesSection) notesSection.style.display = 'block';

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
    
    if (typeof currentEmail === 'undefined' || currentEmail === null) {
        alert('Current email is not defined. Please ensure you are logged in.');
        return;
    }
    if (typeof templates === 'undefined' || !Array.isArray(templates)) {
        alert('Templates are not defined. Please ensure the application is properly initialized.');
        return;
    }

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

// Proceed with visit after template selection - FIXED WITH AUTH
async function proceedWithVisit(patientId) {
    if (!currentTemplate) {
        alert('No template selected. Please select a template to start a visit.');
        return;
    }

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
    
    // Check if token is expired
    if (isTokenExpired()) {
        alert('Your session has expired. Please log in again.');
        window.location.href = '/login.html';
        return;
    }
    
    window.showSpinner();
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const requestBody = {
            patientId, 
            email: currentEmail, 
            tenantId: currentEmail
        };
        
        console.log('API request for starting visit:', requestBody);

        const response = await fetch('/api/visit/start', {
            method: 'POST',
            headers: getAuthHeaders(), // ✅ FIXED: Added authentication
            body: JSON.stringify(requestBody),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

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
                startListeningBtn.removeAttribute('disabled');
                startListeningBtn.classList.remove('disabled');
                startListeningBtn.style.pointerEvents = 'auto';
                startListeningBtn.style.opacity = '1';
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
            await fetchPatients();
            console.log('Updated patients list after fetch:', patients);
            const newPatient = patients.find(p => p.patientId === currentPatientId);
            if (newPatient) {
                console.log('Selecting new patient:', newPatient);
                await selectPatient(newPatient);
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

// Toggle function for collapsible recommendation categories (FIXED)
window.toggleRecommendationCategory = function(categoryId) {
    console.log('🎯 TOGGLE: Toggling category:', categoryId);
    const content = document.getElementById(categoryId + '-content');
    const toggle = document.getElementById(categoryId + '-toggle');
    
    if (content && toggle) {
        const isCollapsed = content.style.maxHeight === '0px' || content.style.maxHeight === '';
        
        if (isCollapsed) {
            // Expand
            content.style.maxHeight = '2000px';
            content.style.opacity = '1';
            content.style.padding = '16px';
            toggle.textContent = '[-]';
            console.log('🎯 TOGGLE: Expanded category:', categoryId);
        } else {
            // Collapse
            content.style.maxHeight = '0px';
            content.style.opacity = '0';
            content.style.padding = '0';
            toggle.textContent = '[+]';
            console.log('🎯 TOGGLE: Collapsed category:', categoryId);
        }
    } else {
        console.error('🎯 TOGGLE: Could not find elements for category:', categoryId);
    }
};

// Select a patient with enhanced card-based recommendations (FIXED WITH COLLAPSIBLE FUNCTIONALITY AND ASSESSMENT FORMATTING) - FIXED WITH AUTH
async function selectPatient(patient) {
    console.log('Before setting patient in selectPatient: currentPatientId:', currentPatientId);
    currentPatientId = patient.patientId;
    currentPatient = patient;
    console.log('After setting patient in selectPatient: currentPatientId:', currentPatientId);
    console.log('Selected patient:', JSON.stringify(patient, null, 2));

    const patientDetails = document.getElementById('patient-details');
    const patientList = document.getElementById('patient-list');
    const transcriptSection = document.getElementById('transcript-section');
    const nameEl = document.getElementById('patient-details-name');
    const mrnEl = document.getElementById('patient-details-mrn');
    const lastVisitEl = document.getElementById('patient-details-last-visit');
    const currentVisitEl = document.getElementById('patient-details-current-visit');
    const visitHistoryEl = document.getElementById('patient-details-visit-history');

    const isDST = (date) => {
        const jan = new Date(date.getFullYear(), 0, 1);
        const jul = new Date(date.getFullYear(), 6, 1);
        const stdOffset = Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
        return date.getTimezoneOffset() < stdOffset ? 'EDT' : 'EST';
    };

    const formatDateTime = (dateStr) => {
        if (!dateStr) return 'N/A';
        const date = new Date(dateStr + (dateStr.endsWith('Z') ? '' : 'Z'));
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

    if (patientDetails && patientList && transcriptSection) {
        patientDetails.style.display = 'block';
        patientList.style.display = 'none';
        transcriptSection.style.display = 'block';

        document.getElementById('patient-sidebar').classList.add('collapsed');
        document.querySelector('.container').classList.add('patient-view');
        document.getElementById('patient-details').style.display = 'block';

        window.setTimeout(function() {
            window.dispatchEvent(new Event('resize'));
        }, 50);

        if (nameEl) {
            nameEl.textContent = patient.name || 'N/A';
            nameEl.dataset.patientId = patient.patientId;
        } else {
            console.error('patient-details-name element not found');
        }
        if (mrnEl) {
            mrnEl.textContent = patient.mrn || 'N/A';
        } else {
            console.error('patient-details-mrn element not found');
        }
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
            currentVisitEl.dataset.visitId = activeVisitId || '';
        } else {
            console.error('patient-details-current-visit element not found');
        }
        if (visitHistoryEl) {
            visitHistoryEl.innerHTML = '<div>No visit history available.</div>';
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

    if (currentTenantId !== currentEmail) {
        console.warn('Fixing tenantID for DynamoDB GSI compliance:', {
            oldTenantId: currentTenantId,
            correctTenantId: currentEmail
        });
        currentTenantId = currentEmail;
    }

    window.showContentSpinner();
    try {
        const apiUrl = `/api/get-patient-history?tenantId=${encodeURIComponent(currentTenantId)}&patientId=${currentPatientId}`;
        console.log('Fetching patient history using tenantID for GSI:', apiUrl);
        
        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: getAuthHeaders() // ✅ FIXED: Added authentication
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to fetch patient history: HTTP ${response.status} - ${errorText}`);
        }
        
        const data = await response.json();
        console.log('Patient history response:', JSON.stringify(data, null, 2));
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
                console.log('Forcing UI refresh for no transcripts...');
                notesSection.style.display = 'none';
                setTimeout(() => {
                    notesSection.style.display = 'block';
                    window.dispatchEvent(new Event('resize'));
                }, 50);
            }
            window.hideContentSpinner();
            return;
        }
        data.transcripts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        if (data.transcripts.length > 0) {
            patient.currentVisit = data.transcripts[0].createdAt;
            if (data.transcripts.length > 1) {
                patient.lastVisit = data.transcripts[1].createdAt;
            }
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
        
        // CRITICAL FIX: Process transcripts with safe array handling
        data.transcripts.forEach(async transcript => {
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
                
                // FIXED: Assessment content formatting with proper CSS class application
                const assessmentContent = document.getElementById('assessment-content');
                if (assessmentContent) {
                    // Apply the CSS class for proper formatting
                    assessmentContent.className = 'assessment-content';
                    
                    let assessmentText = transcript.soapNotes.differential_diagnosis || 'Not specified';
                    // Clean up the text formatting - replace asterisks with proper line breaks but avoid excessive spacing
                    assessmentText = assessmentText.replace(/\*/g, '<br>•');
                    // Remove excessive line breaks and normalize spacing
                    assessmentText = assessmentText.replace(/\n\s*\n/g, '<br>').replace(/\n/g, ' ');
                    
                    assessmentContent.innerHTML = `
                        ${assessmentText}<br><br>
                        The assessment considers the patient's symptoms, history, and physical findings to determine potential diagnoses and contributing factors. Differential diagnoses are prioritized based on clinical presentation, with recommendations for further evaluation to confirm the primary diagnosis.
                    `;
                    
                    console.log('Assessment formatting applied with CSS class:', assessmentContent.className);
                }
                
                // ENHANCED PLAN RENDERING - FREED STYLE
                const planContainer = document.getElementById('plan-content-container');
                if (planContainer) {
                    console.log('Rendering Freed-style plan...');

                    // Parse the plan using the new Freed-style parser
                    const planSections = parseFreedStylePlanEnhanced(transcript.soapNotes);
                    console.log('Parsed Freed-style plan sections:', planSections);

                    // Clear the container
                    planContainer.innerHTML = '';

                    // Render each section in Freed style
                    planSections.forEach((section, index) => {
                        const sectionDiv = document.createElement('div');
                        sectionDiv.className = 'freed-plan-section';
                        sectionDiv.style.marginBottom = '20px';

                        // Create section header
                        const headerDiv = document.createElement('div');
                        headerDiv.className = 'freed-plan-header';
                        headerDiv.style.fontWeight = 'bold';
                        headerDiv.style.marginBottom = '8px';
                        headerDiv.style.color = '#2c3e50';
                        
                        if (section.type === 'condition') {
                            headerDiv.textContent = `In regards to ${section.title}:`;
                        } else {
                            headerDiv.textContent = `${section.title}:`;
                        }

                        // Create content area
                        const contentDiv = document.createElement('div');
                        contentDiv.className = 'freed-plan-content';
                        contentDiv.style.lineHeight = '1.6';
                        contentDiv.style.marginLeft = '0px';

                        // Render bullet points as narrative paragraphs
                        section.content.forEach(item => {
                            const bulletDiv = document.createElement('div');
                            bulletDiv.className = 'freed-plan-item';
                            bulletDiv.style.marginBottom = '6px';
                            bulletDiv.style.position = 'relative';
                            bulletDiv.style.paddingLeft = '0px';
                            
                            // Use asterisk bullet style like Freed
                            bulletDiv.innerHTML = `<span style="font-weight: bold; margin-right: 8px;">*</span>${item}`;
                            
                            contentDiv.appendChild(bulletDiv);
                        });

                        sectionDiv.appendChild(headerDiv);
                        sectionDiv.appendChild(contentDiv);
                        planContainer.appendChild(sectionDiv);
                    });

                    planContainer.style.display = 'block';
                    console.log('Freed-style plan rendered successfully');
                } else {
                    console.error('Plan container element not found in DOM');
                }

                // ✅ ENHANCED FINAL: Use the enhanced allergy triggers and conditions display functions
                updateAllergyTriggersDisplay(transcript);
                updateConditionDisplay(transcript);

                // COMPREHENSIVE ENHANCED CARD-BASED RECOMMENDATIONS DISPLAY WITH FIXED COLLAPSIBLE FUNCTIONALITY
                const insightsRecommendations = document.getElementById('insights-recommendations');
                if (insightsRecommendations) {
                    console.log('🎯 COMPREHENSIVE: Creating ALL possible categories');
                    console.log('🎯 COMPREHENSIVE: Full SOAP notes:', transcript.soapNotes);
                    console.log('🎯 COMPREHENSIVE: Full insights:', transcript.insights);
                    
                    // Start with ALL possible categories
                    const allCategories = {
                        'EMERGENCY ACTION PLAN': [],
                        'MEDICATION MANAGEMENT': [],
                        'PATIENT EDUCATION RESOURCES': [],
                        'PATIENT EDUCATION': [],
                        'FOLLOW-UP CARE': [],
                        'DIAGNOSTIC TESTS': [],
                        'MONITORING': [],
                        'LIFESTYLE MODIFICATIONS': [],
                        'REFERRALS': [],
                        'PREVENTIVE MEASURES': [],
                        'ALLERGY MANAGEMENT': [],
                        'ENVIRONMENTAL CONTROL': [],
                        'DIETARY RECOMMENDATIONS': [],
                        'IMMUNOTHERAPY': [],
                        'TRIGGER AVOIDANCE': [],
                        'SYMPTOM TRACKING': [],
                        'LABORATORY TESTS': [],
                        'SPECIALIST REFERRAL': [],
                        'EMERGENCY PREPAREDNESS': []
                    };
                    
                    // Get base recommendations and merge them
                    const baseRecommendations = transcript.insights?.recommendations || transcript.soapNotes?.enhanced_recommendations || {};
                    Object.keys(baseRecommendations).forEach(category => {
                        if (allCategories.hasOwnProperty(category)) {
                            allCategories[category] = baseRecommendations[category];
                        }
                    });
                    
                    // Extract from DIAGNOSTIC WORKUP - WITH SAFE ARRAY HANDLING
                    if (transcript.soapNotes?.diagnostic_workup) {
                        const diagnosticWorkup = normalizeToArray(transcript.soapNotes.diagnostic_workup);
                        allCategories['DIAGNOSTIC TESTS'] = [...allCategories['DIAGNOSTIC TESTS'], ...diagnosticWorkup];
                    }
                    
                    // Extract from FOLLOW-UP INSTRUCTIONS - CRITICAL FIX APPLIED HERE
                    if (transcript.soapNotes?.follow_up_instructions) {
                        const followUpInstructions = normalizeToArray(transcript.soapNotes.follow_up_instructions);
                        allCategories['FOLLOW-UP CARE'] = followUpInstructions;
                        
                        // Check for monitoring-related instructions
                        const monitoringItems = safeArrayOperation(followUpInstructions, 'filter', item => 
                            item.toLowerCase().includes('monitor') || 
                            item.toLowerCase().includes('track') || 
                            item.toLowerCase().includes('watch') ||
                            item.toLowerCase().includes('observe')
                        );
                        if (monitoringItems.length > 0) {
                            allCategories['MONITORING'] = monitoringItems;
                        }
                        
                        // Check for specialist referrals
                        const referralItems = safeArrayOperation(followUpInstructions, 'filter', item => 
                            item.toLowerCase().includes('refer') || 
                            item.toLowerCase().includes('specialist') || 
                            item.toLowerCase().includes('consult')
                        );
                        if (referralItems.length > 0) {
                            allCategories['SPECIALIST REFERRAL'] = referralItems;
                            allCategories['REFERRALS'] = referralItems;
                        }
                        
                        // Check for immunotherapy mentions
                        const immunotherapyItems = safeArrayOperation(followUpInstructions, 'filter', item => 
                            item.toLowerCase().includes('allergy shot') || 
                            item.toLowerCase().includes('immunotherapy') || 
                            item.toLowerCase().includes('desensitization')
                        );
                        if (immunotherapyItems.length > 0) {
                            allCategories['IMMUNOTHERAPY'] = immunotherapyItems;
                        }
                    }
                    
                    // Extract from PATIENT EDUCATION - WITH SAFE ARRAY HANDLING
                    if (transcript.soapNotes?.patient_education) {
                        const patientEducation = normalizeToArray(transcript.soapNotes.patient_education);
                        allCategories['PATIENT EDUCATION'] = patientEducation;
                        
                        // Check for trigger avoidance
                        const triggerItems = safeArrayOperation(patientEducation, 'filter', item => 
                            item.toLowerCase().includes('avoid') || 
                            item.toLowerCase().includes('prevent') || 
                            item.toLowerCase().includes('trigger')
                        );
                        if (triggerItems.length > 0) {
                            allCategories['TRIGGER AVOIDANCE'] = triggerItems;
                            allCategories['PREVENTIVE MEASURES'] = [...allCategories['PREVENTIVE MEASURES'], ...triggerItems];
                        }
                        
                        // Check for environmental control
                        const environmentalItems = safeArrayOperation(patientEducation, 'filter', item => 
                            item.toLowerCase().includes('outdoor') || 
                            item.toLowerCase().includes('yard') || 
                            item.toLowerCase().includes('environment') ||
                            item.toLowerCase().includes('shoe') ||
                            item.toLowerCase().includes('clothing')
                        );
                        if (environmentalItems.length > 0) {
                            allCategories['ENVIRONMENTAL CONTROL'] = environmentalItems;
                        }
                        
                        // Check for lifestyle modifications
                        const lifestyleItems = safeArrayOperation(patientEducation, 'filter', item => 
                            item.toLowerCase().includes('wear') || 
                            item.toLowerCase().includes('lifestyle') || 
                            item.toLowerCase().includes('habit') ||
                            item.toLowerCase().includes('routine')
                        );
                        if (lifestyleItems.length > 0) {
                            allCategories['LIFESTYLE MODIFICATIONS'] = lifestyleItems;
                        }
                    }
                    
                    // Extract allergy management from various sources
                    const allergyManagementItems = [];
                    if (transcript.soapNotes?.plan_of_care) {
                        const planText = transcript.soapNotes.plan_of_care.toLowerCase();
                        if (planText.includes('allergy') || planText.includes('allergic reaction')) {
                            allergyManagementItems.push('Comprehensive allergy management plan established');
                        }
                        if (planText.includes('epipen') || planText.includes('epinephrine')) {
                            allergyManagementItems.push('EpiPen prescribed for emergency management');
                            allCategories['EMERGENCY PREPAREDNESS'].push('Carry EpiPen at all times for severe allergic reactions');
                        }
                        if (planText.includes('antihistamine') || planText.includes('zyrtec') || planText.includes('benadryl')) {
                            allergyManagementItems.push('Antihistamine therapy for symptom control');
                        }
                    }
                    if (allergyManagementItems.length > 0) {
                        allCategories['ALLERGY MANAGEMENT'] = allergyManagementItems;
                    }
                    
                    // Add symptom tracking if mentioned - WITH SAFE ARRAY HANDLING
                    if (transcript.soapNotes?.follow_up_instructions) {
                        const followUpInstructions = normalizeToArray(transcript.soapNotes.follow_up_instructions);
                        const trackingItems = safeArrayOperation(followUpInstructions, 'filter', item => 
                            item.toLowerCase().includes('track') || 
                            item.toLowerCase().includes('record') || 
                            item.toLowerCase().includes('diary') ||
                            item.toLowerCase().includes('log')
                        );
                        if (trackingItems.length > 0) {
                            allCategories['SYMPTOM TRACKING'] = trackingItems;
                        }
                    }
                    
                    // Enhanced category icons mapping
                    const categoryIcons = {
                        'EMERGENCY ACTION PLAN': '🚨',
                        'MEDICATION MANAGEMENT': '💊',
                        'PATIENT EDUCATION RESOURCES': '📚',
                        'PATIENT EDUCATION': '📖',
                        'FOLLOW-UP CARE': '📅',
                        'DIAGNOSTIC TESTS': '🔬',
                        'MONITORING': '📊',
                        'LIFESTYLE MODIFICATIONS': '🏃',
                        'REFERRALS': '👨‍⚕️',
                        'PREVENTIVE MEASURES': '🛡️',
                        'ALLERGY MANAGEMENT': '🤧',
                        'ENVIRONMENTAL CONTROL': '🌿',
                        'DIETARY RECOMMENDATIONS': '🥗',
                        'IMMUNOTHERAPY': '💉',
                        'TRIGGER AVOIDANCE': '⚠️',
                        'SYMPTOM TRACKING': '📝',
                        'LABORATORY TESTS': '🧪',
                        'SPECIALIST REFERRAL': '🏥',
                        'EMERGENCY PREPAREDNESS': '🆘'
                    };
                    
                    console.log('🎯 COMPREHENSIVE: Final all categories:', allCategories);
                    
                    // Filter to only show categories that have content
                    const recommendations = {};
                    Object.keys(allCategories).forEach(category => {
                        if (allCategories[category].length > 0) {
                            recommendations[category] = allCategories[category];
                        }
                    });
                    
                    console.log('🎯 COMPREHENSIVE: Filtered recommendations with content:', recommendations);
                    console.log('🎯 COMPREHENSIVE: Total categories with content:', Object.keys(recommendations).length);
                    
                    if (typeof recommendations === 'object' && recommendations !== null && Object.keys(recommendations).length > 0) {
                        
                        // Create the card-based HTML structure with PROPER COLLAPSIBLE FUNCTIONALITY
                        let cardHTML = `
                            <div id="recommendations-card-container" style="
                                background: white;
                                border-radius: 12px;
                                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                                overflow: hidden;
                                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                            ">
                                <div style="
                                    background: #f8f9fa;
                                    padding: 16px 20px;
                                    border-bottom: 1px solid #e9ecef;
                                ">
                                    <h2 style="
                                        margin: 0;
                                        font-size: 18px;
                                        font-weight: 600;
                                        color: #2c3e50;
                                        letter-spacing: 0.5px;
                                    ">RECOMMENDATIONS</h2>
                                </div>
                                
                                <div style="padding: 20px;">
                                    <h3 style="
                                        margin: 0 0 16px 0;
                                        font-size: 16px;
                                        font-weight: 600;
                                        color: #495057;
                                        text-transform: uppercase;
                                        letter-spacing: 0.3px;
                                    ">CLINICAL RECOMMENDATIONS</h3>
                        `;
                        
                        // Process each category in a specific order
                        const categoryOrder = [
                            'EMERGENCY ACTION PLAN',
                            'EMERGENCY PREPAREDNESS', 
                            'MEDICATION MANAGEMENT',
                            'ALLERGY MANAGEMENT',
                            'DIAGNOSTIC TESTS',
                            'LABORATORY TESTS',
                            'MONITORING',
                            'FOLLOW-UP CARE',
                            'PATIENT EDUCATION RESOURCES',
                            'PATIENT EDUCATION',
                            'TRIGGER AVOIDANCE',
                            'PREVENTIVE MEASURES',
                            'ENVIRONMENTAL CONTROL',
                            'LIFESTYLE MODIFICATIONS',
                            'IMMUNOTHERAPY',
                            'SYMPTOM TRACKING',
                            'DIETARY RECOMMENDATIONS',
                            'REFERRALS',
                            'SPECIALIST REFERRAL'
                        ];
                        
                        categoryOrder.forEach(category => {
                            if (recommendations[category] && Array.isArray(recommendations[category]) && recommendations[category].length > 0) {
                                const items = recommendations[category];
                                const categoryKey = category.toUpperCase().replace(/[^A-Z\s]/g, '').trim();
                                const icon = categoryIcons[categoryKey] || '📋';
                                const itemCount = items.length;
                                const categoryId = `category-${categoryKey.replace(/\s+/g, '-').toLowerCase()}`;
                                
                                console.log(`🎯 COMPREHENSIVE: Processing category: ${category} with ${itemCount} items`);
                                
                                cardHTML += `
                                    <div style="
                                        border: 1px solid #e9ecef;
                                        border-radius: 8px;
                                        margin-bottom: 12px;
                                        overflow: hidden;
                                        transition: all 0.2s ease;
                                    " onmouseover="this.style.boxShadow='0 2px 8px rgba(0,0,0,0.1)'" onmouseout="this.style.boxShadow='none'">
                                        
                                        <div style="
                                            background: #ffffff;
                                            padding: 12px 16px;
                                            cursor: pointer;
                                            display: flex;
                                            align-items: center;
                                            justify-content: space-between;
                                            border-bottom: 1px solid #f1f3f4;
                                            user-select: none;
                                        " onclick="toggleRecommendationCategory('${categoryId}')">
                                            
                                            <div style="display: flex; align-items: center; gap: 12px;">
                                                <span style="
                                                    font-size: 20px;
                                                    width: 24px;
                                                    height: 24px;
                                                    display: flex;
                                                    align-items: center;
                                                    justify-content: center;
                                                ">${icon}</span>
                                                
                                                <span style="
                                                    font-weight: 600;
                                                    color: #007bff;
                                                    font-size: 14px;
                                                    text-transform: uppercase;
                                                    letter-spacing: 0.3px;
                                                ">${category}</span>
                                            </div>
                                            
                                            <div style="display: flex; align-items: center; gap: 8px;">
                                                <span style="
                                                    background: #007bff;
                                                    color: white;
                                                    padding: 2px 8px;
                                                    border-radius: 12px;
                                                    font-size: 12px;
                                                    font-weight: 600;
                                                    min-width: 20px;
                                                    text-align: center;
                                                ">${itemCount}</span>
                                                
                                                <span id="${categoryId}-toggle" style="
                                                    font-size: 12px;
                                                    color: #6c757d;
                                                    transition: transform 0.2s ease;
                                                    font-weight: bold;
                                                ">[+]</span>
                                            </div>
                                        </div>
                                        
                                        <div id="${categoryId}-content" style="
                                            background: #fafbfc;
                                            max-height: 0px;
                                            overflow: hidden;
                                            opacity: 0;
                                            transition: all 0.3s ease;
                                            padding: 0;
                                        ">
                                            <ul style="
                                                margin: 0;
                                                padding: 0 0 0 20px;
                                                list-style-type: disc;
                                                color: #495057;
                                            ">
                                `;
                                
                                // Add each recommendation item
                                items.forEach(item => {
                                    cardHTML += `
                                        <li style="
                                            margin-bottom: 8px;
                                            line-height: 1.5;
                                            font-size: 14px;
                                        ">${item}</li>
                                    `;
                                });
                                
                                cardHTML += `
                                            </ul>
                                        </div>
                                    </div>
                                `;
                            }
                        });
                        
                        cardHTML += `
                                </div>
                            </div>
                        `;
                        
                        // Set the HTML content
                        insightsRecommendations.innerHTML = cardHTML;
                        
                        // Remove any conflicting classes
                        insightsRecommendations.classList.remove('bulleted');
                        insightsRecommendations.removeAttribute('data-original-items');
                        
                        console.log('🎯 COMPREHENSIVE: Enhanced card-based recommendations display created with ALL categories (COLLAPSED by default)');
                        console.log('🎯 COMPREHENSIVE: Total categories displayed:', Object.keys(recommendations).length);
                        
                    } else {
                        insightsRecommendations.innerHTML = `
                            <div style="
                                background: white;
                                border-radius: 12px;
                                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                                padding: 20px;
                                text-align: center;
                                color: #6c757d;
                            ">
                                <p>No structured recommendations available</p>
                            </div>
                        `;
                    }
                }
                
                const notesSection = document.getElementById('notes-section');
                if (notesSection) notesSection.style.display = 'block';
                if (transcript.visitId && transcript.visitId !== 'undefined') {
                    activeVisitId = transcript.visitId;
                    console.log('Set activeVisitId in selectPatient:', activeVisitId);
                    if (window.updateProfileWithVisitId) {
                        console.log('[DEBUG] Manually calling updateProfileWithVisitId', { patientId: currentPatientId, visitId: activeVisitId });
                        window.updateProfileWithVisitId(currentPatientId, activeVisitId);
                    } else {
                        console.error('[ERROR] updateProfileWithVisitId not found');
                    }
                    window.fetchReferences(currentPatientId, activeVisitId);
                } else {
                    console.log('No valid visit ID available for references');
                    if (window.updateProfileWithVisitId) {
                        console.log('[DEBUG] Manually calling updateProfileWithVisitId with null visitId', { patientId: currentPatientId, visitId: null });
                        window.updateProfileWithVisitId(currentPatientId, null);
                    } else {
                        console.error('[ERROR] updateProfileWithVisitId not found');
                    }
                    window.hideReferencesSpinner();
                }
            }
        });

        if (typeof window.updateTooltipVisibility === 'function') {
            window.updateTooltipVisibility();
        } else {
            console.error('updateTooltipVisibility function not found');
        }
    } catch (error) {
        console.error('Error fetching patient history:', error.message);
        console.log('No transcripts found for patient:', currentPatientId);
        // Show default no-transcripts content...
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
            console.log('Forcing UI refresh for no transcripts...');
            notesSection.style.display = 'none';
            setTimeout(() => {
                notesSection.style.display = 'block';
                window.dispatchEvent(new Event('resize'));
            }, 50);
        }
    } finally {
        window.hideContentSpinner();
    }
}

// Delete a patient - FIXED WITH AUTH
async function deletePatient(patientId) {
    if (!confirm('Are you sure you want to delete this patient and all associated transcripts?')) return;
    
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
            tenantId: currentTenantId
        };
        
        console.log('Deleting patient with params:', requestBody);
        
        const response = await fetch('/api/delete-patient', {
            method: 'POST',
            headers: getAuthHeaders(), // ✅ FIXED: Added authentication
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
    localStorage.removeItem('user');
    localStorage.removeItem('idToken');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('currentEmail');
    currentEmail = null;
    currentTenantId = null;
    currentRole = null;
    currentPatientId = null;
    currentPatient = null;
    activeVisitId = null;
    patients = [];
    window.location.href = '/login.html';
}

// Function to ensure all categories start expanded (for debugging)
window.expandAllRecommendations = function() {
    const categoryContents = document.querySelectorAll('[id$="-content"]');
    const categoryToggles = document.querySelectorAll('[id$="-toggle"]');
    
    categoryContents.forEach(content => {
        if (content.id.includes('category-')) {
            content.style.maxHeight = '2000px';
            content.style.opacity = '1';
            content.style.padding = '16px';
        }
    });
    
    categoryToggles.forEach(toggle => {
        if (toggle.id.includes('category-')) {
            toggle.textContent = '[-]';
        }
    });
    
    console.log('🎯 Forced all recommendation categories to expand');
};

// Function to ensure all categories start collapsed (default behavior)
window.collapseAllRecommendations = function() {
    const categoryContents = document.querySelectorAll('[id$="-content"]');
    const categoryToggles = document.querySelectorAll('[id$="-toggle"]');
    
    categoryContents.forEach(content => {
        if (content.id.includes('category-')) {
            content.style.maxHeight = '0px';
            content.style.opacity = '0';
            content.style.padding = '0';
        }
    });
    
    categoryToggles.forEach(toggle => {
        if (toggle.id.includes('category-')) {
            toggle.textContent = '[+]';
        }
    });
    
    console.log('🎯 Forced all recommendation categories to collapse');
};

// Install an initialization function that runs on page load
window.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM loaded, initializing user data...');
    const initialized = await initializeUserData();
    
    if (initialized) {
        console.log('User data initialized successfully');
        if (document.getElementById('patient-list')) {
            console.log('Patient list found, fetching patients...');
            await fetchPatients();
        }
    } else {
        console.warn('Failed to initialize user data, may need to log in again');
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
window.parseGeneralAllergyPlan = parseGeneralAllergyPlan;
window.renderAllergyTriggers = renderAllergyTriggers;
window.updateAllergyTriggersDisplay = updateAllergyTriggersDisplay;
window.updateConditionDisplay = updateConditionDisplay;

// Backward compatibility wrapper
function parseGeneralAllergyPlan(transcriptText, soapNotes = null) {
    // If we have SOAP notes, use them directly (Freed-style format)
    if (soapNotes) {
        return parseFreedStylePlanEnhanced(soapNotes);
    }
    
    // Otherwise, create a basic structure
    console.log('No SOAP notes available, creating basic plan structure');
    return new EnhancedFreedStylePlanParser().createDefaultPlan();
}
