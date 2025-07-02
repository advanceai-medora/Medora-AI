// Enhanced Plan Renderer Function for New Format
function renderEnhancedPlan(planOfCare, containerId) {
    const container = document.getElementById(containerId);
    if (!container || !planOfCare) {
        if (container) {
            container.innerHTML = '<div class="plan-empty-message">No plan data available</div>';
        }
        return;
    }
    
    // Clear existing content
    container.innerHTML = '';
    
    // Create main container with enhanced styling
    const enhancedContainer = document.createElement('div');
    enhancedContainer.className = 'enhanced-plan-content';
    
    // Split by double line breaks to get sections
    const sections = planOfCare.split('\n\n').filter(section => section.trim());
    
    if (sections.length === 0) {
        enhancedContainer.innerHTML = '<div class="plan-empty-message">No plan sections available</div>';
        container.appendChild(enhancedContainer);
        return;
    }
    
    sections.forEach((section, sectionIndex) => {
        const lines = section.split('\n').filter(line => line.trim());
        if (lines.length === 0) return;
        
        // Check if first line is a section header (ALL CAPS with colon)
        const firstLine = lines[0].trim();
        const isHeader = /^[A-Z][A-Z\s]+:$/.test(firstLine);
        
        if (isHeader) {
            const headerText = firstLine.replace(':', '');
            const contentLines = lines.slice(1);
            
            // Create section block
            const sectionBlock = document.createElement('div');
            sectionBlock.className = 'plan-section-block';
            
            // Create section header
            const headerDiv = document.createElement('div');
            headerDiv.className = 'plan-section-header';
            headerDiv.innerHTML = `<h4>${headerText}</h4>`;
            sectionBlock.appendChild(headerDiv);
            
            // Create content container
            const contentDiv = document.createElement('div');
            contentDiv.className = 'plan-section-content';
            
            // Process content lines
            contentLines.forEach((line, lineIndex) => {
                const trimmedLine = line.trim();
                if (!trimmedLine) return;
                
                // Remove leading spaces and bullet points for clean display
                const cleanLine = trimmedLine.replace(/^[\s-]*/, '');
                
                // Create bullet item
                const bulletItem = document.createElement('div');
                bulletItem.className = 'plan-bullet-item';
                
                const bulletPoint = document.createElement('span');
                bulletPoint.className = 'plan-bullet-point';
                bulletPoint.textContent = '•';
                
                const bulletText = document.createElement('span');
                bulletText.className = 'plan-bullet-text';
                bulletText.textContent = cleanLine;
                
                bulletItem.appendChild(bulletPoint);
                bulletItem.appendChild(bulletText);
                contentDiv.appendChild(bulletItem);
            });
            
            sectionBlock.appendChild(contentDiv);
            enhancedContainer.appendChild(sectionBlock);
            
        } else {
            // Fallback for non-header sections
            const fallbackSection = document.createElement('div');
            fallbackSection.className = 'plan-fallback-section';
            
            lines.forEach((line, lineIndex) => {
                const trimmedLine = line.trim();
                if (!trimmedLine) return;
                
                const cleanLine = trimmedLine.replace(/^[\s-]*/, '');
                
                // Create bullet item
                const bulletItem = document.createElement('div');
                bulletItem.className = 'plan-bullet-item';
                
                const bulletPoint = document.createElement('span');
                bulletPoint.className = 'plan-bullet-point';
                bulletPoint.textContent = '•';
                
                const bulletText = document.createElement('span');
                bulletText.className = 'plan-bullet-text';
                bulletText.textContent = cleanLine;
                
                bulletItem.appendChild(bulletPoint);
                bulletItem.appendChild(bulletText);
                fallbackSection.appendChild(bulletItem);
            });
            
            enhancedContainer.appendChild(fallbackSection);
        }
    });
    
    container.appendChild(enhancedContainer);
}

// Legacy parser for backwards compatibility (if needed)
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

    // Plan - UPDATED: Use enhanced renderer with better format detection
    if (soapNotes.plan_of_care && soapNotes.plan_of_care.trim()) {
        renderPlanContent(soapNotes.plan_of_care, 'plan-content-container');
    } else {
        // No plan data
        const container = document.getElementById('plan-content-container');
        if (container) {
            container.innerHTML = '<div class="plan-empty-message">No plan data available</div>';
        }
    }
}

// Enhanced function to detect plan format and use appropriate renderer
function renderPlanContent(planOfCare, containerId) {
    if (!planOfCare || !planOfCare.trim()) {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = '<div class="plan-empty-message">No plan data available</div>';
        }
        return;
    }
    
    // Check if this uses the new format (section headers like "CURRENT CLINICAL STATUS:")
    const hasNewFormat = /^[A-Z][A-Z\s&-]+:$/m.test(planOfCare);
    
    if (hasNewFormat) {
        // Use enhanced renderer for new format
        renderEnhancedPlan(planOfCare, containerId);
    } else {
        // Use legacy renderer for old format
        const planSections = parsePlanOfCare(planOfCare || '');
        if (typeof setupPlanToggles === 'function') {
            setupPlanToggles(planSections);
        } else if (typeof renderPlanSections === 'function') {
            renderPlanSections(planSections, 'bullet');
        } else {
            // Fallback - use enhanced renderer anyway
            renderEnhancedPlan(planOfCare, containerId);
        }
    }
}

// Enhanced Plan Renderer Function

function renderEnhancedPlan(planOfCare, containerId) {
    console.log('renderEnhancedPlan called with:', planOfCare?.substring(0, 100));
    
    const container = document.getElementById(containerId);
    if (!container || !planOfCare) {
        if (container) {
            container.innerHTML = '<div class="plan-empty-message">No plan data available</div>';
        }
        return;
    }
    
    // Clear existing content
    container.innerHTML = '';
    
    // Create main container
    const enhancedContainer = document.createElement('div');
    enhancedContainer.className = 'enhanced-plan-content';
    
    // Clean and split the plan text - FIXED: Use single line breaks, not double
    const cleanedPlan = planOfCare.trim();
    if (!cleanedPlan) {
        enhancedContainer.innerHTML = '<div class="plan-empty-message">No plan content available</div>';
        container.appendChild(enhancedContainer);
        return;
    }
    
    // Split by single line breaks and process line by line
    const lines = cleanedPlan.split('\n').map(line => line.trim()).filter(line => line);
    
    if (lines.length === 0) {
        enhancedContainer.innerHTML = '<div class="plan-empty-message">No plan sections available</div>';
        container.appendChild(enhancedContainer);
        return;
    }
    
    let currentSection = null;
    let currentContent = [];
    
    // Process each line
    lines.forEach((line, index) => {
        console.log(`Processing line ${index}: "${line}"`);
        
        // Enhanced header detection - look for ALL CAPS headers ending with colon
        const isHeader = /^[A-Z][A-Z\s&-]+:$/.test(line);
        
        if (isHeader) {
            console.log(`Found header: ${line}`);
            
            // Save previous section if exists
            if (currentSection) {
                addSection(enhancedContainer, currentSection, currentContent);
            }
            
            // Start new section
            currentSection = line.replace(':', '');
            currentContent = [];
        } else if (line) {
            // Add to current content
            currentContent.push(line);
        }
    });
    
    // Add the last section
    if (currentSection) {
        addSection(enhancedContainer, currentSection, currentContent);
    }
    
    // If no sections were found, show as simple list
    if (enhancedContainer.children.length === 0) {
        console.log('No sections found, creating fallback');
        const fallbackSection = document.createElement('div');
        fallbackSection.className = 'plan-fallback-section';
        
        lines.forEach(line => {
            if (line) {
                const bulletItem = createBulletItem(line);
                fallbackSection.appendChild(bulletItem);
            }
        });
        
        enhancedContainer.appendChild(fallbackSection);
    }
    
    container.appendChild(enhancedContainer);
    console.log('Enhanced plan rendered successfully');
}

// Helper function to add sections
function addSection(container, headerText, contentLines) {
    console.log(`Adding section: ${headerText} with ${contentLines.length} items`);
    
    // Create section block
    const sectionBlock = document.createElement('div');
    sectionBlock.className = 'plan-section-block';
    
    // Add inline styles to ensure it works even without CSS
    sectionBlock.style.cssText = `
        margin-bottom: 24px;
        background: linear-gradient(145deg, #ffffff, #f8fafc);
        border-radius: 8px;
        border-left: 4px solid #3a5ba9;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
        overflow: hidden;
        transition: all 0.2s ease;
    `;
    
    // Create section header
    const headerDiv = document.createElement('div');
    headerDiv.className = 'plan-section-header';
    headerDiv.style.cssText = `
        background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
        padding: 14px 18px;
        border-bottom: 1px solid #e0e7ff;
    `;
    
    const headerTitle = document.createElement('h4');
    headerTitle.style.cssText = `
        font-family: 'Roboto', sans-serif;
        font-size: 14px;
        font-weight: 700;
        color: #1e40af;
        margin: 0;
        text-transform: uppercase;
        letter-spacing: 0.8px;
        display: flex;
        align-items: center;
        gap: 8px;
    `;
    headerTitle.innerHTML = `📋 ${headerText}`;
    headerDiv.appendChild(headerTitle);
    sectionBlock.appendChild(headerDiv);
    
    // Create content container
    const contentDiv = document.createElement('div');
    contentDiv.className = 'plan-section-content';
    contentDiv.style.cssText = `
        padding: 18px 22px;
        background: #fff;
    `;
    
    // Process content lines
    if (contentLines.length > 0) {
        contentLines.forEach(line => {
            if (line.trim()) {
                const bulletItem = createBulletItem(line);
                contentDiv.appendChild(bulletItem);
            }
        });
    } else {
        // No content under this header
        const emptyItem = createBulletItem('No specific instructions provided', true);
        contentDiv.appendChild(emptyItem);
    }
    
    sectionBlock.appendChild(contentDiv);
    container.appendChild(sectionBlock);
}

// Helper function to create bullet items
function createBulletItem(text, isEmpty = false) {
    const bulletItem = document.createElement('div');
    bulletItem.className = 'plan-bullet-item';
    bulletItem.style.cssText = `
        display: flex;
        align-items: flex-start;
        margin-bottom: 12px;
        padding: 6px 0;
        transition: all 0.2s ease;
        border-radius: 4px;
    `;
    
    // Add hover effect
    if (!isEmpty) {
        bulletItem.addEventListener('mouseenter', function() {
            this.style.backgroundColor = '#f8fafc';
            this.style.paddingLeft = '8px';
            this.style.paddingRight = '8px';
            this.style.marginLeft = '-8px';
            this.style.marginRight = '-8px';
        });
        bulletItem.addEventListener('mouseleave', function() {
            this.style.backgroundColor = 'transparent';
            this.style.paddingLeft = '6px';
            this.style.paddingRight = '6px';
            this.style.marginLeft = '0';
            this.style.marginRight = '0';
        });
    }
    
    const bulletPoint = document.createElement('span');
    bulletPoint.className = 'plan-bullet-point';
    bulletPoint.style.cssText = `
        color: #3a5ba9;
        margin-right: 14px;
        margin-top: 2px;
        font-size: 14px;
        font-weight: 700;
        min-width: 8px;
        line-height: 1.5;
    `;
    bulletPoint.textContent = '•';
    
    const bulletText = document.createElement('span');
    bulletText.className = 'plan-bullet-text';
    bulletText.style.cssText = `
        color: ${isEmpty ? '#6b7280' : '#374151'};
        font-size: 14px;
        line-height: 1.6;
        flex: 1;
        font-family: 'Inter', sans-serif;
        font-weight: 400;
        ${isEmpty ? 'font-style: italic;' : ''}
    `;
    
    // Clean the text - remove any existing bullets/dashes
    const cleanText = text.replace(/^[\s\-\*\•]*\s*/, '');
    bulletText.textContent = cleanText;
    
    bulletItem.appendChild(bulletPoint);
    bulletItem.appendChild(bulletText);
    
    return bulletItem;
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
            // Handle both new enhanced format and legacy format
            if (planContainer.querySelector('.enhanced-plan-content')) {
                // New format - get clean text
                planContent = planContainer.textContent || '';
            } else {
                // Legacy format
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
        // Handle both new enhanced format and legacy format
        if (planContainer.querySelector('.enhanced-plan-content')) {
            // New format - get clean text
            planContent = planContainer.textContent || '';
        } else {
            // Legacy format
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
        // Check if this is new format or legacy format
        const hasNewFormat = /^[A-Z][A-Z\s]+:$/m.test(editedContent);
        
        if (hasNewFormat) {
            // Use new enhanced renderer
            renderEnhancedPlan(editedContent, 'plan-content-container');
        } else {
            // Use legacy renderer
            const planSections = parsePlanOfCare(editedContent || '');
            renderPlanSections(planSections, contentElement.classList.contains('bulleted') ? 'bullet' : 'concise');
        }
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

    // Check if this is new format or legacy format
    const hasNewFormat = /^[A-Z][A-Z\s]+:$/m.test(editedContent);
    
    if (hasNewFormat) {
        // Use new enhanced renderer
        renderEnhancedPlan(editedContent, 'plan-content-container');
    } else {
        // Use legacy renderer
        const planSections = parsePlanOfCare(editedContent || '');
        renderPlanSections(planSections, planContainer.classList.contains('bulleted') ? 'bullet' : 'concise');
    }

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
        // Restore original plan using appropriate renderer
        const planOfCare = latestAnalysis.soapNotes.plan_of_care || '';
        const hasNewFormat = /^[A-Z][A-Z\s]+:$/m.test(planOfCare);
        
        if (hasNewFormat) {
            renderEnhancedPlan(planOfCare, 'plan-content-container');
        } else {
            const planSections = parsePlanOfCare(planOfCare);
            renderPlanSections(planSections, planContainer.classList.contains('bulleted') ? 'bullet' : 'concise');
        }
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
window.renderEnhancedPlan = renderEnhancedPlan; // Export the new function
window.renderSOAPNotes = renderSOAPNotes; // Export the updated function

// COMPLETE OVERRIDE - Add this to the END of your patient-notes.js file

// Force override the renderSOAPNotes function
function renderSOAPNotes(soapNotes) {
    console.log('CUSTOM renderSOAPNotes called');
    
    // Subjective
    const subjectiveContent = document.getElementById('subjective-content');
    subjectiveContent.innerHTML = soapNotes.patient_history ? formatSOAPSection(soapNotes.patient_history) : '<p class="ai-style">N/A</p>';

    // Objective
    const objectiveContent = document.getElementById('objective-content');
    objectiveContent.innerHTML = soapNotes.physical_examination ? `<p class="ai-style">${soapNotes.physical_examination}</p>` : '<p class="ai-style">N/A</p>';

    // Assessment
    const assessmentContent = document.getElementById('assessment-content');
    assessmentContent.innerHTML = soapNotes.differential_diagnosis ? `<p class="ai-style">${soapNotes.differential_diagnosis}</p>` : '<p class="ai-style">N/A</p>';

    // Plan - FORCE ENHANCED RENDERING
    const planContainer = document.getElementById('plan-content-container');
    if (planContainer && soapNotes.plan_of_care && soapNotes.plan_of_care.trim()) {
        console.log('Forcing enhanced plan rendering');
        console.log('Plan data:', soapNotes.plan_of_care);
        forceEnhancedPlanRender(soapNotes.plan_of_care, planContainer);
    } else {
        if (planContainer) {
            planContainer.innerHTML = '<div class="plan-empty-message">No plan data available</div>';
        }
    }
}

// Force enhanced plan rendering function
function forceEnhancedPlanRender(planText, container) {
    console.log('forceEnhancedPlanRender called');
    
    // Clear container
    container.innerHTML = '';
    
    // Create wrapper with inline styles
    const wrapper = document.createElement('div');
    wrapper.style.cssText = `
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        background: #fff;
        border-radius: 8px;
        overflow: hidden;
    `;
    
    // Split plan into lines
    const lines = planText.split('\n').map(line => line.trim()).filter(line => line);
    console.log('Found lines:', lines);
    
    let currentSection = null;
    let currentItems = [];
    
    lines.forEach((line, index) => {
        console.log(`Line ${index}: "${line}"`);
        
        // Check if line is a section header (ends with colon and is mostly uppercase)
        const isHeader = line.endsWith(':') && line.match(/^[A-Z][A-Z\s&-]*:$/);
        
        if (isHeader) {
            console.log(`Found header: ${line}`);
            
            // Save previous section
            if (currentSection) {
                createPlanSection(wrapper, currentSection, currentItems);
            }
            
            // Start new section
            currentSection = line.replace(':', '');
            currentItems = [];
        } else if (line && currentSection && line !== 'PLAN:') {
            // Add to current items (skip the main "PLAN:" header)
            currentItems.push(line);
        }
    });
    
    // Add final section
    if (currentSection) {
        createPlanSection(wrapper, currentSection, currentItems);
    }
    
    // If no sections found, show raw content
    if (wrapper.children.length === 0) {
        console.log('No sections found, showing raw content');
        const fallback = document.createElement('div');
        fallback.style.cssText = 'padding: 16px; background: #f9fafb; border-radius: 6px;';
        fallback.innerHTML = planText.replace(/\n/g, '<br>');
        wrapper.appendChild(fallback);
    }
    
    container.appendChild(wrapper);
    console.log('Enhanced plan rendering complete');
}

// Create individual plan sections
function createPlanSection(container, headerText, items) {
    console.log(`Creating section: ${headerText} with items:`, items);
    
    const section = document.createElement('div');
    section.style.cssText = `
        margin-bottom: 20px;
        background: linear-gradient(145deg, #ffffff, #f8fafc);
        border-radius: 8px;
        border-left: 4px solid #3a5ba9;
        box-shadow: 0 2px 6px rgba(0,0,0,0.05);
        overflow: hidden;
    `;
    
    // Header
    const header = document.createElement('div');
    header.style.cssText = `
        background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
        padding: 12px 16px;
        border-bottom: 1px solid #e0e7ff;
    `;
    
    const title = document.createElement('h4');
    title.style.cssText = `
        font-family: 'Roboto', sans-serif;
        font-size: 14px;
        font-weight: 700;
        color: #1e40af;
        margin: 0;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        display: flex;
        align-items: center;
        gap: 8px;
    `;
    title.innerHTML = `📋 ${headerText}`;
    header.appendChild(title);
    section.appendChild(header);
    
    // Content
    const content = document.createElement('div');
    content.style.cssText = 'padding: 16px 18px; background: #fff;';
    
    if (items.length > 0) {
        items.forEach(item => {
            if (item.trim()) {
                const bulletDiv = document.createElement('div');
                bulletDiv.style.cssText = `
                    display: flex;
                    align-items: flex-start;
                    margin-bottom: 8px;
                    padding: 4px 0;
                    border-radius: 4px;
                    transition: background-color 0.2s ease;
                `;
                
                // Clean item (remove existing bullets)
                const cleanItem = item.replace(/^[\s\-\*\•]*\s*/, '');
                
                bulletDiv.innerHTML = `
                    <span style="color: #3a5ba9; margin-right: 12px; margin-top: 2px; font-size: 14px; font-weight: 700; min-width: 8px;">•</span>
                    <span style="color: #374151; font-size: 13px; line-height: 1.5; flex: 1; font-family: 'Inter', sans-serif;">${cleanItem}</span>
                `;
                
                // Hover effect
                bulletDiv.addEventListener('mouseenter', function() {
                    this.style.backgroundColor = '#f8fafc';
                    this.style.paddingLeft = '8px';
                    this.style.marginLeft = '-8px';
                });
                bulletDiv.addEventListener('mouseleave', function() {
                    this.style.backgroundColor = 'transparent';
                    this.style.paddingLeft = '4px';
                    this.style.marginLeft = '0';
                });
                
                content.appendChild(bulletDiv);
            }
        });
    } else {
        const empty = document.createElement('div');
        empty.style.cssText = 'color: #6b7280; font-style: italic; font-size: 13px;';
        empty.innerHTML = '<span style="color: #3a5ba9; margin-right: 12px; font-weight: 700;">•</span>No specific instructions provided';
        content.appendChild(empty);
    }
    
    section.appendChild(content);
    container.appendChild(section);
}

// FORCE OVERRIDE - This ensures the new function is used
setTimeout(() => {
    window.renderSOAPNotes = renderSOAPNotes;
    window.forceEnhancedPlanRender = forceEnhancedPlanRender;
    window.createPlanSection = createPlanSection;
    console.log('Plan rendering functions overridden');
}, 100);

// FINAL FIX - Replace your fixPlanDisplay function with this version that prevents recursion

let isFixingPlan = false; // Flag to prevent recursive calls

function fixPlanDisplay() {
    console.log('fixPlanDisplay called, isFixingPlan:', isFixingPlan);
    
    // Prevent recursive calls
    if (isFixingPlan) {
        console.log('Already fixing plan, skipping...');
        return;
    }
    
    const planContainer = document.getElementById('plan-content-container');
    if (!planContainer) {
        console.log('Plan container not found');
        return;
    }
    
    // Get the current text content
    const currentText = planContainer.textContent || planContainer.innerText;
    console.log('Current plan text length:', currentText.length);
    
    // Check if already formatted (contains our emoji)
    if (currentText.includes('📋')) {
        console.log('Plan already formatted, skipping...');
        return;
    }
    
    if (!currentText || !currentText.includes('CURRENT CLINICAL STATUS')) {
        console.log('No plan data found or wrong format');
        return;
    }
    
    // Set flag to prevent recursion
    isFixingPlan = true;
    
    try {
        // Clear and rebuild
        planContainer.innerHTML = '';
        
        // Split on section headers
        const sectionRegex = /(CURRENT CLINICAL STATUS:|MEDICATION MANAGEMENT:|DIAGNOSTIC WORKUP:|PATIENT EDUCATION:|FOLLOWUP:|FOLLOW UP:)/g;
        
        // Split the text using the regex
        const parts = currentText.split(sectionRegex).filter(part => part.trim());
        console.log('Split parts count:', parts.length);
        
        // Create new wrapper
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'font-family: Inter, sans-serif; background: #fff;';
        wrapper.setAttribute('data-plan-formatted', 'true'); // Mark as formatted
        
        // Process parts correctly
        let currentHeader = null;
        
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i].trim();
            
            // Skip empty parts or the initial "Plan:" junk
            if (!part || part === 'Plan:' || part.includes('Plan:')) {
                continue;
            }
            
            // Check if this part is a header (ends with colon)
            if (part.endsWith(':')) {
                currentHeader = part.replace(':', '');
                console.log(`Found header: "${currentHeader}"`);
            } else if (currentHeader) {
                // This is content for the current header
                console.log(`Processing content for "${currentHeader}"`);
                
                // Parse the content into individual items
                const items = parseContentIntoItems(part);
                console.log(`Items for "${currentHeader}":`, items.length);
                
                if (items.length > 0) {
                    addNewSection(wrapper, currentHeader, items);
                }
                
                currentHeader = null; // Reset for next section
            }
        }
        
        planContainer.appendChild(wrapper);
        console.log('Plan display fixed successfully!');
        
    } catch (error) {
        console.error('Error fixing plan display:', error);
    } finally {
        // Reset flag after a delay to allow DOM to settle
        setTimeout(() => {
            isFixingPlan = false;
            console.log('Plan fixing flag reset');
        }, 1000);
    }
}

// Helper function to parse content into individual items (keep existing)
function parseContentIntoItems(content) {
    const items = [];
    
    // Strategy 1: Split on common item prefixes
    const prefixRegex = /(Continue:|Adjust:|Avoid:|Laboratory:|Referrals:|Next appointment:|Contact provider if:|Use |Moisturize |Limit |Apply )/g;
    
    if (content.match(prefixRegex)) {
        const parts = content.split(prefixRegex).filter(part => part.trim());
        
        // Combine prefix with content
        for (let i = 0; i < parts.length; i += 2) {
            const prefix = parts[i];
            const text = parts[i + 1];
            if (prefix && text) {
                items.push(`${prefix} ${text}`.trim());
            }
        }
    } else {
        // Strategy 2: Split on capital letters followed by lowercase (sentence boundaries)
        const sentences = content.split(/(?=[A-Z][a-z])/);
        items.push(...sentences.filter(s => s.trim()));
    }
    
    // Strategy 3: If still no good items, split on common words that start new items
    if (items.length === 0) {
        const commonStarts = /(Patient|Continue|Adjust|Avoid|Laboratory|Referrals|Next|Contact|Use|Moisturize|Limit|Apply)/g;
        const parts = content.split(commonStarts);
        items.push(...parts.filter(p => p.trim()));
    }
    
    // Fallback: Just use the whole content as one item
    if (items.length === 0) {
        items.push(content);
    }
    
    // Clean up items
    return items.map(item => item.trim()).filter(item => item.length > 0);
}

// Update the mutation observer setup to be less aggressive
function setupPlanFixer() {
    console.log('Setting up plan fixer with recursion prevention');
    
    // Try to fix immediately
    setTimeout(fixPlanDisplay, 500);
    
    // Set up mutation observer with debouncing
    const planContainer = document.getElementById('plan-content-container');
    if (planContainer) {
        let timeout;
        
        const observer = new MutationObserver(function(mutations) {
            // Only trigger if the container doesn't already have our formatted content
            const hasFormatted = planContainer.querySelector('[data-plan-formatted]');
            if (!hasFormatted && !isFixingPlan) {
                console.log('Plan container changed, scheduling fix');
                clearTimeout(timeout);
                timeout = setTimeout(fixPlanDisplay, 300); // Debounce
            }
        });
        
        observer.observe(planContainer, {
            childList: true,
            subtree: true
        });
        
        console.log('Mutation observer set up with debouncing');
    }
}

// Update the window assignments
window.fixPlanDisplay = fixPlanDisplay;
window.addNewSection = addNewSection;
window.parseContentIntoItems = parseContentIntoItems;
window.setupPlanFixer = setupPlanFixer;

// Re-initialize
setupPlanFixer();

console.log('Fixed plan parser loaded - prevents recursion and preserves formatting');

// Helper function to parse content into individual items
function parseContentIntoItems(content) {
    const items = [];
    
    // Try different splitting strategies
    
    // Strategy 1: Split on common item prefixes
    const prefixRegex = /(Continue:|Adjust:|Avoid:|Laboratory:|Referrals:|Next appointment:|Contact provider if:|Use |Moisturize |Limit |Apply )/g;
    
    if (content.match(prefixRegex)) {
        const parts = content.split(prefixRegex).filter(part => part.trim());
        
        // Combine prefix with content
        for (let i = 0; i < parts.length; i += 2) {
            const prefix = parts[i];
            const text = parts[i + 1];
            if (prefix && text) {
                items.push(`${prefix} ${text}`.trim());
            }
        }
    } else {
        // Strategy 2: Split on capital letters followed by lowercase (sentence boundaries)
        const sentences = content.split(/(?=[A-Z][a-z])/);
        items.push(...sentences.filter(s => s.trim()));
    }
    
    // Strategy 3: If still no good items, split on common words that start new items
    if (items.length === 0) {
        const commonStarts = /(Patient|Continue|Adjust|Avoid|Laboratory|Referrals|Next|Contact|Use|Moisturize|Limit|Apply)/g;
        const parts = content.split(commonStarts);
        items.push(...parts.filter(p => p.trim()));
    }
    
    // Fallback: Just use the whole content as one item
    if (items.length === 0) {
        items.push(content);
    }
    
    // Clean up items
    return items.map(item => item.trim()).filter(item => item.length > 0);
}

// Keep the existing addNewSection function (it's working fine)
function addNewSection(container, title, items) {
    console.log(`Adding section: ${title} with ${items.length} items`);
    
    const section = document.createElement('div');
    section.style.cssText = `
        margin-bottom: 20px;
        background: linear-gradient(145deg, #ffffff, #f8fafc);
        border-radius: 8px;
        border-left: 4px solid #3a5ba9;
        box-shadow: 0 2px 6px rgba(0,0,0,0.08);
        overflow: hidden;
    `;
    
    // Header
    const header = document.createElement('div');
    header.style.cssText = `
        background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
        padding: 14px 18px;
        border-bottom: 1px solid #e0e7ff;
    `;
    
    const headerTitle = document.createElement('h4');
    headerTitle.style.cssText = `
        font-family: 'Roboto', sans-serif;
        font-size: 14px;
        font-weight: 700;
        color: #1e40af;
        margin: 0;
        text-transform: uppercase;
        letter-spacing: 0.8px;
        display: flex;
        align-items: center;
        gap: 8px;
    `;
    headerTitle.innerHTML = `📋 ${title}`;
    header.appendChild(headerTitle);
    section.appendChild(header);
    
    // Content
    const content = document.createElement('div');
    content.style.cssText = `padding: 18px 22px; background: #fff;`;
    
    items.forEach(item => {
        if (item.trim()) {
            const bulletDiv = document.createElement('div');
            bulletDiv.style.cssText = `
                display: flex;
                align-items: flex-start;
                margin-bottom: 10px;
                padding: 4px 0;
                border-radius: 4px;
                transition: background-color 0.2s ease;
            `;
            
            // Clean item text
            const cleanItem = item.replace(/^[\s\-\*\•]*\s*/, '').trim();
            
            if (cleanItem) {
                bulletDiv.innerHTML = `
                    <span style="color: #3a5ba9; margin-right: 14px; margin-top: 2px; font-size: 14px; font-weight: 700;">•</span>
                    <span style="color: #374151; font-size: 14px; line-height: 1.6; flex: 1; font-family: Inter, sans-serif;">${cleanItem}</span>
                `;
                
                // Hover effect
                bulletDiv.addEventListener('mouseenter', function() {
                    this.style.backgroundColor = '#f8fafc';
                    this.style.paddingLeft = '8px';
                    this.style.marginLeft = '-8px';
                });
                bulletDiv.addEventListener('mouseleave', function() {
                    this.style.backgroundColor = 'transparent';
                    this.style.paddingLeft = '4px';
                    this.style.marginLeft = '0';
                });
                
                content.appendChild(bulletDiv);
            }
        }
    });
    
    section.appendChild(content);
    container.appendChild(section);
}

// Update the window assignments
window.fixPlanDisplay = fixPlanDisplay;
window.addNewSection = addNewSection;
window.parseContentIntoItems = parseContentIntoItems;

console.log('Fixed plan parser loaded - corrected loop logic');
function addNewSection(container, title, items) {
    console.log(`Adding section: ${title} with ${items.length} items`);
    
    const section = document.createElement('div');
    section.style.cssText = `
        margin-bottom: 20px;
        background: linear-gradient(145deg, #ffffff, #f8fafc);
        border-radius: 8px;
        border-left: 4px solid #3a5ba9;
        box-shadow: 0 2px 6px rgba(0,0,0,0.08);
        overflow: hidden;
    `;
    
    // Header
    const header = document.createElement('div');
    header.style.cssText = `
        background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
        padding: 14px 18px;
        border-bottom: 1px solid #e0e7ff;
    `;
    
    const headerTitle = document.createElement('h4');
    headerTitle.style.cssText = `
        font-family: 'Roboto', sans-serif;
        font-size: 14px;
        font-weight: 700;
        color: #1e40af;
        margin: 0;
        text-transform: uppercase;
        letter-spacing: 0.8px;
        display: flex;
        align-items: center;
        gap: 8px;
    `;
    headerTitle.innerHTML = `📋 ${title}`;
    header.appendChild(headerTitle);
    section.appendChild(header);
    
    // Content
    const content = document.createElement('div');
    content.style.cssText = `padding: 18px 22px; background: #fff;`;
    
    items.forEach(item => {
        if (item.trim()) {
            const bulletDiv = document.createElement('div');
            bulletDiv.style.cssText = `
                display: flex;
                align-items: flex-start;
                margin-bottom: 10px;
                padding: 4px 0;
                border-radius: 4px;
                transition: background-color 0.2s ease;
            `;
            
            // Clean item text
            const cleanItem = item.replace(/^[\s\-\*\•]*\s*/, '');
            
            bulletDiv.innerHTML = `
                <span style="color: #3a5ba9; margin-right: 14px; margin-top: 2px; font-size: 14px; font-weight: 700;">•</span>
                <span style="color: #374151; font-size: 14px; line-height: 1.6; flex: 1; font-family: Inter, sans-serif;">${cleanItem}</span>
            `;
            
            // Hover effect
            bulletDiv.addEventListener('mouseenter', function() {
                this.style.backgroundColor = '#f8fafc';
                this.style.paddingLeft = '8px';
                this.style.marginLeft = '-8px';
            });
            bulletDiv.addEventListener('mouseleave', function() {
                this.style.backgroundColor = 'transparent';
                this.style.paddingLeft = '4px';
                this.style.marginLeft = '0';
            });
            
            content.appendChild(bulletDiv);
        }
    });
    
    section.appendChild(content);
    container.appendChild(section);
}


// PURE CLINICAL ACTION PARSER - Extracts only actual clinical decisions
// Replace your dynamic plan functions with this approach

let isFixingPlan = false;

function extractClinicalActionsOnly(planText) {
    console.log('Extracting pure clinical actions from plan');
    
    if (!planText || !planText.trim()) {
        return [];
    }
    
    const cleanText = planText.trim();
    const clinicalActions = [];
    
    // Split into individual lines and sentences
    const lines = cleanText.split(/\n/).map(line => line.trim()).filter(line => line);
    
    lines.forEach(line => {
        // Skip template section headers
        if (isTemplateHeader(line)) {
            return;
        }
        
        // Skip empty lines or very short lines
        if (!line || line.length < 5) {
            return;
        }
        
        // Extract actual clinical actions from this line
        const actions = parseClinicalAction(line);
        clinicalActions.push(...actions);
    });
    
    // Remove duplicates and clean up
    const uniqueActions = [...new Set(clinicalActions)];
    return uniqueActions.filter(action => action && action.length > 10);
}

function isTemplateHeader(line) {
    const templateHeaders = [
        /^CURRENT CLINICAL STATUS:?$/i,
        /^MEDICATION MANAGEMENT:?$/i,
        /^DIAGNOSTIC WORKUP:?$/i,
        /^PATIENT EDUCATION:?$/i,
        /^FOLLOW-UP:?$/i,
        /^FOLLOWUP:?$/i,
        /^PLAN:?$/i,
        /^ASSESSMENT:?$/i,
        /^TREATMENT:?$/i
    ];
    
    return templateHeaders.some(pattern => pattern.test(line.trim()));
}

function parseClinicalAction(line) {
    const actions = [];
    
    // Remove leading bullets and clean up
    let cleanLine = line.replace(/^[\s\-\*\•]*/, '').trim();
    
    // Skip if it's just a template header or empty
    if (!cleanLine || isTemplateHeader(cleanLine)) {
        return actions;
    }
    
    // Look for specific clinical action patterns
    const clinicalPatterns = [
        // Medication actions
        {
            pattern: /Continue:\s*(.+)/i,
            transform: (match) => `Continue ${match[1].toLowerCase()}`
        },
        {
            pattern: /Adjust:\s*(.+)/i,
            transform: (match) => `Adjust treatment: ${match[1].toLowerCase()}`
        },
        {
            pattern: /Avoid:\s*(.+)/i,
            transform: (match) => `Patient should avoid ${match[1].toLowerCase()}`
        },
        {
            pattern: /Stop:\s*(.+)/i,
            transform: (match) => `Discontinue ${match[1].toLowerCase()}`
        },
        {
            pattern: /Start:\s*(.+)/i,
            transform: (match) => `Start ${match[1].toLowerCase()}`
        },
        
        // Diagnostic actions
        {
            pattern: /Laboratory:\s*(.+)/i,
            transform: (match) => `Order ${match[1].toLowerCase()}`
        },
        {
            pattern: /Referrals:\s*(.+)/i,
            transform: (match) => `Refer for ${match[1].toLowerCase()}`
        },
        
        // Follow-up actions
        {
            pattern: /Next appointment:\s*(.+)/i,
            transform: (match) => `Schedule ${match[1].toLowerCase()}`
        },
        {
            pattern: /Contact provider if:\s*(.+)/i,
            transform: (match) => `Contact provider if ${match[1].toLowerCase()}`
        },
        
        // General clinical content
        {
            pattern: /(.+)/,
            transform: (match) => {
                // Only include if it contains clinical keywords
                const text = match[1];
                if (containsActualClinicalContent(text)) {
                    return formatClinicalAction(text);
                }
                return null;
            }
        }
    ];
    
    // Try to match patterns
    for (const { pattern, transform } of clinicalPatterns) {
        const match = cleanLine.match(pattern);
        if (match) {
            const action = transform(match);
            if (action && action.length > 10) {
                actions.push(action);
                break; // Only take the first match
            }
        }
    }
    
    return actions;
}

function containsActualClinicalContent(text) {
    const clinicalKeywords = [
        // Medications and treatments
        'apply', 'take', 'use', 'continue', 'stop', 'start', 'dose', 'mg', 'daily', 'twice', 'prn',
        'medication', 'treatment', 'therapy', 'cream', 'ointment', 'pill', 'tablet',
        
        // Procedures and tests
        'test', 'testing', 'check', 'scan', 'blood', 'urine', 'biopsy', 'x-ray', 'mri', 'ct',
        'patch testing', 'allergy testing', 'lab', 'laboratory',
        
        // Clinical conditions and symptoms
        'eczema', 'rash', 'itching', 'inflammation', 'pain', 'swelling', 'infection',
        'symptoms', 'condition', 'diagnosis', 'treatment',
        
        // Instructions and advice
        'avoid', 'limit', 'shower', 'bath', 'moisturize', 'diet', 'exercise',
        'follow up', 'appointment', 'visit', 'return', 'contact', 'call',
        
        // Specific medical terms from this case
        'prednisone', 'triamcinolone', 'eucrisa', 'vaseline', 'benadryl', 'allegra',
        'skin thinning', 'refrigerate', 'cosmetics', 'chemicals'
    ];
    
    const lowerText = text.toLowerCase();
    return clinicalKeywords.some(keyword => lowerText.includes(keyword));
}

function formatClinicalAction(text) {
    // Clean up and format the action text
    let formatted = text.trim();
    
    // Remove template prefixes if they somehow got through
    formatted = formatted.replace(/^(Continue|Adjust|Avoid|Stop|Start|Laboratory|Referrals|Next appointment|Contact provider if):\s*/i, '');
    
    // Ensure proper capitalization
    formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);
    
    // Add period if missing
    if (!/[.!?]$/.test(formatted)) {
        formatted += '.';
    }
    
    return formatted;
}

function renderPureClinicalPlan(planText, containerId) {
    console.log('Rendering pure clinical plan');
    
    const container = document.getElementById(containerId);
    if (!container) {
        console.log('Plan container not found');
        return;
    }
    
    // Prevent recursion
    if (isFixingPlan) {
        console.log('Already rendering plan, skipping...');
        return;
    }
    
    isFixingPlan = true;
    
    try {
        // Clear container
        container.innerHTML = '';
        
        // Extract pure clinical actions
        const clinicalActions = extractClinicalActionsOnly(planText);
        console.log('Extracted clinical actions:', clinicalActions);
        
        if (clinicalActions.length === 0) {
            container.innerHTML = '<div class="plan-empty-message">No clinical actions found in plan</div>';
            return;
        }
        
        // Create wrapper
        const wrapper = document.createElement('div');
        wrapper.style.cssText = `
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: #fff;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 16px;
        `;
        wrapper.setAttribute('data-plan-formatted', 'true');
        
        // Add title
        const title = document.createElement('h3');
        title.style.cssText = `
            font-family: 'Roboto', sans-serif;
            font-size: 16px;
            font-weight: 700;
            color: #1e40af;
            margin: 0 0 16px 0;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            display: flex;
            align-items: center;
            gap: 8px;
            padding-bottom: 8px;
            border-bottom: 2px solid #e0e7ff;
        `;
        title.innerHTML = '📋 CLINICAL PLAN';
        wrapper.appendChild(title);
        
        // Add clinical actions
        const actionsContainer = document.createElement('div');
        actionsContainer.style.cssText = 'margin-top: 16px;';
        
        clinicalActions.forEach((action, index) => {
            const actionDiv = document.createElement('div');
            actionDiv.style.cssText = `
                display: flex;
                align-items: flex-start;
                margin-bottom: 12px;
                padding: 8px 0;
                border-radius: 4px;
                transition: background-color 0.2s ease;
            `;
            
            // Add hover effect
            actionDiv.addEventListener('mouseenter', function() {
                this.style.backgroundColor = '#f8fafc';
                this.style.paddingLeft = '8px';
                this.style.marginLeft = '-8px';
            });
            actionDiv.addEventListener('mouseleave', function() {
                this.style.backgroundColor = 'transparent';
                this.style.paddingLeft = '8px';
                this.style.marginLeft = '0';
            });
            
            actionDiv.innerHTML = `
                <span style="
                    color: #3a5ba9; 
                    margin-right: 14px; 
                    margin-top: 3px; 
                    font-size: 14px; 
                    font-weight: 700;
                    min-width: 20px;
                ">${index + 1}.</span>
                <span style="
                    color: #374151; 
                    font-size: 14px; 
                    line-height: 1.6; 
                    flex: 1; 
                    font-family: 'Inter', sans-serif;
                ">${action}</span>
            `;
            
            actionsContainer.appendChild(actionDiv);
        });
        
        wrapper.appendChild(actionsContainer);
        container.appendChild(wrapper);
        
        console.log(`Pure clinical plan rendered with ${clinicalActions.length} actions`);
        
    } catch (error) {
        console.error('Error rendering pure clinical plan:', error);
        container.innerHTML = '<div class="plan-empty-message">Error processing clinical plan</div>';
    } finally {
        setTimeout(() => {
            isFixingPlan = false;
        }, 1000);
    }
}

// Updated function to handle pure clinical plan rendering
function fixPlanDisplay() {
    console.log('fixPlanDisplay called for pure clinical parsing');
    
    if (isFixingPlan) {
        console.log('Already fixing plan, skipping...');
        return;
    }
    
    const planContainer = document.getElementById('plan-content-container');
    if (!planContainer) {
        console.log('Plan container not found');
        return;
    }
    
    // Check if already formatted
    if (planContainer.querySelector('[data-plan-formatted]')) {
        console.log('Plan already formatted, skipping...');
        return;
    }
    
    // Get raw plan text
    const currentText = planContainer.textContent || planContainer.innerText;
    
    if (!currentText || currentText.length < 20) {
        console.log('No sufficient plan data found');
        return;
    }
    
    // Use pure clinical rendering
    renderPureClinicalPlan(currentText, 'plan-content-container');
}

// Update renderSOAPNotes to use pure clinical parsing
function renderSOAPNotesPure(soapNotes) {
    console.log('renderSOAPNotesPure called');
    
    // Subjective
    const subjectiveContent = document.getElementById('subjective-content');
    if (subjectiveContent) {
        subjectiveContent.innerHTML = soapNotes.patient_history ? formatSOAPSection(soapNotes.patient_history) : '<p class="ai-style">N/A</p>';
    }

    // Objective
    const objectiveContent = document.getElementById('objective-content');
    if (objectiveContent) {
        objectiveContent.innerHTML = soapNotes.physical_examination ? `<p class="ai-style">${soapNotes.physical_examination}</p>` : '<p class="ai-style">N/A</p>';
    }

    // Assessment
    const assessmentContent = document.getElementById('assessment-content');
    if (assessmentContent) {
        assessmentContent.innerHTML = soapNotes.differential_diagnosis ? `<p class="ai-style">${soapNotes.differential_diagnosis}</p>` : '<p class="ai-style">N/A</p>';
    }

    // Plan - Use pure clinical rendering
    if (soapNotes.plan_of_care && soapNotes.plan_of_care.trim()) {
        console.log('Rendering pure clinical plan from SOAP notes');
        renderPureClinicalPlan(soapNotes.plan_of_care, 'plan-content-container');
    } else {
        const container = document.getElementById('plan-content-container');
        if (container) {
            container.innerHTML = '<div class="plan-empty-message">No plan data available</div>';
        }
    }
}

// Export functions
window.extractClinicalActionsOnly = extractClinicalActionsOnly;
window.renderPureClinicalPlan = renderPureClinicalPlan;
window.fixPlanDisplay = fixPlanDisplay;
window.renderSOAPNotesPure = renderSOAPNotesPure;

// Override the existing renderSOAPNotes
setTimeout(() => {
    window.renderSOAPNotes = renderSOAPNotesPure;
    console.log('Pure clinical plan parser loaded - no templates, only clinical actions');
}, 100);

// UNIVERSAL PLAN OVERRIDE - Add this to the END of patient-notes.js
// This will intercept ANY plan rendering and convert it to dynamic format

let planObserver = null;
let isProcessingPlan = false;

// Function to detect and convert template plan to dynamic plan
function convertTemplateToDynamic() {
    if (isProcessingPlan) return;

    const planContainer = document.getElementById('plan-content-container');
    if (!planContainer) return;

    const planText = planContainer.textContent || planContainer.innerText;

    // Check if it contains template headers and is not already converted
    if (planText.includes('CURRENT CLINICAL STATUS:') &&
        !planContainer.querySelector('[data-dynamic-plan]')) {

        console.log('Detected template plan, converting to dynamic...');
        isProcessingPlan = true;

        try {
            // Extract clinical actions from template
            const clinicalActions = extractFromTemplate(planText);

            if (clinicalActions.length > 0) {
                // Clear and render dynamic version
                planContainer.innerHTML = '';
                renderDynamicPlanList(clinicalActions, planContainer);
                console.log('Successfully converted to dynamic plan');
            }
        } catch (error) {
            console.error('Error converting plan:', error);
        } finally {
            setTimeout(() => {
                isProcessingPlan = false;
            }, 500);
        }
    }
}

function extractFromTemplate(templateText) {
    const actions = [];
    const lines = templateText.split('\n').map(line => line.trim()).filter(line => line);

    for (const line of lines) {
        // Skip section headers
        if (line.match(/^(CURRENT CLINICAL STATUS|MEDICATION MANAGEMENT|DIAGNOSTIC WORKUP|PATIENT EDUCATION|FOLLOW|UP|PLAN):?$/)) {
            continue;
        }

        // Skip empty lines or very short lines
        if (!line || line.length < 5) {
            continue;
        }

        // Process actual content lines
        const cleanedAction = processTemplateLine(line);
        if (cleanedAction) {
            actions.push(cleanedAction);
        }
    }

    return actions;
}

function processTemplateLine(line) {
    // Remove bullet points and clean up
    let cleaned = line.replace(/^[\s\-\*\•]+/, '').trim();

    if (!cleaned || cleaned.length < 10) {
        return null;
    }

    // Transform template patterns to natural language
    const transformations = [
        {
            pattern: /^Continue:\s*(.+)/i,
            transform: (match) => `Continue ${match[1].toLowerCase()}`
        },
        {
            pattern: /^Adjust:\s*(.+)/i,
            transform: (match) => `${match[1]}`
        },
        {
            pattern: /^Avoid:\s*(.+)/i,
            transform: (match) => `Avoid ${match[1].toLowerCase()}`
        },
        {
            pattern: /^Laboratory:\s*(.+)/i,
            transform: (match) => `Order ${match[1].toLowerCase()}`
        },
        {
            pattern: /^Referrals:\s*(.+)/i,
            transform: (match) => `Schedule ${match[1].toLowerCase()}`
        },
        {
            pattern: /^Next appointment:\s*(.+)/i,
            transform: (match) => `Schedule follow-up for ${match[1].toLowerCase()}`
        },
        {
            pattern: /^Contact provider if:\s*(.+)/i,
            transform: (match) => `Contact provider if ${match[1].toLowerCase()}`
        },
        {
            pattern: /^Use\s+(.+)/i,
            transform: (match) => `Use ${match[1].toLowerCase()}`
        },
        {
            pattern: /^(.+)/,
            transform: (match) => {
                // For general content, just clean it up
                const text = match[1];
                if (containsRealClinicalContent(text)) {
                    return cleanClinicalText(text);
                }
                return null;
            }
        }
    ];

    for (const { pattern, transform } of transformations) {
        const match = cleaned.match(pattern);
        if (match) {
            const result = transform(match);
            if (result) {
                return formatFinalAction(result);
            }
        }
    }

    return null;
}

function containsRealClinicalContent(text) {
    // Check if text contains actual clinical information
    const clinicalKeywords = [
        'prednisone', 'triamcinolone', 'eucrisa', 'vaseline', 'eczema', 'patch testing',
        'allergy testing', 'iron level', 'moisturize', 'shower', 'cosmetics', 'chemicals',
        'symptoms', 'contact', 'refrigerate', 'apply', 'effective', 'ineffective',
        'primary doctor', 'provider', 'appointment', 'testing', 'treatment'
    ];

    const lowerText = text.toLowerCase();
    return clinicalKeywords.some(keyword => lowerText.includes(keyword)) && text.length > 15;
}

function cleanClinicalText(text) {
    // Clean up clinical text
    let cleaned = text.trim();

    // Remove redundant words
    cleaned = cleaned.replace(/^(Patient|The patient)\s+/i, '');

    return cleaned;
}

function formatFinalAction(action) {
    // Final formatting for action
    let formatted = action.trim();

    // Ensure proper capitalization
    formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);

    // Add period if missing
    if (!/[.!?]$/.test(formatted)) {
        formatted += '.';
    }

    return formatted;
}

function renderDynamicPlanList(actions, container) {
    // Create wrapper
    const wrapper = document.createElement('div');
    wrapper.style.cssText = `
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        background: #fff;
        border-radius: 8px;
        padding: 20px;
    `;
    wrapper.setAttribute('data-dynamic-plan', 'true');

    // Add title
    const title = document.createElement('h3');
    title.style.cssText = `
        font-family: 'Roboto', sans-serif;
        font-size: 16px;
        font-weight: 700;
        color: #1e40af;
        margin: 0 0 16px 0;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        display: flex;
        align-items: center;
        gap: 8px;
        padding-bottom: 8px;
        border-bottom: 2px solid #e0e7ff;
    `;
    title.innerHTML = '📋 TREATMENT PLAN';
    wrapper.appendChild(title);

    // Add actions
    const actionsContainer = document.createElement('div');
    actionsContainer.style.cssText = 'margin-top: 16px;';

    actions.forEach((action, index) => {
        const actionDiv = document.createElement('div');
        actionDiv.style.cssText = `
            display: flex;
            align-items: flex-start;
            margin-bottom: 12px;
            padding: 8px 0;
            border-radius: 4px;
            transition: background-color 0.2s ease;
        `;

        // Add hover effect
        actionDiv.addEventListener('mouseenter', function() {
            this.style.backgroundColor = '#f8fafc';
            this.style.paddingLeft = '8px';
            this.style.marginLeft = '-8px';
        });
        actionDiv.addEventListener('mouseleave', function() {
            this.style.backgroundColor = 'transparent';
            this.style.paddingLeft = '8px';
            this.style.marginLeft = '0';
        });

        actionDiv.innerHTML = `
            <span style="
                color: #3a5ba9;
                margin-right: 14px;
                margin-top: 3px;
                font-size: 14px;
                font-weight: 700;
                min-width: 20px;
            ">${index + 1}.</span>
            <span style="
                color: #374151;
                font-size: 14px;
                line-height: 1.6;
                flex: 1;
                font-family: 'Inter', sans-serif;
            ">${action}</span>
        `;

        actionsContainer.appendChild(actionDiv);
    });

    wrapper.appendChild(actionsContainer);
    container.appendChild(wrapper);
}

// Set up universal observer to catch ANY plan rendering
function setupUniversalPlanObserver() {
    const planContainer = document.getElementById('plan-content-container');
    if (!planContainer) {
        console.log('Plan container not found, will retry...');
        setTimeout(setupUniversalPlanObserver, 1000);
        return;
    }

    console.log('Setting up universal plan observer');

    // Disconnect existing observer
    if (planObserver) {
        planObserver.disconnect();
    }

    // Create new observer
    planObserver = new MutationObserver(function(mutations) {
        let shouldCheck = false;

        mutations.forEach(mutation => {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                shouldCheck = true;
            }
        });

        if (shouldCheck) {
            setTimeout(convertTemplateToDynamic, 100);
        }
    });

    // Start observing
    planObserver.observe(planContainer, {
        childList: true,
        subtree: true
    });

    // Also check immediately
    setTimeout(convertTemplateToDynamic, 500);

    console.log('Universal plan observer active');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupUniversalPlanObserver);
} else {
    setupUniversalPlanObserver();
}

// Also expose for manual testing
window.convertTemplateToDynamic = convertTemplateToDynamic;
window.setupUniversalPlanObserver = setupUniversalPlanObserver;

console.log('Universal plan override loaded - will convert ANY template plan to dynamic');
