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

        // Symptom Data Section (Heatmap Style)
        if (profile.symptomData && profile.symptomData.length > 0) {
            html += `
                <div class="category-block">
                    <h3>Symptoms</h3>
                    <table class="symptom-heatmap">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Severity (0-10)</th>
                                <th>Frequency</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${profile.symptomData.map(symptom => {
                                // Calculate color based on severity (0-10 scale)
                                const severity = parseInt(symptom.severity, 10);
                                let backgroundColor = '#e0e0e0'; // Default for unknown/invalid
                                if (!isNaN(severity)) {
                                    if (severity <= 3) {
                                        backgroundColor = '#90ee90'; // Light green for low severity
                                    } else if (severity <= 6) {
                                        backgroundColor = '#ffff99'; // Yellow for medium severity
                                    } else {
                                        backgroundColor = '#ff6347'; // Tomato red for high severity
                                    }
                                }
                                // Handle "Unknown" frequency
                                const frequency = symptom.frequency === 'Unknown' ? 'Not specified' : symptom.frequency;
                                return `
                                    <tr>
                                        <td>${symptom.name}</td>
                                        <td style="background-color: ${backgroundColor}; color: ${severity > 6 ? '#fff' : '#000'}">
                                            ${symptom.severity}/10
                                        </td>
                                        <td>${frequency}</td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        } else {
            html += `
                <div class="category-block">
                    <h3>Symptoms</h3>
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
        debugLog('Displaying AllergenIQ profile data', data);
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

    debugLog('AllergenIQ Profile module loaded');
    window.updateProfileWithVisitId = updateProfileWithVisitId;
})();
