// SmartLearning.js - Handles SOAP notes customization for Medora
console.log('smartLearning.js loaded'); // Confirm script is loaded

// Configuration for SOAP sections
const SOAP_SECTIONS = {
    'subjective': {
        name: 'Subjective',
        fields: [
            { field: 'chief_complaint', label: 'Chief Complaint' },
            { field: 'history_of_present_illness', label: 'History of Present Illness' },
            { field: 'past_medical_history', label: 'Past Medical History' },
            { field: 'allergies', label: 'Allergies' },
            { field: 'social_history', label: 'Social History' },
            { field: 'review_of_systems', label: 'Review of Systems' }
        ]
    },
    'objective': {
        name: 'Objective',
        fields: [
            { field: 'physical_examination', label: 'Physical Examination' }
        ]
    },
    'assessment': {
        name: 'Assessment',
        fields: [
            { field: 'differential_diagnosis', label: 'Differential Diagnosis' }
        ]
    },
    'plan': {
        name: 'Plan',
        fields: [
            { field: 'diagnostic_workup', label: 'Diagnostic Workup' },
            { field: 'plan_of_care', label: 'Plan of Care' },
            { field: 'patient_education', label: 'Patient Education' },
            { field: 'follow_up_instructions', label: 'Follow-Up Instructions' }
        ]
    }
};

// Default template configuration
let smartLearnConfig = {
    templates: {
        default: {
            name: 'Default Allergy Clinic',
            subjective: {
                chief_complaint: 'concise',
                history_of_present_illness: 'detailed',
                past_medical_history: 'relevant',
                allergies: 'detailed',
                social_history: 'relevant',
                review_of_systems: 'concise'
            },
            objective: {
                physical_examination: 'detailed'
            },
            assessment: {
                differential_diagnosis: 'detailed'
            },
            plan: {
                diagnostic_workup: 'detailed',
                plan_of_care: 'detailed',
                patient_education: 'concise',
                follow_up_instructions: 'detailed'
            }
        }
    },
    currentTemplate: 'default'
};

// Load saved configuration from localStorage
function loadSmartLearnConfig() {
    try {
        const saved = localStorage.getItem('smartLearnConfig');
        if (saved) {
            smartLearnConfig = JSON.parse(saved);
            console.log('Loaded SmartLearn config from localStorage:', smartLearnConfig);
        }
    } catch (error) {
        console.error('Error loading SmartLearn config:', error);
    }
}

// Save configuration to localStorage
function saveSmartLearnConfig() {
    try {
        localStorage.setItem('smartLearnConfig', JSON.stringify(smartLearnConfig));
        console.log('Saved SmartLearn config to localStorage:', smartLearnConfig);
    } catch (error) {
        console.error('Error saving SmartLearn config:', error);
    }
}

// Open SmartLearn modal
function openSmartLearnModal() {
    console.log('Opening SmartLearn modal');
    const modal = document.getElementById('smart-learning-modal');
    if (!modal) {
        console.error('Smart learning modal element not found');
        return;
    }

    modal.innerHTML = `
        <div class="smart-learn-content">
            <div class="modal-header">
                <h2>Customize SOAP Notes Template</h2>
                <button class="close-btn" onclick="closeSmartLearnModal()">&times;</button>
            </div>
            
            <div class="template-selector">
                <label for="template-select">Select Template:</label>
                <select id="template-select" onchange="switchTemplate()">
                    ${Object.keys(smartLearnConfig.templates).map(key => `
                        <option value="${key}" ${key === smartLearnConfig.currentTemplate ? 'selected' : ''}>
                            ${smartLearnConfig.templates[key].name}
                        </option>
                    `).join('')}
                </select>
                <button onclick="createNewTemplate()" class="btn-new-template">Create New Template</button>
            </div>
            
            <div class="customization-grid">
                ${generateCustomizationOptions()}
            </div>
            
            <div class="modal-footer">
                <button onclick="saveSmartLearnTemplate()" class="btn-save">Save Template</button>
                <button onclick="resetToDefault()" class="btn-reset">Reset to Default</button>
                <button onclick="closeSmartLearnModal()" class="btn-cancel">Cancel</button>
            </div>
        </div>
    `;
    
    modal.style.display = 'block';
}

// Generate customization options for all SOAP sections
function generateCustomizationOptions() {
    const currentTemplate = smartLearnConfig.templates[smartLearnConfig.currentTemplate];
    let html = '';
    
    Object.entries(SOAP_SECTIONS).forEach(([sectionKey, section]) => {
        html += `
            <div class="soap-section-config">
                <h3>${section.name}</h3>
                ${section.fields.map(fieldConfig => `
                    <div class="field-config">
                        <label>${fieldConfig.label}:</label>
                        <select onchange="updateFieldConfig('${sectionKey}', '${fieldConfig.field}', this.value)">
                            <option value="concise" ${currentTemplate[sectionKey][fieldConfig.field] === 'concise' ? 'selected' : ''}>Concise</option>
                            <option value="detailed" ${currentTemplate[sectionKey][fieldConfig.field] === 'detailed' ? 'selected' : ''}>Detailed</option>
                            <option value="relevant" ${currentTemplate[sectionKey][fieldConfig.field] === 'relevant' ? 'selected' : ''}>Only Relevant</option>
                            <option value="skip" ${currentTemplate[sectionKey][fieldConfig.field] === 'skip' ? 'selected' : ''}>Skip</option>
                        </select>
                    </div>
                `).join('')}
            </div>
        `;
    });
    
    return html;
}

// Update field configuration
function updateFieldConfig(section, field, value) {
    console.log(`Updating field config: ${section}.${field} = ${value}`);
    const currentTemplate = smartLearnConfig.templates[smartLearnConfig.currentTemplate];
    currentTemplate[section][field] = value;
}

// Create a new template
function createNewTemplate() {
    const templateName = prompt('Enter template name:');
    if (!templateName) return;
    
    const templateKey = templateName.toLowerCase().replace(/\s+/g, '_');
    const defaultTemplate = smartLearnConfig.templates.default;
    
    // Create a copy of the default template
    const newTemplate = {
        name: templateName,
        subjective: { ...defaultTemplate.subjective },
        objective: { ...defaultTemplate.objective },
        assessment: { ...defaultTemplate.assessment },
        plan: { ...defaultTemplate.plan }
    };
    
    smartLearnConfig.templates[templateKey] = newTemplate;
    smartLearnConfig.currentTemplate = templateKey;
    
    // Refresh the modal content
    openSmartLearnModal();
}

// Switch to different template
function switchTemplate() {
    const select = document.getElementById('template-select');
    if (!select) {
        console.error('Template select element not found');
        return;
    }
    
    smartLearnConfig.currentTemplate = select.value;
    console.log(`Switched to template: ${smartLearnConfig.currentTemplate}`);
    
    // Refresh the customization options
    const grid = document.querySelector('.customization-grid');
    if (grid) {
        grid.innerHTML = generateCustomizationOptions();
    } else {
        console.error('Customization grid element not found');
    }
}

// Save the current template
function saveSmartLearnTemplate() {
    saveSmartLearnConfig();
    alert('Template saved successfully!');
    closeSmartLearnModal();
    
    // Apply the template to the current view if a transcript has been analyzed
    if (window.latestAnalysis?.soapNotes) {
        updateSOAPNotesWithSmartLearn();
    }
}

// Reset to default template
function resetToDefault() {
    if (confirm('Are you sure you want to reset to default settings?')) {
        smartLearnConfig.currentTemplate = 'default';
        openSmartLearnModal();
    }
}

// Close SmartLearn modal
function closeSmartLearnModal() {
    console.log('Closing SmartLearn modal');
    const modal = document.getElementById('smart-learning-modal');
    if (modal) {
        modal.style.display = 'none';
    } else {
        console.error('Smart learning modal element not found');
    }
}

// Format content based on configuration
function formatContent(content, config) {
    if (!content) return '';
    
    switch (config) {
        case 'concise':
            // Take only the first sentence or up to 100 characters
            const firstSentence = content.match(/[^.!?]+[.!?]+/) || [''];
            return firstSentence[0] || content.substring(0, 100) + '...';
        case 'relevant':
            // Extract only the most relevant information
            const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
            return sentences.slice(0, Math.ceil(sentences.length / 2)).join('. ') + '.';
        case 'skip':
            return '';
        case 'detailed':
        default:
            return content;
    }
}

// Apply SmartLearn configuration to SOAP notes
function applySmartLearnConfig(soapNotes) {
    if (!soapNotes) {
        console.error('Cannot apply SmartLearn config: soapNotes is null or undefined');
        return soapNotes;
    }
    
    console.log('Applying SmartLearn config to SOAP notes');
    const currentTemplate = smartLearnConfig.templates[smartLearnConfig.currentTemplate];
    const enhancedSoapNotes = JSON.parse(JSON.stringify(soapNotes));
    
    // Apply template configuration to each section
    Object.entries(SOAP_SECTIONS).forEach(([sectionKey, section]) => {
        section.fields.forEach(fieldConfig => {
            const field = fieldConfig.field;
            const config = currentTemplate[sectionKey][field];
            let content;
            
            // Handle nested patient_history structure
            if (sectionKey === 'subjective' && soapNotes.patient_history) {
                content = soapNotes.patient_history[field];
            } else {
                content = soapNotes[field];
            }
            
            if (content) {
                const formattedContent = formatContent(content, config);
                
                // Apply the formatted content back to the right location
                if (sectionKey === 'subjective' && enhancedSoapNotes.patient_history) {
                    enhancedSoapNotes.patient_history[field] = formattedContent;
                } else {
                    enhancedSoapNotes[field] = formattedContent;
                }
            }
        });
    });
    
    return enhancedSoapNotes;
}

// Update the display of SOAP notes based on the SmartLearn configuration
function updateSOAPNotesWithSmartLearn() {
    if (!window.latestAnalysis?.soapNotes) {
        console.error('Cannot update SOAP notes with SmartLearn: latestAnalysis or soapNotes is undefined');
        return;
    }
    
    console.log('Updating SOAP notes with SmartLearn configurations');
    
    // Apply SmartLearn configuration to the SOAP notes
    const enhancedSoapNotes = applySmartLearnConfig(window.latestAnalysis.soapNotes);
    
    // Store the enhanced notes back in latestAnalysis
    window.latestAnalysis.soapNotes = enhancedSoapNotes;
    
    // Update the SOAP sections with the enhanced content
    updateSubjectiveContent(enhancedSoapNotes.patient_history);
    updateObjectiveContent(enhancedSoapNotes.physical_examination);
    updateAssessmentContent(enhancedSoapNotes.differential_diagnosis);
    updatePlanContent(enhancedSoapNotes);
}

// Update subjective content based on the template
function updateSubjectiveContent(patientHistory) {
    const subjectiveContent = document.getElementById('subjective-content');
    if (!subjectiveContent || !patientHistory) {
        console.error('Cannot update subjective content: subjectiveContent or patientHistory is undefined');
        return;
    }
    
    const template = smartLearnConfig.templates[smartLearnConfig.currentTemplate];
    let html = '';
    
    // Build HTML based on template configuration
    SOAP_SECTIONS.subjective.fields.forEach(fieldConfig => {
        const field = fieldConfig.field;
        const content = patientHistory[field];
        const config = template.subjective[field];
        
        if (content && config !== 'skip') {
            html += `<p><strong>${fieldConfig.label}:</strong></p><p>${content}</p>`;
        }
    });
    
    if (html === '') {
        html = '<p>No subjective information available.</p>';
    }
    
    subjectiveContent.innerHTML = html;
}

// Update objective content
function updateObjectiveContent(physicalExamination) {
    const objectiveContent = document.getElementById('objective-content');
    if (!objectiveContent) {
        console.error('Cannot update objective content: objectiveContent is undefined');
        return;
    }
    
    const template = smartLearnConfig.templates[smartLearnConfig.currentTemplate];
    if (physicalExamination && template.objective.physical_examination !== 'skip') {
        objectiveContent.innerHTML = `<p><strong>Physical Examination:</strong></p><p>${physicalExamination}</p>`;
    } else {
        objectiveContent.innerHTML = '<p>No objective information available.</p>';
    }
}

// Update assessment content
function updateAssessmentContent(differentialDiagnosis) {
    const assessmentContent = document.getElementById('assessment-content');
    if (!assessmentContent) {
        console.error('Cannot update assessment content: assessmentContent is undefined');
        return;
    }
    
    const template = smartLearnConfig.templates[smartLearnConfig.currentTemplate];
    if (differentialDiagnosis && template.assessment.differential_diagnosis !== 'skip') {
        const assessmentLines = differentialDiagnosis.split('\n')
            .map(line => `<p>${line.replace(/\*/g, '•')}</p>`).join('');
        assessmentContent.innerHTML = assessmentLines;
    } else {
        assessmentContent.innerHTML = '<p>No assessment information available.</p>';
    }
}

// Update plan content based on template
function updatePlanContent(soapNotes) {
    const planContainer = document.getElementById('plan-content-container');
    if (!planContainer) {
        console.error('Cannot update plan content: planContainer is undefined');
        return;
    }
    
    // Clear the existing plan content
    planContainer.innerHTML = '';
    
    const template = smartLearnConfig.templates[smartLearnConfig.currentTemplate];
    
    // Process plan_of_care field if available and not skipped
    if (soapNotes.plan_of_care && template.plan.plan_of_care !== 'skip') {
        const planText = soapNotes.plan_of_care;
        const sections = planText.split(/(?=In regards to\s+[\w\s]+:)/i).filter(section => section.trim());
        
        if (sections.length > 0) {
            sections.forEach(section => {
                const sectionMatch = section.match(/In regards to\s+(.+?)(?::|$)/i);
                if (sectionMatch) {
                    const title = sectionMatch[1].trim();
                    const items = section.replace(/In regards to\s+.+?(?::|$)/i, '').trim()
                        .split('\n')
                        .filter(item => item.trim())
                        .map(item => item.replace(/^- /, ''));
                    
                    if (items.length > 0) {
                        const sectionDiv = document.createElement('div');
                        sectionDiv.className = 'plan-section';
                        const safeTitle = title.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
                        sectionDiv.innerHTML = `
                            <h3>In regards to ${title}:</h3>
                            <ul id="plan-content-${safeTitle}" data-original-items='${JSON.stringify(items)}'>
                                ${items.map(item => `<li>${item.trim()}</li>`).join('')}
                            </ul>
                        `;
                        planContainer.appendChild(sectionDiv);
                    }
                }
            });
        } else {
            // Handle case where plan_of_care doesn't have sections
            const items = planText.split(/[\n•-]/).filter(item => item.trim()).map(item => item.trim());
            if (items.length > 0) {
                const sectionDiv = document.createElement('div');
                sectionDiv.className = 'plan-section';
                sectionDiv.innerHTML = `
                    <h3>In regards to General Plan:</h3>
                    <ul id="plan-content-general-plan" data-original-items='${JSON.stringify(items)}'>
                        ${items.map(item => `<li>${item.trim()}</li>`).join('')}
                    </ul>
                `;
                planContainer.appendChild(sectionDiv);
            }
        }
    }
    
    // Add other plan fields if they exist and aren't set to skip
    let additionalPlanHtml = '';
    
    SOAP_SECTIONS.plan.fields.forEach(fieldConfig => {
        const field = fieldConfig.field;
        if (field !== 'plan_of_care') { // Skip plan_of_care since we already processed it
            const content = soapNotes[field];
            const config = template.plan[field];
            
            if (content && config !== 'skip') {
                additionalPlanHtml += `<p><strong>${fieldConfig.label}:</strong></p><p>${content}</p>`;
            }
        }
    });
    
    if (additionalPlanHtml) {
        const additionalDiv = document.createElement('div');
        additionalDiv.className = 'plan-section';
        additionalDiv.innerHTML = additionalPlanHtml;
        planContainer.appendChild(additionalDiv);
    }
    
    // If no plan content was added, show a default message
    if (planContainer.children.length === 0) {
        const defaultDiv = document.createElement('div');
        defaultDiv.className = 'plan-section';
        defaultDiv.innerHTML = `
            <h3>In regards to General Plan:</h3>
            <ul id="plan-content-general-plan">
                <li>No specific plan recommendations available.</li>
            </ul>
        `;
        planContainer.appendChild(defaultDiv);
    }
    
    planContainer.style.display = 'block';
}

// Initialize SmartLearn functionality
function initializeSmartLearn() {
    console.log('Initializing SmartLearn functionality');
    loadSmartLearnConfig();
    
    // Add click event to SmartLearn button
    document.addEventListener('DOMContentLoaded', function() {
        console.log('DOM loaded, binding SmartLearn button event');
        const smartLearnBtn = document.getElementById('smart-learn-btn');
        if (smartLearnBtn) {
            console.log('SmartLearn button found, adding event listener');
            smartLearnBtn.addEventListener('click', function(e) {
                console.log('SmartLearn button clicked via event listener');
                openSmartLearnModal();
            });
            
            // Also add direct onclick handler as a fallback
            smartLearnBtn.onclick = function(e) {
                console.log('SmartLearn button clicked via onclick');
                openSmartLearnModal();
            };
        } else {
            console.error('SmartLearn button not found');
        }
    });
    
    // Intercept the submitTranscript function to apply SmartLearn
    if (typeof window.submitTranscript === 'function') {
        const originalSubmitTranscript = window.submitTranscript;
        window.submitTranscript = async function() {
            // Call the original function first
            console.log('Intercepted submitTranscript call');
            await originalSubmitTranscript.apply(this, arguments);
            
            // Apply SmartLearn configuration after SOAP notes are generated
            setTimeout(() => {
                if (window.latestAnalysis?.soapNotes) {
                    console.log('Applying SmartLearn to transcript result');
                    updateSOAPNotesWithSmartLearn();
                } else {
                    console.warn('No latestAnalysis.soapNotes available after submitTranscript');
                }
            }, 500); // Small delay to ensure latestAnalysis is populated
        };
        console.log('Successfully intercepted submitTranscript function');
    } else {
        console.error('submitTranscript function not found, could not intercept');
        // Retry after a delay in case script-transcript.js loads later
        setTimeout(() => {
            if (typeof window.submitTranscript === 'function') {
                const originalSubmitTranscript = window.submitTranscript;
                window.submitTranscript = async function() {
                    console.log('Intercepted submitTranscript call (delayed)');
                    await originalSubmitTranscript.apply(this, arguments);
                    
                    setTimeout(() => {
                        if (window.latestAnalysis?.soapNotes) {
                            console.log('Applying SmartLearn to transcript result (delayed)');
                            updateSOAPNotesWithSmartLearn();
                        } else {
                            console.warn('No latestAnalysis.soapNotes available after submitTranscript (delayed)');
                        }
                    }, 500);
                };
                console.log('Successfully intercepted submitTranscript function (delayed)');
            } else {
                console.error('submitTranscript function still not found after delay');
            }
        }, 1000);
    }
}

// Setup global access to SmartLearn functions
window.openSmartLearnModal = openSmartLearnModal;
window.closeSmartLearnModal = closeSmartLearnModal;
window.switchTemplate = switchTemplate;
window.createNewTemplate = createNewTemplate;
window.updateFieldConfig = updateFieldConfig;
window.saveSmartLearnTemplate = saveSmartLearnTemplate;
window.resetToDefault = resetToDefault;
window.applySmartLearnConfig = applySmartLearnConfig;
window.updateSOAPNotesWithSmartLearn = updateSOAPNotesWithSmartLearn;

// Initialize SmartLearn when loaded
console.log('SmartLearning.js initialization starting');
initializeSmartLearn();
console.log('SmartLearning.js initialization complete');
