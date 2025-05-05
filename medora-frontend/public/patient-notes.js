console.log('patient-notes.js loaded');

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

// Expose functions to the global scope
window.copySection = copySection;
window.copySOAP = copySOAP;
window.editSection = editSection;
window.editPlanSection = editPlanSection;
window.loadSectionContent = loadSectionContent;
window.openEditModal = openEditModal;
window.applySeparateEdits = applySeparateEdits;
window.closeSeparateModal = closeSeparateModal;
window.saveSection = saveSection;
window.savePlanSection = savePlanSection;
window.cancelEdit = cancelEdit;
window.cancelPlanEdit = cancelPlanEdit;
window.updateNotesOnBackend = updateNotesOnBackend;
window.toggleBullets = toggleBullets;
window.toggleDetail = toggleDetail;
window.togglePlanBullets = togglePlanBullets;
window.togglePlanDetail = togglePlanDetail;
