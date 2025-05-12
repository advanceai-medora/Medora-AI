/**
 * Medora Integration Module
 * Handles integration between different components of the Medora system
 */

// Initialize when document is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('Initializing Medora recommendations integration...');
    
    // Initialize with a small delay to ensure other components are loaded
    setTimeout(() => {
        initRecommendationsIntegration();
    }, 500);
});

/**
 * Initialize integration with recommendations system
 */
function initRecommendationsIntegration() {
    try {
        // Patch transcript submission handler if it exists
        patchTranscriptSubmissionHandler();
        
        // Patch patient selection function
        patchPatientSelectionFunction();
        
        // Initialize recommendations container monitoring
        initRecommendationsMonitoring();
        
        // Add diagnostic button if in development mode
        if (window.location.search.includes('dev=true') || window.location.hostname === 'localhost') {
            addDiagnosticButton();
        }
    } catch (error) {
        console.error('Error initializing recommendations integration:', error);
    }
}

/**
 * Wait for an element to appear in the DOM
 * @param {string} selector - The CSS selector for the element
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} interval - Interval between retries in milliseconds
 * @returns {Promise<Element>} - The found element
 */
function waitForElement(selector, maxRetries = 20, interval = 300) {
    return new Promise((resolve, reject) => {
        let retries = 0;
        
        const check = () => {
            const element = document.querySelector(selector);
            if (element) {
                resolve(element);
                return;
            }
            
            retries++;
            if (retries >= maxRetries) {
                reject(new Error(`Element ${selector} not found after ${maxRetries} retries`));
                return;
            }
            
            setTimeout(check, interval);
        };
        
        check();
    });
}

/**
 * Patch the transcript submission handler with retry logic
 */
function patchTranscriptSubmissionHandler() {
    // Define a recursive function to attempt patching with retries
    const attemptPatch = (attemptsLeft = 3) => {
        // Check if the function exists now
        if (typeof window.handleTranscriptSubmissionResponse === 'function') {
            console.log('Found handleTranscriptSubmissionResponse, patching...');
            
            // Store original function
            const originalHandler = window.handleTranscriptSubmissionResponse;
            
            // Replace with enhanced version
            window.handleTranscriptSubmissionResponse = function(response) {
                // Call original function
                originalHandler(response);
                
                // Add custom processing
                console.log('Processing transcript submission for recommendations...');
                
                try {
                    if (response && response.success) {
                        // Process recommendations if available
                        if (response.insights && response.insights.recommendations) {
                            console.log('Found recommendations in response, updating display');
                            
                            // Find recommendations container
                            const container = document.getElementById('insights-recommendations');
                            if (container) {
                                // Process and enhance recommendations
                                enhanceRecommendationsDisplay(container, response.insights.recommendations);
                            }
                        }
                    }
                } catch (error) {
                    console.error('Error processing transcript response:', error);
                }
            };
            
            console.log('handleTranscriptSubmissionResponse patched successfully');
            return true;
        } else {
            if (attemptsLeft > 0) {
                console.log(`handleTranscriptSubmissionResponse function not found, retrying in 2s (${attemptsLeft} attempts left)`);
                setTimeout(() => attemptPatch(attemptsLeft - 1), 2000);
            } else {
                console.log('handleTranscriptSubmissionResponse function not found, skipping patch');
            }
            return false;
        }
    };
    
    // Start the retry process - reduced to just 1 attempt to minimize console noise
    attemptPatch(1);
}

/**
 * Patch the patient selection function
 */
function patchPatientSelectionFunction() {
    console.log('Patching patient selection function...');
    
    // Check if the function exists
    if (typeof window.selectPatient === 'function') {
        // Store the original function
        const originalSelectPatient = window.selectPatient;
        
        // Replace with enhanced version
        window.selectPatient = async function(patientId) {
            try {
                // Call the original function and await its result
                const result = await originalSelectPatient(patientId);
                
                // Process recommendations after patient selection
                console.log('Processing recommendations after patient selection...');
                
                setTimeout(() => {
                    const recommendationsContainer = document.getElementById('insights-recommendations');
                    if (recommendationsContainer) {
                        // Check if recommendations are loaded
                        if (recommendationsContainer.textContent.trim() !== 'N/A') {
                            console.log('Found recommendations, enhancing display');
                            
                            // Get the recommendations text
                            const recommendationsText = recommendationsContainer.textContent;
                            
                            // Process and enhance the display
                            enhanceRecommendationsDisplay(recommendationsContainer, recommendationsText);
                        }
                    }
                }, 1000); // Give time for recommendations to be populated
                
                // Also check if AllergenIQ profile needs to be loaded
                if (typeof window.loadAllergenIQProfile === 'function') {
                    const visitId = document.getElementById('patient-details-current-visit')?.dataset.visitId;
                    if (patientId && visitId) {
                        console.log(`Loading AllergenIQ profile for patient ${patientId}, visit ${visitId}`);
                        window.loadAllergenIQProfile(patientId, visitId);
                    }
                }
                
                return result;
            } catch (error) {
                console.error('Error in patched selectPatient function:', error);
                // Fall back to the original behavior
                return originalSelectPatient(patientId);
            }
        };
        
        console.log('Patient selection function patched successfully');
    } else {
        console.error('selectPatient function not found, cannot patch');
    }
}

/**
 * Enhance recommendations display - IMPROVED VERSION
 * @param {HTMLElement} container - The recommendations container
 * @param {string|Object} recommendationsText - The recommendations text or object
 */
function enhanceRecommendationsDisplay(container, recommendationsText) {
    try {
        // Check if already enhanced
        if (container.dataset.enhanced === 'true') {
            console.log('Recommendations already enhanced, skipping');
            return;
        }
        
        console.log('Enhancing recommendations display...');
        
        // Store the recommendations data as a data attribute for later use
        if (typeof recommendationsText === 'object') {
            try {
                container.dataset.recommendationsData = JSON.stringify(recommendationsText);
            } catch (e) {
                console.error('Could not stringify recommendations object:', e);
            }
        } else if (typeof recommendationsText === 'string') {
            container.dataset.recommendationsData = recommendationsText;
        }
        
        // Try to use the recommendations-display.js if it exists
        if (typeof window.processRecommendationsData === 'function') {
            console.log('Using recommendations-display.js for rendering');
            const result = window.processRecommendationsData(recommendationsText);
            
            if (result) {
                // If recommendations-display.js successfully processed data, mark as enhanced
                container.dataset.enhanced = 'true';
                console.log('Recommendations display enhanced successfully by recommendations-display.js');
                return;
            }
        }
        
        // If recommendations-display.js doesn't exist or failed, use our own rendering
        renderRecommendationsManually(container, recommendationsText);
        
        // Mark as enhanced
        container.dataset.enhanced = 'true';
        console.log('Recommendations display enhanced successfully');
        
    } catch (error) {
        console.error('Error enhancing recommendations display:', error);
        // Still try to render something basic if everything else fails
        fallbackRender(container, recommendationsText);
    }
}

/**
 * Render recommendations manually if recommendations-display.js fails or isn't available
 * @param {HTMLElement} container - The recommendations container
 * @param {string|Object} recommendationsText - The recommendations text or object
 */
function renderRecommendationsManually(container, recommendationsText) {
    // Clear container first
    container.innerHTML = '';
    
    // Process recommendations data
    let sections = [];
    
    if (typeof recommendationsText === 'object') {
        // Handle object format (structured recommendations)
        if (recommendationsText.enhanced_recommendations) {
            // Handle enhanced_recommendations object or string
            const enhancedRecs = recommendationsText.enhanced_recommendations;
            
            if (typeof enhancedRecs === 'object') {
                // Process object structure
                sections = processObjectRecommendations(enhancedRecs);
            } else if (typeof enhancedRecs === 'string') {
                // Process string structure
                sections = processStringRecommendations(enhancedRecs);
            }
        } else {
            // Try to process the object directly
            sections = processObjectRecommendations(recommendationsText);
        }
    } else if (typeof recommendationsText === 'string') {
        // Handle string format
        sections = processStringRecommendations(recommendationsText);
    }
    
    // Render sections
    if (sections.length === 0) {
        // Fallback if no sections were found
        container.innerHTML = '<div class="general-section"><h3>RECOMMENDATIONS</h3><p>No specific recommendations available</p></div>';
    } else {
        // Create sections container
        const sectionsContainer = document.createElement('div');
        sectionsContainer.className = 'recommendations-sections';
        
        // Add each section
        sections.forEach(section => {
            const sectionElement = createSectionElement(section);
            sectionsContainer.appendChild(sectionElement);
        });
        
        // Add to container
        container.appendChild(sectionsContainer);
    }
}

/**
 * Process object recommendations into sections
 * @param {Object} recommendations - The recommendations object
 * @returns {Array} Array of section objects
 */
function processObjectRecommendations(recommendations) {
    const sections = [];
    
    try {
        // If recommendations is a numbered object like { "1. Medication Management": {...} }
        Object.entries(recommendations).forEach(([key, value]) => {
            // Extract section title (strip numbering if present)
            const title = key.replace(/^\d+\.\s+/, '');
            
            // Process the content based on its type
            let items = [];
            
            if (Array.isArray(value)) {
                // If value is an array, use it directly
                items = value;
            } else if (typeof value === 'object') {
                // If value is an object, convert to items
                Object.entries(value).forEach(([subKey, subValue]) => {
                    if (Array.isArray(subValue)) {
                        // If subValue is an array, add it as a nested list
                        items.push(`${subKey}:`);
                        subValue.forEach(item => {
                            items.push(`• ${item}`);
                        });
                    } else {
                        // Otherwise add as a single item
                        items.push(`${subKey}: ${subValue}`);
                    }
                });
            } else if (typeof value === 'string') {
                // If value is a string, split by newlines and bullets
                items = value.split(/[\n\r]+|\s*•\s*|\s*-\s*/)
                    .map(item => item.trim())
                    .filter(item => item.length > 0);
            }
            
            // Add the section
            sections.push({
                title: title,
                items: items
            });
        });
    } catch (error) {
        console.error('Error processing object recommendations:', error);
    }
    
    return sections;
}

/**
 * Process string recommendations into sections
 * @param {string} recommendations - The recommendations string
 * @returns {Array} Array of section objects
 */
function processStringRecommendations(recommendations) {
    const sections = [];
    
    try {
        // Check if string appears to be JSON
        if (recommendations.trim().startsWith('{') && recommendations.trim().endsWith('}')) {
            try {
                const jsonData = JSON.parse(recommendations);
                return processObjectRecommendations(jsonData);
            } catch (e) {
                console.log('String appears to be JSON but failed to parse');
                // Continue with string processing
            }
        }
        
        // Check for numbered sections like "1. Medication Management:"
        const sectionPattern = /(\d+\.\s+[^:]+):/g;
        const sectionMatches = [...recommendations.matchAll(sectionPattern)];
        
        if (sectionMatches.length > 0) {
            // Split content by section headers
            let lastIndex = 0;
            
            sectionMatches.forEach((match, index) => {
                const sectionTitle = match[1].replace(/^\d+\.\s+/, '');
                const startIndex = match.index + match[0].length;
                const endIndex = index < sectionMatches.length - 1 ? sectionMatches[index + 1].index : recommendations.length;
                
                // Extract section content
                const sectionContent = recommendations.substring(startIndex, endIndex).trim();
                
                // Split content into items by newlines or bullets
                const items = sectionContent.split(/[\n\r]+|\s*•\s*|\s*-\s*/)
                    .map(item => item.trim())
                    .filter(item => item.length > 0);
                
                // Add the section
                sections.push({
                    title: sectionTitle,
                    items: items
                });
                
                lastIndex = endIndex;
            });
        } else {
            // No sections found, treat as a single general section
            const items = recommendations.split(/[\n\r]+|\s*•\s*|\s*-\s*/)
                .map(item => item.trim())
                .filter(item => item.length > 0);
            
            sections.push({
                title: "Recommendations",
                items: items
            });
        }
    } catch (error) {
        console.error('Error processing string recommendations:', error);
    }
    
    return sections;
}

/**
 * Create a section element
 * @param {Object} section - The section object
 * @returns {HTMLElement} The section element
 */
function createSectionElement(section) {
    const sectionElement = document.createElement('div');
    sectionElement.className = 'recommendation-section';
    sectionElement.dataset.section = section.title.toLowerCase().replace(/\s+/g, '_');
    
    // Add icon based on section title
    let icon = '📋'; // Default icon
    const title = section.title.toLowerCase();
    if (title.includes('medication')) icon = '💊';
    else if (title.includes('lifestyle')) icon = '🥗';
    else if (title.includes('monitoring')) icon = '📊';
    else if (title.includes('emergency')) icon = '🚨';
    else if (title.includes('follow')) icon = '🔄';
    else if (title.includes('education')) icon = '📚';
    
    // Create header
    const header = document.createElement('div');
    header.className = 'section-header';
    header.innerHTML = `
        <div class="section-icon">${icon}</div>
        <div class="section-title">${section.title.toUpperCase()}</div>
        <div class="item-count">${section.items.length}</div>
        <button class="toggle-section">+</button>
    `;
    
    // Create content
    const content = document.createElement('div');
    content.className = 'section-content';
    content.style.display = 'none'; // Hidden by default
    
    // Add items as a list
    if (section.items.length > 0) {
        const list = document.createElement('ul');
        section.items.forEach(item => {
            const li = document.createElement('li');
            li.textContent = item;
            list.appendChild(li);
        });
        content.appendChild(list);
    } else {
        const emptyMessage = document.createElement('p');
        emptyMessage.textContent = 'No specific recommendations available';
        content.appendChild(emptyMessage);
    }
    
    // Add copy button
    const copyBtn = document.createElement('button');
    copyBtn.className = 'copy-btn';
    copyBtn.textContent = 'Copy';
    content.appendChild(copyBtn);
    
    // Add event listeners
    header.querySelector('.toggle-section').addEventListener('click', function() {
        const isExpanded = this.textContent === '-';
        this.textContent = isExpanded ? '+' : '-';
        content.style.display = isExpanded ? 'none' : 'block';
    });
    
    copyBtn.addEventListener('click', function() {
        const text = Array.from(content.querySelectorAll('li'))
            .map(li => li.textContent)
            .join('\n');
        
        // Copy to clipboard
        navigator.clipboard.writeText(text)
            .then(() => {
                const originalText = this.textContent;
                this.textContent = 'Copied!';
                setTimeout(() => {
                    this.textContent = originalText;
                }, 1500);
            })
            .catch(err => {
                console.error('Error copying to clipboard:', err);
            });
    });
    
    // Assemble the section
    sectionElement.appendChild(header);
    sectionElement.appendChild(content);
    
    return sectionElement;
}

/**
 * Fallback rendering when everything else fails
 * @param {HTMLElement} container - The recommendations container
 * @param {string|Object} recommendationsText - The recommendations text or object
 */
function fallbackRender(container, recommendationsText) {
    try {
        // Try to provide at least some basic display
        let content = '';
        
        if (typeof recommendationsText === 'string') {
            content = recommendationsText;
        } else if (typeof recommendationsText === 'object') {
            try {
                content = JSON.stringify(recommendationsText, null, 2);
            } catch (e) {
                content = 'Recommendations available (cannot display format)';
            }
        } else {
            content = 'Recommendations available';
        }
        
        container.innerHTML = `
            <div class="fallback-recommendations">
                <div class="section-header">
                    <div class="section-icon">📋</div>
                    <div class="section-title">GENERAL</div>
                    <div class="item-count">1</div>
                    <button class="toggle-section">+</button>
                </div>
                <div class="section-content" style="display:none;">
                    <p>${content}</p>
                    <button class="copy-btn">Copy</button>
                </div>
            </div>
        `;
        
        // Add event listener to toggle button
        const toggleBtn = container.querySelector('.toggle-section');
        const sectionContent = container.querySelector('.section-content');
        
        if (toggleBtn && sectionContent) {
            toggleBtn.addEventListener('click', function() {
                const isExpanded = this.textContent === '-';
                this.textContent = isExpanded ? '+' : '-';
                sectionContent.style.display = isExpanded ? 'none' : 'block';
            });
        }
        
        // Add event listener to copy button
        const copyBtn = container.querySelector('.copy-btn');
        if (copyBtn) {
            copyBtn.addEventListener('click', function() {
                navigator.clipboard.writeText(content)
                    .then(() => {
                        const originalText = this.textContent;
                        this.textContent = 'Copied!';
                        setTimeout(() => {
                            this.textContent = originalText;
                        }, 1500);
                    })
                    .catch(err => {
                        console.error('Error copying to clipboard:', err);
                    });
            });
        }
    } catch (error) {
        console.error('Error in fallback rendering:', error);
        container.innerHTML = '<p>Error displaying recommendations</p>';
    }
}

/**
 * Initialize monitoring for the recommendations container
 */
function initRecommendationsMonitoring() {
    // Wait for recommendations container
    waitForElement('#insights-recommendations')
        .then(container => {
            console.log('Recommendations container monitoring initialized');
            
            // Set up MutationObserver to monitor changes
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'childList' || mutation.type === 'characterData') {
                        // Check if content has changed
                        const content = container.textContent.trim();
                        if (content !== 'N/A') {
                            console.log('Recommendations content changed, processing update');
                            
                            // Process after a short delay to ensure full content is loaded
                            setTimeout(() => {
                                enhanceRecommendationsDisplay(container, content);
                            }, 200);
                        }
                    }
                });
            });
            
            // Start observing
            observer.observe(container, { 
                childList: true,
                characterData: true,
                subtree: true
            });
        })
        .catch(error => {
            console.warn('Recommendations container monitoring failed:', error.message);
        });
}

/**
 * Add diagnostic button for development testing
 */
function addDiagnosticButton() {
    try {
        // Create button
        const diagnosticBtn = document.createElement('button');
        diagnosticBtn.textContent = 'Diagnostic';
        diagnosticBtn.style.position = 'fixed';
        diagnosticBtn.style.bottom = '10px';
        diagnosticBtn.style.right = '10px';
        diagnosticBtn.style.zIndex = '9999';
        diagnosticBtn.style.padding = '5px 10px';
        diagnosticBtn.style.background = '#ff5722';
        diagnosticBtn.style.color = 'white';
        diagnosticBtn.style.border = 'none';
        diagnosticBtn.style.borderRadius = '4px';
        diagnosticBtn.style.cursor = 'pointer';
        
        // Add click event
        diagnosticBtn.addEventListener('click', function() {
            runDiagnostics();
        });
        
        // Add to body
        document.body.appendChild(diagnosticBtn);
        
        console.log('Diagnostic button added');
    } catch (error) {
        console.error('Error adding diagnostic button:', error);
    }
}

/**
 * Run diagnostics to check system state
 */
function runDiagnostics() {
    console.log('=== MEDORA DIAGNOSTICS ===');
    
    // Check React and Recharts
    console.log('React available:', typeof window.React !== 'undefined');
    console.log('React.Component available:', typeof window.React?.Component !== 'undefined');
    console.log('React.PureComponent available:', typeof window.React?.PureComponent !== 'undefined');
    console.log('ReactDOM available:', typeof window.ReactDOM !== 'undefined');
    console.log('PropTypes available:', typeof window.PropTypes !== 'undefined');
    console.log('Recharts available:', typeof window.Recharts !== 'undefined');
    
    // Check key elements
    console.log('insights-recommendations exists:', !!document.getElementById('insights-recommendations'));
    console.log('allergeniq-profile-container exists:', !!document.getElementById('allergeniq-profile-container'));
    
    // Check key functions
    console.log('selectPatient function available:', typeof window.selectPatient === 'function');
    console.log('loadAllergenIQProfile function available:', typeof window.loadAllergenIQProfile === 'function');
    console.log('handleTranscriptSubmissionResponse function available:', typeof window.handleTranscriptSubmissionResponse === 'function');
    
    // Current patient info
    const patientId = document.getElementById('patient-details-name')?.dataset.patientId;
    const visitId = document.getElementById('patient-details-current-visit')?.dataset.visitId;
    console.log('Current patient ID:', patientId);
    console.log('Current visit ID:', visitId);
    
    // Check AllergenIQ state
    if (typeof window.allergeniqProfileData !== 'undefined') {
        console.log('AllergenIQ data loaded:', !!window.allergeniqProfileData);
    }
    if (typeof window.allergeniqIsLoading !== 'undefined') {
        console.log('AllergenIQ loading state:', window.allergeniqIsLoading);
    }
    
    // Run AllergenIQ debug if available
    if (typeof window.debugAllergenIQ === 'function') {
        window.debugAllergenIQ();
    }
    
    console.log('=== END DIAGNOSTICS ===');
    
    // Show alert with summary
    alert('Diagnostics complete! Check console for details.');
}

// Check for React libraries and ensure compatibility with Recharts
function ensureReactLibraries() {
    // Already completed in the index.html file
    console.log('React libraries loaded via index.html');
}

// Add CSS fixes for recommendations display
(function() {
    const styleSheet = document.createElement('style');
    styleSheet.id = 'medora-recommendations-fixes';
    styleSheet.innerHTML = `
        /* Recommendations Display Fixes */
        #insights-recommendations .recommendation-section {
            margin-bottom: 15px;
            border-bottom: 1px solid #eee;
            padding-bottom: 15px;
        }
        
        #insights-recommendations .recommendation-section-header,
        #insights-recommendations .section-header {
            display: flex;
            align-items: center;
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 10px;
            color: #333;
            background-color: #f5f5f5;
            padding: 8px 10px;
            border-radius: 4px;
            position: relative;
        }
        
        #insights-recommendations .recommendation-section-content,
        #insights-recommendations .section-content {
            padding: 0 0 0 10px;
            margin-bottom: 15px;
            max-height: 500px;
            overflow: hidden;
            transition: max-height 0.3s ease-in-out;
        }
        
        #insights-recommendations .section-icon {
            margin-right: 10px;
            font-size: 18px;
        }
        
        #insights-recommendations .section-title {
            flex-grow: 1;
            font-weight: 600;
        }
        
        #insights-recommendations .item-count {
            display: inline-block;
            background: #106ba3;
            color: white;
            border-radius: 50%;
            width: 20px;
            height: 20px;
            text-align: center;
            line-height: 20px;
            font-size: 12px;
            margin-left: 8px;
            margin-right: 8px;
        }
        
        #insights-recommendations .toggle-section {
            background: none;
            border: none;
            font-size: 18px;
            cursor: pointer;
            color: #555;
            width: 24px;
            height: 24px;
            line-height: 1;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        #insights-recommendations .recommendation-section-content ul,
        #insights-recommendations .section-content ul {
            margin-left: 20px;
            padding-left: 0;
        }
        
        #insights-recommendations .recommendation-section-content li,
        #insights-recommendations .section-content li {
            margin-bottom: 8px;
            line-height: 1.5;
        }
        
        #insights-recommendations .copy-btn {
            display: block;
            margin: 10px 0 5px;
            padding: 5px 10px;
            background: #f0f0f0;
            border: 1px solid #ddd;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
        }
        
        #insights-recommendations .copy-btn:hover {
            background: #e0e0e0;
        }
        
        #insights-recommendations .highlight {
            background-color: rgba(255, 240, 0, 0.2);
            font-weight: 600;
        }
        
        /* Recommendations view toggle */
        .recommendations-view-toggle {
            display: flex;
            margin-bottom: 15px;
            border-bottom: 1px solid #eee;
            padding-bottom: 10px;
        }
        
        .recommendations-view-toggle .view-btn {
            padding: 5px 10px;
            margin-right: 5px;
            background: #f0f0f0;
            border: 1px solid #ddd;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
        }
        
        .recommendations-view-toggle .view-btn.active {
            background: #106ba3;
            color: white;
            border-color: #106ba3;
        }
        
        /* Fallback recommendations */
        .fallback-recommendations {
            padding: 10px;
            background: #f9f9f9;
            border-radius: 4px;
        }
    `;
    
    // Add to document head
    document.head.appendChild(styleSheet);
    console.log('Added CSS fixes for recommendations display');
})();

// Expose key functions to global scope
window.runMedoraDiagnostics = runDiagnostics;
window.enhanceRecommendationsDisplay = enhanceRecommendationsDisplay;
