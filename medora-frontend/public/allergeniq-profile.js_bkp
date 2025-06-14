(function () {
    function debugLog(message, data) {
        console.log(`[DEBUG] ${message}`, data || '');
    }

    function errorLog(message, error) {
        console.error(`[ERROR] ${message}`, error);
    }

    let lastPatientId = null;
    let lastVisitId = null;
    let currentPatientId = null;
    let currentVisitId = null;

    // Heat Map Helper Functions
    function getHeatMapColor(severity) {
        if (severity >= 8) return '#dc2626'; // Red - Severe
        if (severity >= 6) return '#ea580c'; // Orange - Moderate-Severe  
        if (severity >= 4) return '#eab308'; // Yellow - Moderate
        if (severity >= 2) return '#65a30d'; // Green - Mild
        return '#10b981'; // Light Green - Very Mild/Controlled
    }

    function getOpacity(frequency) {
        switch(frequency?.toLowerCase()) {
            case 'daily': return 1.0;
            case 'frequent': return 0.9;
            case 'occasional': return 0.7;
            case 'controlled': return 0.5;
            case 'rare': return 0.3;
            case 'not specified': return 0.6;
            case 'unknown': return 0.6;
            default: return 0.8;
        }
    }

    function getFrequencyIcon(frequency) {
        switch(frequency?.toLowerCase()) {
            case 'daily': return '🔥';
            case 'frequent': return '⚡';
            case 'occasional': return '⚪';
            case 'controlled': return '✅';
            case 'rare': return '💤';
            case 'worse with triggers': return '⚠️';
            case 'not specified': return '❓';
            case 'unknown': return '❓';
            default: return '❓';
        }
    }

    function generateSymptomHeatMap(symptoms) {
        if (!symptoms || symptoms.length === 0) {
            return `
                <div class="symptom-heat-map" style="margin-bottom: 20px;">
                    <div style="display: flex; align-items: center; margin-bottom: 15px; gap: 10px;">
                        <h4 style="margin: 0; color: #374151;">🎯 Symptom Heat Map</h4>
                        <span style="font-size: 12px; color: #6b7280;">
                            Interactive severity visualization
                        </span>
                    </div>
                    <div style="
                        padding: 25px;
                        background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
                        border-radius: 12px;
                        border: 1px solid #e5e7eb;
                        text-align: center;
                        color: #9ca3af;
                        font-style: italic;
                    ">
                        No symptom data available for heat map visualization
                    </div>
                </div>
            `;
        }

        const heatMapItems = symptoms.map((symptom, index) => {
            const severity = parseInt(symptom.severity, 10) || 0;
            const frequency = symptom.frequency || 'unknown';
            const color = getHeatMapColor(severity);
            const opacity = getOpacity(frequency);
            const size = Math.max(30, severity * 10);
            const frequencyIcon = getFrequencyIcon(frequency);

            return `
                <div 
                    class="heat-map-item"
                    style="
                        background-color: ${color};
                        width: ${size}px;
                        height: ${size}px;
                        border-radius: 50%;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        color: white;
                        font-weight: bold;
                        font-size: ${size > 50 ? '11px' : '9px'};
                        text-align: center;
                        cursor: pointer;
                        transition: all 0.3s ease;
                        position: relative;
                        opacity: ${opacity};
                        box-shadow: 0 4px 8px rgba(0,0,0,0.2);
                        border: 2px solid rgba(255,255,255,0.3);
                    "
                    title="${symptom.name}&#10;Severity: ${severity}/10&#10;Frequency: ${frequency}"
                    onmouseover="this.style.transform='scale(1.15)'; this.style.boxShadow='0 6px 12px rgba(0,0,0,0.3)'; this.style.zIndex='10';"
                    onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='0 4px 8px rgba(0,0,0,0.2)'; this.style.zIndex='1';"
                >
                    <div style="font-size: ${size > 50 ? '10px' : '8px'}; line-height: 1;">
                        ${symptom.name.split(' ')[0]}
                    </div>
                    <div style="font-size: 12px; margin-top: 2px;">
                        ${frequencyIcon}
                    </div>
                    <div style="
                        position: absolute; 
                        bottom: -2px; 
                        right: -2px; 
                        background-color: rgba(0,0,0,0.7); 
                        border-radius: 50%;
                        width: 16px;
                        height: 16px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 8px;
                        font-weight: bold;
                    ">
                        ${severity}
                    </div>
                </div>
            `;
        }).join('');

        return `
            <div class="symptom-heat-map" style="margin-bottom: 20px;">
                <div style="display: flex; align-items: center; margin-bottom: 15px; gap: 10px;">
                    <h4 style="margin: 0; color: #374151;">🎯 Symptom Heat Map</h4>
                    <span style="font-size: 12px; color: #6b7280;">
                        Interactive severity visualization
                    </span>
                </div>

                <div style="
                    display: flex;
                    flex-wrap: wrap;
                    gap: 15px;
                    padding: 25px;
                    background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
                    border-radius: 12px;
                    border: 1px solid #e5e7eb;
                    min-height: 120px;
                    align-items: center;
                    justify-content: center;
                ">
                    ${heatMapItems}
                </div>

                <!-- SINGLE COMPREHENSIVE SPECTRUM LEGEND -->
                <div style="
                    margin-top: 15px; 
                    padding: 15px;
                    background-color: #f9fafb;
                    border-radius: 8px;
                    border: 1px solid #e5e7eb;
                ">
                    <!-- Severity Spectrum -->
                    <div style="margin-bottom: 12px;">
                        <div style="font-size: 11px; font-weight: 600; margin-bottom: 8px; color: #374151;">
                            Severity Scale:
                        </div>
                        <div style="position: relative; height: 20px; border-radius: 10px; background: linear-gradient(to right, #10b981 0%, #65a30d 25%, #eab308 50%, #ea580c 75%, #dc2626 100%); border: 1px solid #d1d5db;">
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-top: 5px; font-size: 9px; color: #6b7280;">
                            <span>0 - Minimal</span>
                            <span>2 - Mild</span>
                            <span>4 - Moderate</span>
                            <span>6 - Severe</span>
                            <span>8 - Critical</span>
                            <span>10 - Extreme</span>
                        </div>
                    </div>

                    <!-- Frequency Spectrum -->
                    <div style="margin-bottom: 8px;">
                        <div style="font-size: 11px; font-weight: 600; margin-bottom: 8px; color: #374151;">
                            Frequency Indicators:
                        </div>
                        <div style="display: flex; flex-wrap: wrap; gap: 12px; font-size: 10px; color: #6b7280;">
                            <div style="display: flex; align-items: center; gap: 4px;">
                                <span style="font-size: 12px;">🔥</span>
                                <span>Daily</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 4px;">
                                <span style="font-size: 12px;">⚡</span>
                                <span>Frequent</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 4px;">
                                <span style="font-size: 12px;">⚪</span>
                                <span>Occasional</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 4px;">
                                <span style="font-size: 12px;">✅</span>
                                <span>Controlled</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 4px;">
                                <span style="font-size: 12px;">⚠️</span>
                                <span>Triggered</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 4px;">
                                <span style="font-size: 12px;">💤</span>
                                <span>Rare</span>
                            </div>
                        </div>
                    </div>

                    <!-- Size Guide -->
                    <div>
                        <div style="font-size: 11px; font-weight: 600; margin-bottom: 8px; color: #374151;">
                            Circle Size Guide:
                        </div>
                        <div style="display: flex; align-items: center; gap: 12px; font-size: 10px; color: #6b7280;">
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <div style="width: 25px; height: 25px; background-color: #10b981; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 8px; font-weight: bold;">2</div>
                                <span>Mild</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <div style="width: 40px; height: 40px; background-color: #eab308; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 9px; font-weight: bold;">5</div>
                                <span>Moderate</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <div style="width: 60px; height: 60px; background-color: #dc2626; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 10px; font-weight: bold;">8</div>
                                <span>Severe</span>
                            </div>
                            <div style="margin-left: 15px; font-style: italic; color: #9ca3af;">
                                Larger circles = Higher severity
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async function fetchAllergeniqProfile(patientId, visitId) {
        const email = localStorage.getItem('currentEmail');
        const tenantID = localStorage.getItem('tenantID');
        if (!email || !tenantID) {
            console.error('Missing email or tenantID in localStorage');
            return { success: false, error: 'Authentication error: Missing email or tenantID' };
        }
        const url = `https://medoramd.ai/api/allergeniq-profile?patient_id=${patientId}&visit_id=${visitId}&email=${email}&tenantID=${tenantID}`;
        debugLog('Fetching AllergenIQ profile data', { url });

        try {
            const response = await fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
            const data = await response.json();
            if (!data.success) throw new Error(data.error || 'Failed to fetch AllergenIQ profile');
            debugLog('API response data', data);
            return data;
        } catch (error) {
            errorLog('Error fetching AllergenIQ profile', error);
            throw error;
        }
    }

    function showToast(message) {
        // Create toast element
        const toast = document.createElement('div');
        toast.className = 'allergeniq-toast';
        toast.textContent = message;

        // Append to body
        let toastContainer = document.getElementById('allergeniq-toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'allergeniq-toast-container';
            document.body.appendChild(toastContainer);
        }
        toastContainer.appendChild(toast);

        // Show toast
        setTimeout(() => {
            toast.classList.add('show');
        }, 100);

        // Remove toast after 3 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 3000);
    }

    function copyReport() {
        const container = document.getElementById('allergeniq-profile-container');
        if (!container) {
            errorLog('AllergenIQ container not found for copying');
            return;
        }

        // Extract text content, preserving structure
        let text = '';
        const sections = container.querySelectorAll('.category-block');
        sections.forEach(section => {
            const heading = section.querySelector('h3')?.textContent || '';
            text += `${heading}\n`;

            const paragraphs = section.querySelectorAll('p');
            paragraphs.forEach(p => {
                text += `${p.textContent}\n`;
            });

            const lists = section.querySelectorAll('ul');
            lists.forEach(ul => {
                const items = ul.querySelectorAll('li');
                items.forEach(li => {
                    text += `- ${li.textContent}\n`;
                });
            });

            // Handle table for Symptoms
            const table = section.querySelector('.symptom-heatmap');
            if (table) {
                const rows = table.querySelectorAll('tr');
                rows.forEach((row, index) => {
                    if (index === 0) return; // Skip header row
                    const cells = row.querySelectorAll('td');
                    if (cells.length === 3) {
                        text += `- ${cells[0].textContent}: Severity ${cells[1].textContent}, Frequency ${cells[2].textContent}\n`;
                    }
                });
            }

            text += '\n';
        });

        // Copy to clipboard
        navigator.clipboard.writeText(text.trim()).then(() => {
            showToast('AllergenIQ Profile copied to clipboard!');
        }).catch(err => {
            errorLog('Failed to copy AllergenIQ Profile to clipboard', err);
            showToast('Failed to copy profile. Please try again.');
        });
    }

    function downloadPDF() {
        // Placeholder for PDF generation
        // To implement this fully, you would need to include a library like jsPDF in index.html
        debugLog('Download PDF clicked - placeholder function');
        showToast('PDF generation not implemented. Add jsPDF library to enable this feature.');

        // Example implementation with jsPDF (commented out since library isn't included):
        /*
        if (typeof window.jspdf === 'undefined') {
            errorLog('jsPDF library not found');
            showToast('PDF generation not available. Missing jsPDF library.');
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const container = document.getElementById('allergeniq-profile-container');
        if (!container) {
            errorLog('AllergenIQ container not found for PDF generation');
            return;
        }

        let yOffset = 10;
        const sections = container.querySelectorAll('.category-block');
        sections.forEach(section => {
            const heading = section.querySelector('h3')?.textContent || '';
            doc.setFontSize(14);
            doc.setTextColor(26, 60, 94); // #1a3c5e
            doc.text(heading, 10, yOffset);
            yOffset += 10;

            const paragraphs = section.querySelectorAll('p');
            paragraphs.forEach(p => {
                doc.setFontSize(12);
                doc.setTextColor(75, 85, 99); // #4b5563
                doc.text(p.textContent, 10, yOffset);
                yOffset += 7;
            });

            const lists = section.querySelectorAll('ul');
            lists.forEach(ul => {
                const items = ul.querySelectorAll('li');
                items.forEach(li => {
                    doc.setFontSize(12);
                    doc.setTextColor(75, 85, 99);
                    doc.text(`- ${li.textContent}`, 15, yOffset);
                    yOffset += 7;
                });
            });

            const table = section.querySelector('.symptom-heatmap');
            if (table) {
                const rows = table.querySelectorAll('tr');
                rows.forEach((row, index) => {
                    if (index === 0) return; // Skip header row
                    const cells = row.querySelectorAll('td');
                    if (cells.length === 3) {
                        doc.setFontSize(12);
                        doc.setTextColor(75, 85, 99);
                        doc.text(`- ${cells[0].textContent}: Severity ${cells[1].textContent}, Frequency ${cells[2].textContent}`, 15, yOffset);
                        yOffset += 7;
                    }
                });
            }

            yOffset += 5;
        });

        doc.save(`AllergenIQ_Profile_${currentPatientId || 'Patient'}.pdf`);
        showToast('AllergenIQ Profile downloaded as PDF!');
        */
    }

    function renderAllergeniqProfile(data) {
        const container = document.getElementById('allergeniq-profile-container');
        if (!container) {
            errorLog('AllergenIQ container not found in DOM');
            return;
        }

        // Check if profile data exists
        const profile = data.profile || {};
        if (!profile.allergenData && !profile.medicationHistory && !profile.summary && !profile.symptomData) {
            debugLog('No profile data found in API response', data);
            container.innerHTML = '<p>No profile data available.</p>';
            return;
        }

        // Build HTML content with categorized sections
        let html = '<div class="profile-block">';

        // Diagnosis Section
        if (profile.summary) {
            html += `
                <div class="category-block">
                    <h3>Diagnosis</h3>
                    <p><strong>Primary Diagnosis:</strong> ${profile.summary.primaryDiagnosis || 'Not specified'}</p>
                    <p><strong>Alternative Diagnoses:</strong></p>
                    <ul>
                        ${(profile.summary.alternativeDiagnoses || []).map(diag => `<li>${diag}</li>`).join('') || '<li>None specified</li>'}
                    </ul>
                </div>
            `;
        } else {
            html += `
                <div class="category-block">
                    <h3>Diagnosis</h3>
                    <p>No diagnosis data available.</p>
                </div>
            `;
        }

        // Allergen Data Section
        if (profile.allergenData && profile.allergenData.length > 0) {
            html += `
                <div class="category-block">
                    <h3>Allergens</h3>
                    <ul>
                        ${profile.allergenData.map(allergen => `
                            <li>${allergen.name}: ${allergen.reaction}</li>
                        `).join('')}
                    </ul>
                </div>
            `;
        } else {
            html += `
                <div class="category-block">
                    <h3>Allergens</h3>
                    <p>No allergen data available.</p>
                </div>
            `;
        }

        // ENHANCED Symptom Data Section with Heat Map and Color Spectrum Table (NO DUPLICATE SPECTRUM)
        if (profile.symptomData && profile.symptomData.length > 0) {
            html += `
                <div class="category-block">
                    <h3>Symptoms</h3>
                    
                    <!-- HEAT MAP VISUALIZATION -->
                    ${generateSymptomHeatMap(profile.symptomData)}
                    
                    <!-- TABLE WITH COLOR SPECTRUM (NO DUPLICATE SPECTRUM BELOW) -->
                    <div style="margin-top: 20px;">
                        <h4 style="color: #374151; margin-bottom: 10px;">Detailed Symptom Table</h4>
                        <table class="symptom-heatmap" style="width: 100%; border-collapse: collapse; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                            <thead>
                                <tr style="background-color: #f8f9fa;">
                                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb; color: #374151; font-weight: 600;">Name</th>
                                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb; color: #374151; font-weight: 600;">Severity (0-10)</th>
                                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb; color: #374151; font-weight: 600;">Frequency</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${profile.symptomData.map((symptom, index) => {
                                    const severity = parseInt(symptom.severity, 10) || 0;
                                    const frequency = symptom.frequency === 'Unknown' ? 'Not specified' : symptom.frequency;
                                    const frequencyIcon = getFrequencyIcon(frequency);
                                    
                                    // Get the EXACT color for this severity level
                                    const severityColor = getHeatMapColor(severity);
                                    
                                    // Calculate percentage for bar width
                                    const percentage = Math.max(15, (severity / 10) * 100); // Minimum 15% for visibility
                                    
                                    // Determine text color based on severity
                                    const textColor = severity > 5 ? '#ffffff' : '#000000';
                                    const textShadow = severity > 5 ? '0 1px 2px rgba(0,0,0,0.7)' : 'none';
                                    
                                    return `
                                        <tr style="border-bottom: 1px solid #e5e7eb; ${index % 2 === 0 ? 'background-color: #f9fafb;' : 'background-color: white;'}">
                                            <td style="padding: 12px; color: #374151; font-weight: 500;">
                                                ${symptom.name}
                                            </td>
                                            <td style="padding: 12px; position: relative;">
                                                <!-- Severity Color Bar -->
                                                <div style="
                                                    position: relative;
                                                    background-color: #f3f4f6;
                                                    border-radius: 20px;
                                                    height: 28px;
                                                    border: 1px solid #e5e7eb;
                                                    overflow: hidden;
                                                    box-shadow: inset 0 1px 3px rgba(0,0,0,0.1);
                                                ">
                                                    <!-- Actual color fill based on exact severity -->
                                                    <div style="
                                                        position: absolute;
                                                        top: 0;
                                                        left: 0;
                                                        height: 100%;
                                                        width: ${percentage}%;
                                                        background-color: ${severityColor};
                                                        border-radius: 20px;
                                                        transition: all 0.4s ease;
                                                        box-shadow: inset 0 1px 2px rgba(255,255,255,0.2);
                                                    "></div>
                                                    
                                                    <!-- Severity text overlay -->
                                                    <div style="
                                                        position: absolute;
                                                        top: 0;
                                                        left: 0;
                                                        right: 0;
                                                        bottom: 0;
                                                        display: flex;
                                                        align-items: center;
                                                        justify-content: center;
                                                        color: ${textColor};
                                                        font-weight: bold;
                                                        font-size: 13px;
                                                        text-shadow: ${textShadow};
                                                        z-index: 2;
                                                    ">
                                                        ${severity}/10
                                                    </div>
                                                    
                                                    <!-- Severity level indicator -->
                                                    <div style="
                                                        position: absolute;
                                                        top: -8px;
                                                        right: 8px;
                                                        background-color: ${severityColor};
                                                        color: white;
                                                        font-size: 8px;
                                                        font-weight: bold;
                                                        padding: 2px 6px;
                                                        border-radius: 10px;
                                                        text-shadow: 0 1px 2px rgba(0,0,0,0.5);
                                                        z-index: 3;
                                                    ">
                                                        ${severity >= 8 ? 'SEVERE' : severity >= 6 ? 'HIGH' : severity >= 4 ? 'MOD' : severity >= 2 ? 'MILD' : 'LOW'}
                                                    </div>
                                                </div>
                                            </td>
                                            <td style="padding: 12px; color: #6b7280;">
                                                <div style="display: flex; align-items: center; gap: 6px;">
                                                    <span style="font-size: 16px;">${frequencyIcon}</span>
                                                    <span style="font-weight: 500;">${frequency}</span>
                                                </div>
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        } else {
            html += `
                <div class="category-block">
                    <h3>Symptoms</h3>
                    ${generateSymptomHeatMap([])}
                    <p>No symptom data available.</p>
                </div>
            `;
        }

        // Medication History Section
        if (profile.medicationHistory && profile.medicationHistory.length > 0) {
            html += `
                <div class="category-block">
                    <h3>Medication History</h3>
                    <ul>
                        ${profile.medicationHistory.map(med => `
                            <li>${med.name} (${med.dosage}) - Status: ${med.status}</li>
                        `).join('')}
                    </ul>
                </div>
            `;
        } else {
            html += `
                <div class="category-block">
                    <h3>Medication History</h3>
                    <p>No medication history available.</p>
                </div>
            `;
        }

        html += '</div>';

        container.innerHTML = html;
        debugLog('Displaying AllergenIQ profile data with heat map and NO duplicate spectrum', data);
    }

    async function updateProfileWithVisitId(patientId, visitId) {
        if (!patientId || !visitId) {
            errorLog('Missing patientId or visitId for AllergenIQ profile');
            return;
        }

        if (lastPatientId === patientId && lastVisitId === visitId) {
            debugLog('Same patient and visit, skipping update');
            return;
        }

        lastPatientId = patientId;
        lastVisitId = visitId;
        currentPatientId = patientId;
        currentVisitId = visitId;

        try {
            const data = await fetchAllergeniqProfile(patientId, visitId);
            renderAllergeniqProfile(data);
        } catch (error) {
            const container = document.getElementById('allergeniq-profile-container');
            if (container) {
                container.innerHTML = '<p class="error-message">Failed to load AllergenIQ profile.</p>';
            }
        }
    }

    // Set up event listeners for the buttons
    function setupEventListeners() {
        const copyBtn = document.getElementById('allergeniq-copy-btn');
        const downloadBtn = document.getElementById('allergeniq-download-btn');

        if (copyBtn) {
            copyBtn.addEventListener('click', copyReport);
        } else {
            errorLog('Copy button not found in DOM');
        }

        if (downloadBtn) {
            downloadBtn.addEventListener('click', downloadPDF);
        } else {
            errorLog('Download button not found in DOM');
        }
    }

    // Initialize on DOM load
    document.addEventListener('DOMContentLoaded', () => {
        setupEventListeners();
    });

    debugLog('AllergenIQ Profile module loaded with heat map and single spectrum legend');
    window.updateProfileWithVisitId = updateProfileWithVisitId;
})();
