function parsePlanOfCare(planText) {
    const sections = [];
    const lines = planText.split('\n');
    let currentSection = null;

    for (const line of lines) {
        if (line.startsWith('In regards to')) {
            if (currentSection) {
                sections.push(currentSection);
            }
            const condition = line.replace('In regards to ', '').replace(':', '').trim();
            currentSection = { condition, background: [], plan: [] };
        } else if (line.startsWith('* ') && currentSection) {
            if (line.startsWith('* Plan:')) {
                continue; // Skip the "Plan:" line
            }
            currentSection.background.push(line.replace('* ', '').trim());
        } else if (line.startsWith('- ') && currentSection) {
            currentSection.plan.push(line.replace('- ', '').trim());
        }
    }

    if (currentSection) {
        sections.push(currentSection);
    }

    return sections;
}

function renderPlanSections(sections, mode) {
    const container = document.getElementById('plan-content-container');
    container.innerHTML = ''; // Clear existing content

    if (sections.length === 0) {
        const noContentDiv = document.createElement('div');
        noContentDiv.className = 'plan-section plan-section--empty';
        noContentDiv.innerHTML = '<p class="ai-style italic">No plan of care available.</p>';
        container.appendChild(noContentDiv);
        return;
    }

    sections.forEach((section, index) => {
        const sectionDiv = document.createElement('div');
        sectionDiv.className = `plan-section plan-section--${index % 2 === 0 ? 'even' : 'odd'}`;

        // Condition heading with icon
        const conditionHeading = document.createElement('h4');
        conditionHeading.className = 'condition-heading';
        conditionHeading.innerHTML = `
            <span class="condition-icon">📋</span>
            In regards to ${section.condition}:
        `;
        sectionDiv.appendChild(conditionHeading);

        if (mode === 'bullet') {
            // Background items
            const backgroundDiv = document.createElement('div');
            backgroundDiv.className = 'background-container';
            if (section.background.length > 0) {
                const backgroundList = document.createElement('ul');
                backgroundList.className = 'background-list';
                section.background.forEach(item => {
                    const li = document.createElement('li');
                    li.className = 'background-item ai-style';
                    li.textContent = item;
                    backgroundList.appendChild(li);
                });
                backgroundDiv.appendChild(backgroundList);
            } else {
                backgroundDiv.innerHTML = '<p class="ai-style italic background-empty">No background information provided.</p>';
            }
            sectionDiv.appendChild(backgroundDiv);

            // Plan heading
            const planHeading = document.createElement('p');
            planHeading.className = 'plan-heading ai-style';
            planHeading.textContent = 'Plan:';
            sectionDiv.appendChild(planHeading);

            // Plan items
            const planDiv = document.createElement('div');
            planDiv.className = 'plan-container';
            if (section.plan.length > 0) {
                const planList = document.createElement('ul');
                planList.className = 'plan-list';
                section.plan.forEach(item => {
                    const li = document.createElement('li');
                    li.className = 'plan-item ai-style';
                    li.textContent = item;
                    planList.appendChild(li);
                });
                planDiv.appendChild(planList);
            } else {
                planDiv.innerHTML = '<p class="ai-style italic plan-empty">No specific plan instructions provided.</p>';
            }
            sectionDiv.appendChild(planDiv);
        } else {
            // Concise mode: Combine into a paragraph
            const contentDiv = document.createElement('div');
            contentDiv.className = 'concise-content ai-style';

            const backgroundText = section.background.length > 0 ? section.background.join(' ') : 'No background information provided.';
            const planText = section.plan.length > 0 ? section.plan.join(' ') : 'No specific plan instructions provided.';

            contentDiv.innerHTML = `
                <span class="background-text">${backgroundText}</span>
                <span class="plan-label"> Plan: </span>
                <span class="plan-text">${planText}</span>
            `;
            sectionDiv.appendChild(contentDiv);
        }

        container.appendChild(sectionDiv);
    });
}

function setupPlanToggles(sections) {
    const detailToggle = document.getElementById('plan-detail-toggle');
    const bulletToggle = document.getElementById('plan-bullet-toggle');
    let isBulletMode = true; // Default to bullet mode

    bulletToggle.addEventListener('click', () => {
        isBulletMode = !isBulletMode;
        bulletToggle.textContent = isBulletMode ? 'Bullet' : 'Concise';
        bulletToggle.classList.toggle('active', isBulletMode);
        detailToggle.textContent = isBulletMode ? 'Concise' : 'Bullet';
        renderPlanSections(sections, isBulletMode ? 'bullet' : 'concise');
    });

    detailToggle.addEventListener('click', () => {
        isBulletMode = !isBulletMode;
        bulletToggle.textContent = isBulletMode ? 'Bullet' : 'Concise';
        bulletToggle.classList.toggle('active', isBulletMode);
        detailToggle.textContent = isBulletMode ? 'Concise' : 'Bullet';
        renderPlanSections(sections, isBulletMode ? 'bullet' : 'concise');
    });

    // Initial render in bullet mode
    renderPlanSections(sections, 'bullet');
}

function renderSOAPNotes(soapNotes) {
    // Subjective
    const subjectiveContent = document.getElementById('subjective-content');
    subjectiveContent.innerHTML = soapNotes.patient_history ? formatSOAPSection(soapNotes.patient_history) : '<p class="ai-style">N/A</p>';

    // Objective
    const objectiveContent = document.getElementById('objective-content');
    objectiveContent.innerHTML = soapNotes.physical_examination ? `<p class="ai-style">${soapNotes.physical_examination}</p>` : '<p class="ai-style">N/A</p>';

    // Assessment
    const assessmentContent = document.getElementById('assessment-content');
    assessmentContent.innerHTML = soapNotes.differential_diagnosis ? `<p class="ai-style">${soapNotes.differential_diagnosis}</p>` : '<p class="ai-style">N/A</p>';

    // Plan
    const planSections = parsePlanOfCare(soapNotes.plan_of_care || '');
    setupPlanToggles(planSections);
}

function formatSOAPSection(data) {
    if (typeof data === 'string') {
        return `<p class="ai-style">${data}</p>`;
    }
    let html = '';
    for (const [key, value] of Object.entries(data)) {
        const formattedKey = key.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
        if (typeof value === 'string') {
            html += `<p class="ai-style"><strong>${formattedKey}:</strong> ${value}</p>`;
        } else if (typeof value === 'object') {
            html += `<p class="ai-style"><strong>${formattedKey}:</strong></p>`;
            html += formatSOAPSection(value);
        }
    }
    return html;
}

// Integrate existing functions from the provided patient-notes.js
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
                const title = section.querySelector('.condition-heading').textContent;
                const backgroundItems = Array.from(section.querySelectorAll('.background-item') || []).map(li => li.textContent);
                const planItems = Array.from(section.querySelectorAll('.plan-item') || []).map(li => li.textContent);
                let sectionText = `${title}\n`;
                if (backgroundItems.length > 0) {
                    sectionText += backgroundItems.map(item => `* ${item}`).join('\n') + '\n';
                }
                sectionText += '* Plan:\n';
                if (planItems.length > 0) {
                    sectionText += planItems.map(item => `- ${item}`).join('\n');
                } else {
                    sectionText += '- No specific plan instructions provided.';
                }
                planContent += `${sectionText}\n\n`;
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

function copySOAP() {
    const subjectiveContent = document.getElementById('subjective-content')?.textContent || 'N/A';
    const objectiveContent = document.getElementById('objective-content')?.textContent || 'N/A';
    const assessmentContent = document.getElementById('assessment-content')?.textContent || 'N/A';
    const planContainer = document.getElementById('plan-content-container');
    let planContent = '';
    if (planContainer) {
        const sections = planContainer.querySelectorAll('.plan-section');
        sections.forEach(section => {
            const title = section.querySelector('.condition-heading').textContent;
            const backgroundItems = Array.from(section.querySelectorAll('.background-item') || []).map(li => li.textContent);
            const planItems = Array.from(section.querySelectorAll('.plan-item') || []).map(li => li.textContent);
            let sectionText = `${title}\n`;
            if (backgroundItems.length > 0) {
                sectionText += backgroundItems.map(item => `* ${item}`).join('\n') + '\n';
            }
            sectionText += '* Plan:\n';
            if (planItems.length > 0) {
                sectionText += planItems.map(item => `- ${item}`).join('\n');
            } else {
                sectionText += '- No specific plan instructions provided.';
            }
            planContent += `${sectionText}\n\n`;
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

function editSection(sectionId) {
    console.log(`editSection called with sectionId: ${sectionId}`);
    openEditModal(sectionId);
}

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

    const saveBtn = planContainer.querySelector('.save-btn');
    const cancelBtn = planContainer.querySelector('.cancel-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', savePlanSection);
    }
    if (cancelBtn) {
        cancelBtn.addEventListener('click', cancelPlanEdit);
    }
}

function loadSectionContent() {
    const sectionId = document.getElementById('separate-section-select').value;
    const preview = document.getElementById('separate-preview');
    const textarea = document.getElementById('separate-input');

    const contentElement = document.getElementById(sectionId);
    if (contentElement) {
        const plainText = contentElement.innerText || '';
        textarea.value = plainText;
        preview.innerHTML = contentElement.innerHTML || '';
    } else {
        textarea.value = '';
        preview.innerHTML = '<p>No content found for this section</p>';
    }
}

function openEditModal(sectionId) {
    const modal = document.getElementById('separate-modal');
    const sectionSelect = document.getElementById('separate-section-select');

    if (sectionId) {
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

    loadSectionContent();
    modal.style.display = 'block';
}

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
        const planSections = parsePlanOfCare(editedContent || '');
        renderPlanSections(planSections, contentElement.classList.contains('bulleted') ? 'bullet' : 'concise');
    } else if (sectionId === 'insights-recommendations') {
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
        const formattedContent = editedContent.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .map(line => `<p>${line}</p>`)
            .join('');
        contentElement.innerHTML = formattedContent;
    }

    contentElement.classList.add('success-pulse');
    setTimeout(() => {
        contentElement.classList.remove('success-pulse');
    }, 1500);

    updateNotesOnBackend();
    closeSeparateModal();
}

function closeSeparateModal() {
    const modal = document.getElementById('separate-modal');
    if (modal) {
        modal.style.display = 'none';
        document.getElementById('separate-input').value = '';
        document.getElementById('separate-preview').innerHTML = '';
    }
}

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
    contentElement.classList.remove('editing');

    const formattedContent = editedContent.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(line => `<p>${line}</p>`)
        .join('');
    contentElement.innerHTML = formattedContent;

    contentElement.classList.add('success-pulse');
    setTimeout(() => {
        contentElement.classList.remove('success-pulse');
    }, 1500);

    updateNotesOnBackend();
}

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
    planContainer.classList.remove('editing');

    const planSections = parsePlanOfCare(editedContent || '');
    renderPlanSections(planSections, planContainer.classList.contains('bulleted') ? 'bullet' : 'concise');

    planContainer.classList.add('success-pulse');
    setTimeout(() => {
        planContainer.classList.remove('success-pulse');
    }, 1500);

    updateNotesOnBackend();
}

function cancelEdit(sectionId) {
    console.log(`cancelEdit called for ${sectionId}`);
    const contentElement = document.getElementById(`${sectionId}-content`);

    if (!contentElement) {
        console.error(`Content element for ${sectionId} not found`);
        return;
    }

    contentElement.classList.remove('editing');

    if (contentElement.dataset.originalContent) {
        contentElement.innerHTML = contentElement.dataset.originalContent;
        delete contentElement.dataset.originalContent;
    } else if (latestAnalysis && latestAnalysis.soapNotes) {
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

function cancelPlanEdit() {
    console.log('Canceling plan edit');
    const planContainer = document.getElementById('plan-content-container');

    if (!planContainer) {
        console.error('Plan container not found');
        return;
    }

    planContainer.classList.remove('editing');

    if (planContainer.dataset.originalContent) {
        planContainer.innerHTML = planContainer.dataset.originalContent;
        delete planContainer.dataset.originalContent;
    } else if (latestAnalysis && latestAnalysis.soapNotes) {
        const planSections = parsePlanOfCare(latestAnalysis.soapNotes.plan_of_care || '');
        renderPlanSections(planSections, planContainer.classList.contains('bulleted') ? 'bullet' : 'concise');
    }
}

function updateNotesOnBackend() {
    if (!activeVisitId || !currentPatientId) {
        console.log('No active visit or patient, skipping backend update');
        return;
    }

    const updatedNotes = {
        subjective: document.getElementById('subjective-content')?.innerText || '',
        objective: document.getElementById('objective-content')?.innerText || '',
        assessment: document.getElementById('assessment-content')?.innerText || '',
        plan: document.getElementById('plan-content-container')?.innerText || ''
    };

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
    });
}

function toggleBullets() {
    console.log('toggleBullets called');
    const recommendations = document.getElementById('insights-recommendations');
    const bulletToggleBtn = document.getElementById('insights-bullet-toggle');
    if (recommendations && bulletToggleBtn) {
        const isBulleted = recommendations.classList.contains('bulleted');
        const originalItems = JSON.parse(recommendations.dataset.originalItems || '[]');

        if (isBulleted) {
            recommendations.classList.remove('bulleted');
            recommendations.innerHTML = originalItems.map(item => `<p>${item.trim()}</p>`).join('');
            bulletToggleBtn.classList.remove('active');
            bulletToggleBtn.textContent = 'Bullet';
        } else {
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

function toggleDetail() {
    console.log('toggleDetail called');
    const recommendations = document.getElementById('insights-recommendations');
    const detailToggleBtn = document.getElementById('insights-detail-toggle');
    if (recommendations && detailToggleBtn) {
        const isDetailed = recommendations.classList.contains('detailed');
        const originalItems = JSON.parse(recommendations.dataset.originalItems || '[]');

        if (isDetailed) {
            recommendations.classList.remove('detailed');
            recommendations.classList.add('summary');
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
                    const pElements = items.map(item => `<p>${item.trim()}</p>`).join('');
                    const newDiv = document.createElement('div');
                    newDiv.innerHTML = pElements;
                    ulElement.parentNode.replaceChild(newDiv, ulElement);
                } else {
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
                    if (items.length > 0) {
                        if (contentElement.tagName.toLowerCase() === 'ul') {
                            contentElement.innerHTML = `<li>${items[0]}</li>`;
                        } else {
                            contentElement.innerHTML = `<p>${items[0]}</p>`;
                        }
                    }
                } else {
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
