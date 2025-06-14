(function () {
    console.log('🧬 AllergenIQ Profile module initializing...');

    let lastPatientId = null;
    let lastVisitId = null;
    let currentPatientId = null;
    let currentVisitId = null;
    let currentProfileData = null;

    // Debugging helpers
    function debugLog(message, data) {
        console.log(`[AllergenIQ] ${message}`, data || '');
    }

    function errorLog(message, error) {
        console.error(`[AllergenIQ ERROR] ${message}`, error);
    }

    // API Communication
    async function fetchAllergeniqProfile(patientId, visitId) {
        const email = localStorage.getItem('currentEmail');
        const tenantID = localStorage.getItem('tenantID');
        
        if (!email || !tenantID) {
            throw new Error('Missing authentication credentials');
        }

        const url = `https://medoramd.ai/api/allergeniq-profile?patient_id=${patientId}&visit_id=${visitId}&email=${email}&tenantID=${tenantID}`;
        debugLog('Fetching profile data', { url, patientId, visitId });

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || 'API returned error');
            }

            debugLog('✅ Profile data fetched successfully', {
                patient: data.patient_name,
                hasProfile: !!data.profile,
                itemCount: data.debug_info?.total_extracted_items || 0
            });

            return data;
        } catch (error) {
            errorLog('Failed to fetch profile data', error);
            throw error;
        }
    }

    // Collapsed Card Management
    function updateCollapsedCard(profileData) {
        debugLog('Updating collapsed card', profileData);

        // Update counts
        const allergenCount = document.getElementById('allergen-count');
        const symptomCount = document.getElementById('symptom-count');
        const medicationCount = document.getElementById('medication-count');
        const alertsContainer = document.getElementById('allergeniq-alerts');

        if (!profileData || !profileData.profile) {
            // Show loading or error state
            if (allergenCount) allergenCount.textContent = '-';
            if (symptomCount) symptomCount.textContent = '-';
            if (medicationCount) medicationCount.textContent = '-';
            if (alertsContainer) {
                alertsContainer.innerHTML = '<span class="alert-text">No data available</span>';
            }
            return;
        }

        const profile = profileData.profile;
        
        // Update counts
        const allergens = profile.allergenData?.length || 0;
        const symptoms = profile.symptomData?.length || 0;
        const medications = profile.medicationHistory?.length || 0;

        if (allergenCount) allergenCount.textContent = allergens;
        if (symptomCount) symptomCount.textContent = symptoms;
        if (medicationCount) medicationCount.textContent = medications;

        // Update alerts
        if (alertsContainer) {
            const alerts = generateAlerts(profile);
            alertsContainer.innerHTML = alerts;
        }
    }

    function generateAlerts(profile) {
        const alerts = [];
        let severityDots = '';

        // Check for high severity symptoms
        if (profile.symptomData?.length > 0) {
            const highSeverityCount = profile.symptomData.filter(s => parseInt(s.severity) >= 7).length;
            const mediumSeverityCount = profile.symptomData.filter(s => parseInt(s.severity) >= 4 && parseInt(s.severity) < 7).length;
            const lowSeverityCount = profile.symptomData.filter(s => parseInt(s.severity) < 4).length;

            // Add severity dots
            for (let i = 0; i < highSeverityCount; i++) {
                severityDots += '<div class="severity-dot severity-high"></div>';
            }
            for (let i = 0; i < mediumSeverityCount; i++) {
                severityDots += '<div class="severity-dot severity-medium"></div>';
            }
            for (let i = 0; i < lowSeverityCount; i++) {
                severityDots += '<div class="severity-dot severity-low"></div>';
            }

            if (highSeverityCount > 0) {
                alerts.push(`High severity: ${highSeverityCount} symptoms`);
            }
        }

        // Check for allergen risks
        if (profile.allergenData?.length > 0) {
            const systemicRisk = profile.allergenData.some(a => 
                a.reaction?.toLowerCase().includes('systemic') || 
                a.reaction?.toLowerCase().includes('anaphylaxis')
            );
            
            if (systemicRisk) {
                alerts.push('Anaphylaxis risk');
            }
        }

        // Check diagnosis for high-risk conditions
        const diagnosis = profile.summary?.primaryDiagnosis?.toLowerCase() || '';
        if (diagnosis.includes('anaphylaxis')) {
            alerts.push('Anaphylaxis history');
        }

        const alertText = alerts.length > 0 ? alerts.join(' • ') : 'Profile available';

        return `
            ${severityDots}
            <span class="alert-text ${alerts.length > 0 ? 'has-alerts' : ''}">${alertText}</span>
        `;
    }

    // Modal Management
    function updateModalContent(profileData) {
        debugLog('🔄 Updating modal content', profileData);

        if (!profileData || !profileData.profile) {
            showModalError('No profile data available');
            return;
        }

        const profile = profileData.profile;

        // Update diagnosis section
        updateDiagnosisSection(profile.summary);

        // Update allergens section
        updateAllergensSection(profile.allergenData);

        // Update symptoms section
        updateSymptomsSection(profile.symptomData);

        // Update medications section
        updateMedicationsSection(profile.medicationHistory);

        debugLog('✅ Modal content updated successfully');
    }

    function updateDiagnosisSection(summary) {
        const container = document.getElementById('modal-diagnosis-content');
        if (!container) return;

        if (!summary) {
            container.innerHTML = '<div class="loading-message">No diagnosis information available</div>';
            return;
        }

        // Use REAL data from the API instead of hardcoded
        const primaryDiagnosis = summary.primaryDiagnosis || 'No primary diagnosis available';
        const secondaryDiagnosis = summary.secondaryDiagnosis || summary.alternativeDiagnoses?.[0] || 'No secondary diagnosis';
        const crossReactivity = summary.crossReactivity || (summary.alternativeDiagnoses?.length > 1 ? summary.alternativeDiagnoses.slice(1).join(', ') : 'None identified');

        const html = `
            <div class="diagnosis-card">
                <div class="diagnosis-primary-title">${primaryDiagnosis}</div>
                ${secondaryDiagnosis !== 'No secondary diagnosis' ? `
                    <div class="diagnosis-secondary-info">
                        <strong>Secondary:</strong> ${secondaryDiagnosis}
                    </div>
                ` : ''}
            </div>
            ${crossReactivity !== 'None identified' ? `
                <div class="cross-reactivity-section">
                    <div class="cross-reactivity-label">Cross-reactivity identified:</div>
                    <div class="cross-reactivity-value">${crossReactivity}</div>
                </div>
            ` : ''}
        `;

        container.innerHTML = html;
    }

    function updateAllergensSection(allergens) {
        const container = document.getElementById('modal-allergens-content');
        if (!container) return;

        if (!allergens || allergens.length === 0) {
            container.innerHTML = '<div class="loading-message">No allergen data available</div>';
            return;
        }

        // Use REAL allergen data from API
        const hasSystemicRisk = allergens.some(a => 
            a.reaction?.toLowerCase().includes('systemic') || 
            a.reaction?.toLowerCase().includes('anaphylaxis')
        );

        // Determine allergen category based on actual data
        const foodAllergens = allergens.filter(a => 
            a.category?.toLowerCase().includes('food') || 
            a.type?.toLowerCase().includes('food') ||
            ['peanut', 'tree nut', 'cashew', 'walnut', 'almond', 'milk', 'egg', 'soy', 'wheat', 'fish', 'shellfish'].some(food => 
                a.name?.toLowerCase().includes(food)
            )
        );

        const categoryName = foodAllergens.length > 0 ? 'Food Allergens' : 'Allergens';

        let html = `<div class="allergen-category-tag">${categoryName}</div>`;

        // Show individual allergens
        allergens.forEach(allergen => {
            html += `
                <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 6px; padding: 8px 12px; margin-bottom: 8px;">
                    <strong>${allergen.name}</strong><br>
                    <small style="color: #856404;">${allergen.reaction || allergen.description || 'Reaction details not specified'}</small>
                </div>
            `;
        });

        // Show risk warning if applicable
        if (hasSystemicRisk) {
            html += `
                <div class="systemic-risk-box">
                    <div class="systemic-risk-title">⚠️ SYSTEMIC REACTION RISK</div>
                    <div class="systemic-risk-description">
                        Potential for severe systemic reactions. Requires immediate medical attention if exposed.
                    </div>
                </div>
            `;
        }

        container.innerHTML = html;
    }

    // FIXED: Use REAL symptom data instead of hardcoded
    function updateSymptomsSection(symptoms) {
        const container = document.getElementById('modal-symptoms-content');
        if (!container) return;

        if (!symptoms || symptoms.length === 0) {
            container.innerHTML = '<div class="loading-message">No symptom data available</div>';
            return;
        }

        // Use REAL symptom data from the API
        const html = `
            <div class="symptoms-grid-full">
                ${symptoms.map(symptom => {
                    const severity = parseInt(symptom.severity) || 0;
                    const severityColor = getSeverityColor(severity);
                    const frequency = symptom.frequency || 'Unknown';
                    const frequencyIcon = getFrequencyIcon(frequency);
                    
                    return `
                        <div class="symptom-card-full">
                            <div class="symptom-name-full">${symptom.name || symptom.symptom || 'Unknown symptom'}</div>
                            <div class="symptom-severity-circle-full" style="background-color: ${severityColor};">
                                ${severity}/10
                            </div>
                            <div class="symptom-frequency-full">
                                ${frequencyIcon} ${frequency}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
            <div class="severity-legend-full">
                <div class="legend-item-full">
                    <div class="legend-dot-full mild"></div>
                    <span>MILD (1-3)</span>
                </div>
                <div class="legend-item-full">
                    <div class="legend-dot-full moderate"></div>
                    <span>MODERATE (4-6)</span>
                </div>
                <div class="legend-item-full">
                    <div class="legend-dot-full severe"></div>
                    <span>SEVERE (7-10)</span>
                </div>
            </div>
        `;

        container.innerHTML = html;
    }

    // FIXED: Use REAL medication data instead of hardcoded
    function updateMedicationsSection(medications) {
        const container = document.getElementById('modal-medications-content');
        if (!container) return;

        if (!medications || medications.length === 0) {
            container.innerHTML = '<div class="loading-message">No medication data available</div>';
            return;
        }

        // Use REAL medication data from the API
        const html = medications.map(medication => {
            const name = medication.name || medication.medication || 'Unknown medication';
            const dosage = medication.dosage || medication.dose || 'Dosage not specified';
            const status = medication.status || medication.frequency || 'As needed';
            
            // Get first letter for the medication initial
            const initial = name.charAt(0).toUpperCase();
            
            return `
                <div class="medication-card-full">
                    <div class="medication-initial-full">${initial}</div>
                    <div class="medication-details-full">
                        <div class="medication-name-full">${name}</div>
                        <div class="medication-dosage-full">${dosage}</div>
                    </div>
                    <div class="medication-status-full">${status}</div>
                </div>
            `;
        }).join('');

        container.innerHTML = html;
    }

    function showModalError(message) {
        const sections = [
            'modal-diagnosis-content',
            'modal-allergens-content', 
            'modal-symptoms-content',
            'modal-medications-content'
        ];

        sections.forEach(id => {
            const container = document.getElementById(id);
            if (container) {
                container.innerHTML = `<div class="loading-message">${message}</div>`;
            }
        });
    }

    // Utility Functions
    function getSeverityColor(severity) {
        const sev = parseInt(severity) || 0;
        if (sev >= 8) return '#dc2626'; // Red - Severe
        if (sev >= 6) return '#ea580c'; // Orange - Moderate-Severe  
        if (sev >= 4) return '#eab308'; // Yellow - Moderate
        if (sev >= 2) return '#65a30d'; // Green - Mild
        return '#10b981'; // Light Green - Very Mild
    }

    function getFrequencyIcon(frequency) {
        const freq = (frequency || '').toLowerCase();
        switch(freq) {
            case 'daily':
            case 'every day': 
                return '🔥';
            case 'frequent':
            case 'often':
                return '⚡';
            case 'occasional':
            case 'sometimes':
            case 'weekly':
                return '⚪';
            case 'controlled':
            case 'stable':
                return '✅';
            case 'rare':
            case 'seldom':
            case 'monthly':
                return '💤';
            case 'unknown':
            case '':
                return '❓';
            default: 
                return '⚪'; // Default to occasional
        }
    }

    // Toast Notifications
    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast allergeniq-toast ${type}`;
        toast.textContent = message;

        // Add to container
        let container = document.getElementById('allergeniq-toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'allergeniq-toast-container';
            container.style.cssText = 'position: fixed; bottom: 20px; right: 20px; z-index: 9999;';
            document.body.appendChild(container);
        }
        
        container.appendChild(toast);

        // Show toast
        setTimeout(() => toast.classList.add('show'), 100);

        // Remove toast
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // Action Functions (called from HTML)
    window.downloadAllergenIQPDF = function() {
        debugLog('Download PDF requested');
        
        if (!currentProfileData) {
            showToast('No profile data available to download', 'error');
            return;
        }

        // Create text content for download
        let content = 'AllergenIQ Profile Report\n';
        content += '========================\n\n';

        const profile = currentProfileData.profile;
        
        if (profile.summary) {
            content += 'DIAGNOSIS:\n';
            content += `Primary: ${profile.summary.primaryDiagnosis}\n`;
            if (profile.summary.alternativeDiagnoses?.length > 0) {
                content += `Alternative: ${profile.summary.alternativeDiagnoses.join(', ')}\n`;
            }
            content += '\n';
        }

        if (profile.allergenData?.length > 0) {
            content += 'ALLERGENS:\n';
            profile.allergenData.forEach(allergen => {
                content += `- ${allergen.name}: ${allergen.reaction}\n`;
            });
            content += '\n';
        }

        if (profile.symptomData?.length > 0) {
            content += 'SYMPTOMS:\n';
            profile.symptomData.forEach(symptom => {
                content += `- ${symptom.name}: Severity ${symptom.severity}/10, ${symptom.frequency}\n`;
            });
            content += '\n';
        }

        if (profile.medicationHistory?.length > 0) {
            content += 'MEDICATIONS:\n';
            profile.medicationHistory.forEach(med => {
                content += `- ${med.name} (${med.dosage}) - ${med.status}\n`;
            });
        }

        // Create and download file
        const blob = new Blob([content], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `AllergenIQ_Profile_${currentPatientId || 'Patient'}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        showToast('AllergenIQ Profile downloaded successfully!');
    };

    window.copyAllergenIQReport = function() {
        debugLog('Copy report requested');
        
        if (!currentProfileData) {
            showToast('No profile data available to copy', 'error');
            return;
        }

        const profile = currentProfileData.profile;
        let text = 'AllergenIQ Profile Summary\n\n';

        if (profile.summary) {
            text += `Diagnosis: ${profile.summary.primaryDiagnosis}\n`;
        }

        if (profile.allergenData?.length > 0) {
            text += `Allergens: ${profile.allergenData.length} identified\n`;
        }

        if (profile.symptomData?.length > 0) {
            text += `Symptoms: ${profile.symptomData.length} tracked\n`;
            const highSeverity = profile.symptomData.filter(s => parseInt(s.severity) >= 7).length;
            if (highSeverity > 0) {
                text += `High severity symptoms: ${highSeverity}\n`;
            }
        }

        if (profile.medicationHistory?.length > 0) {
            text += `Medications: ${profile.medicationHistory.length} listed\n`;
        }

        navigator.clipboard.writeText(text).then(() => {
            showToast('AllergenIQ Profile copied to clipboard!');
        }).catch(err => {
            errorLog('Failed to copy to clipboard', err);
            showToast('Failed to copy profile. Please try again.', 'error');
        });
    };

    window.sendToPatient = function() {
        debugLog('Send to patient requested');
        showToast('Send to patient feature coming soon!', 'info');
    };

    // Main Update Function
    async function updateProfileWithVisitId(patientId, visitId, forceModalUpdate = false) {
        debugLog('🔄 Update requested', { patientId, visitId, forceModalUpdate });

        if (!patientId || !visitId) {
            errorLog('Missing patientId or visitId');
            return;
        }

        // Skip if same data and not forcing modal update
        if (!forceModalUpdate && lastPatientId === patientId && lastVisitId === visitId) {
            debugLog('Same patient/visit, skipping update');
            // But if we have cached data and this is a modal request, update the modal
            if (forceModalUpdate && currentProfileData) {
                debugLog('🔄 Using cached data for modal update');
                updateModalContent(currentProfileData);
            }
            return;
        }

        // Update tracking variables
        lastPatientId = patientId;
        lastVisitId = visitId;
        currentPatientId = patientId;
        currentVisitId = visitId;

        try {
            // Show loading states
            updateCollapsedCard(null);
            if (forceModalUpdate) {
                showModalError('Loading detailed analysis...');
            }

            // Fetch fresh data
            const data = await fetchAllergeniqProfile(patientId, visitId);
            currentProfileData = data;

            // Update both views
            updateCollapsedCard(data);
            
            if (forceModalUpdate) {
                debugLog('🔄 Updating modal with fresh data');
                updateModalContent(data);
            }

            debugLog('✅ Profile updated successfully');

        } catch (error) {
            errorLog('Failed to update profile', error);
            
            // Show error states
            const errorMessage = error.message.includes('HTTP 404') 
                ? 'No profile data found for this visit'
                : 'Failed to load profile data';
                
            updateCollapsedCard(null);
            if (forceModalUpdate) {
                showModalError(errorMessage);
            }
        }
    }

    // Enhanced modal open function
    window.openAllergenIQModal = function() {
        debugLog('🔄 Opening AllergenIQ modal');
        
        // Show the modal
        const modalOverlay = document.getElementById('allergeniq-modal-overlay');
        if (modalOverlay) {
            modalOverlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
        
        // Trigger detailed data load if we have current patient/visit
        if (window.currentPatientId && window.currentVisitId) {
            debugLog('🔄 Loading data for modal', { 
                patientId: window.currentPatientId, 
                visitId: window.currentVisitId 
            });
            updateProfileWithVisitId(window.currentPatientId, window.currentVisitId, true);
        } else if (currentProfileData) {
            // Use cached data if available
            debugLog('🔄 Using cached data for modal');
            updateModalContent(currentProfileData);
        } else {
            debugLog('⚠️ No patient/visit data available for modal');
            showModalError('Please select a patient first');
        }
    };

    // Auto-update when patient/visit changes
    function setupAutoUpdate() {
        // Listen for patient/visit changes from other modules
        const originalUpdateFunction = window.updateProfileWithVisitId;
        
        window.updateProfileWithVisitId = function(patientId, visitId, forceModal) {
            debugLog('🔄 Global update triggered', { patientId, visitId, forceModal });
            updateProfileWithVisitId(patientId, visitId, forceModal);
            
            // Call original function if it exists
            if (originalUpdateFunction && typeof originalUpdateFunction === 'function') {
                originalUpdateFunction(patientId, visitId, forceModal);
            }
        };
    }

    // Initialize when DOM is ready
    function initialize() {
        debugLog('🚀 Initializing AllergenIQ Profile module');
        
        // Setup auto-update system
        setupAutoUpdate();

        // Expose global update function
        window.updateAllergenIQProfile = updateProfileWithVisitId;

        // Override the openAllergenIQ function with our enhanced version
        window.openAllergenIQ = window.openAllergenIQModal;

        debugLog('✅ AllergenIQ Profile module ready');
    }

    // Initialize on DOM load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

    console.log('🧬 AllergenIQ Profile module loaded successfully');
})();
