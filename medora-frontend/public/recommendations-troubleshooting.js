/**
 * Recommendations Troubleshooting Module
 * Provides debugging tools for recommendations display
 */

// Initialize when document is loaded
(function() {
    console.log('[RecommendationsDebug] Initializing troubleshooting tools...');
    
    // Wait for recommendations container with timeout
    const maxWaitTime = 10000; // 10 seconds
    const checkInterval = 500; // 0.5 seconds
    let elapsedTime = 0;
    
    const checkForContainer = () => {
        const container = document.getElementById('insights-recommendations');
        
        if (container) {
            console.log('[RecommendationsDebug] Found recommendations container');
            initializeMonitoring(container);
            return;
        }
        
        elapsedTime += checkInterval;
        if (elapsedTime >= maxWaitTime) {
            console.log('[RecommendationsDebug] Timed out waiting for recommendations container');
            return;
        }
        
        setTimeout(checkForContainer, checkInterval);
    };
    
    // Start checking
    setTimeout(checkForContainer, 1000);
    
    // Add keyboard shortcut for debug panel
    document.addEventListener('keydown', function(event) {
        // Ctrl+Shift+R to toggle debug panel
        if (event.ctrlKey && event.shiftKey && event.code === 'KeyR') {
            toggleDebugPanel();
        }
    });
})();

/**
 * Initialize monitoring for recommendations container
 * @param {HTMLElement} container - The recommendations container
 */
function initializeMonitoring(container) {
    // Set up MutationObserver to monitor changes
    const observer = new MutationObserver((mutations) => {
        console.log('[RecommendationsDebug] Container mutation detected:', mutations.length, 'changes');
        logRecommendationsState();
    });
    
    // Start observing
    observer.observe(container, { 
        childList: true,
        attributes: true,
        characterData: true,
        subtree: true
    });
    
    console.log('[RecommendationsDebug] Monitoring initialized for recommendations container');
    
    // Initial state log
    logRecommendationsState();
    
    // Add debug buttons
    addDebugButtons();
}

/**
 * Log the current state of recommendations
 */
function logRecommendationsState() {
    const container = document.getElementById('insights-recommendations');
    
    console.log('[RecommendationsDebug] ===== RECOMMENDATIONS STATE =====');
    console.log('[RecommendationsDebug] Container exists:', !!container);
    
    if (container) {
        const content = container.innerHTML.trim();
        const isEnhanced = container.dataset.enhanced === 'true';
        
        // Check if container is empty
        console.log('[RecommendationsDebug] Container is empty:', content === '' || content === '<p>N/A</p>');
        
        // Check if enhanced view is initialized
        console.log('[RecommendationsDebug] Enhanced view initialized:', isEnhanced);
        
        // Determine content type
        const contentType = isEnhanced ? 'enhanced' : 
                           (content.includes('<div class="recommendation-section"') ? 'sectioned' : 
                           (content.includes('<p>') ? 'html' : 'text'));
        console.log('[RecommendationsDebug] Content type:', contentType);
        
        // Content details
        const contentDetails = getContentDetails(container, contentType);
        console.log('[RecommendationsDebug] Content details:', contentDetails);
        
        // Content preview
        console.log('[RecommendationsDebug] Content preview:', container.textContent.slice(0, 100) + (container.textContent.length > 100 ? '...' : ''));
    }
    
    console.log('[RecommendationsDebug] ================================');
}

/**
 * Get details of the content based on type
 * @param {HTMLElement} container - The recommendations container
 * @param {string} contentType - The content type
 * @returns {Object} Content details
 */
function getContentDetails(container, contentType) {
    switch (contentType) {
        case 'enhanced':
        case 'sectioned':
            const sections = container.querySelectorAll('.recommendation-section');
            return {
                sectionCount: sections.length,
                sections: Array.from(sections).map(section => ({
                    title: section.querySelector('h4')?.textContent,
                    itemCount: section.querySelectorAll('li').length
                }))
            };
        case 'html':
            return {
                elements: {
                    paragraphs: container.querySelectorAll('p').length,
                    lists: container.querySelectorAll('ul, ol').length,
                    listItems: container.querySelectorAll('li').length
                }
            };
        default:
            return {
                textLength: container.textContent.length,
                hasNewlines: container.textContent.includes('\n')
            };
    }
}

/**
 * Add debug buttons to the page
 */
function addDebugButtons() {
    // Create button container
    const buttonContainer = document.createElement('div');
    buttonContainer.id = 'recommendations-debug-buttons';
    buttonContainer.style.display = 'none';
    buttonContainer.style.position = 'fixed';
    buttonContainer.style.top = '10px';
    buttonContainer.style.right = '10px';
    buttonContainer.style.zIndex = '9999';
    buttonContainer.style.background = '#f5f5f5';
    buttonContainer.style.padding = '10px';
    buttonContainer.style.border = '1px solid #ccc';
    buttonContainer.style.borderRadius = '4px';
    buttonContainer.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
    
    // Add buttons
    buttonContainer.innerHTML = `
        <h4 style="margin-top: 0; margin-bottom: 10px;">Debug Tools</h4>
        <button id="debug-log-state">Log State</button>
        <button id="debug-reset-enhancements">Reset Enhancements</button>
        <button id="debug-force-enhance">Force Enhance</button>
        <button id="debug-fix-react">Fix React Polyfill</button>
    `;
    
    // Add to body
    document.body.appendChild(buttonContainer);
    
    // Add event listeners
    document.getElementById('debug-log-state').addEventListener('click', logRecommendationsState);
    document.getElementById('debug-reset-enhancements').addEventListener('click', resetEnhancements);
    document.getElementById('debug-force-enhance').addEventListener('click', forceEnhance);
    document.getElementById('debug-fix-react').addEventListener('click', fixReactPolyfill);
    
    console.log('[RecommendationsDebug] Debug buttons added. Press Ctrl+Shift+R to show/hide');
}

/**
 * Toggle debug panel visibility
 */
function toggleDebugPanel() {
    const panel = document.getElementById('recommendations-debug-buttons');
    if (panel) {
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    }
}

/**
 * Reset enhancements on recommendations
 */
function resetEnhancements() {
    const container = document.getElementById('insights-recommendations');
    if (container) {
        // Store original content if not already stored
        if (!container.dataset.originalContent) {
            container.dataset.originalContent = container.innerHTML;
        }
        
        // Reset to original content
        if (container.dataset.originalContent) {
            container.innerHTML = container.dataset.originalContent;
        }
        
        // Reset enhancement flag
        delete container.dataset.enhanced;
        
        console.log('[RecommendationsDebug] Enhancements reset');
        logRecommendationsState();
    }
}

/**
 * Force enhancement of recommendations
 */
function forceEnhance() {
    const container = document.getElementById('insights-recommendations');
    if (container && window.enhanceRecommendationsDisplay) {
        window.enhanceRecommendationsDisplay(container, container.textContent);
        console.log('[RecommendationsDebug] Forced enhancement');
        logRecommendationsState();
    } else {
        console.warn('[RecommendationsDebug] Cannot force enhance, function not available');
    }
}

/**
 * Fix React polyfill
 */
function fixReactPolyfill() {
    try {
        // Enhanced React polyfill for Recharts
        if (typeof window.React === 'undefined') {
            console.warn('[RecommendationsDebug] React not found, creating complete polyfill');
            window.React = {
                Component: function() { this.setState = function() {}; },
                PureComponent: function() { this.setState = function() {}; },
                createElement: function() { return {}; },
                createContext: function() { return { Provider: {}, Consumer: {} }; },
                createRef: function() { return { current: null }; },
                forwardRef: function(render) { return render; },
                Fragment: Symbol('Fragment'),
                StrictMode: Symbol('StrictMode'),
                useState: function() { return [null, function() {}]; },
                useEffect: function() {},
                useRef: function() { return { current: null }; },
                useMemo: function(factory) { return factory(); },
                useCallback: function(callback) { return callback; },
                useContext: function() { return {}; }
            };
        } else {
            // React exists but might be missing some components Recharts needs
            if (typeof window.React.PureComponent === 'undefined') {
                console.warn('[RecommendationsDebug] React.PureComponent not found, adding to existing React');
                window.React.PureComponent = window.React.Component || function() {
                    this.setState = function() {};
                };
            }
            if (typeof window.React.createRef === 'undefined') {
                window.React.createRef = function() { return { current: null }; };
            }
            if (typeof window.React.forwardRef === 'undefined') {
                window.React.forwardRef = function(render) { return render; };
            }
        }
        
        // Check if ReactDOM exists (also needed by Recharts)
        if (typeof window.ReactDOM === 'undefined') {
            console.warn('[RecommendationsDebug] ReactDOM not found, creating minimal polyfill');
            window.ReactDOM = {
                render: function() {},
                unmountComponentAtNode: function() {},
                findDOMNode: function() { return null; },
                createPortal: function(children) { return children; }
            };
        }
        
        console.log('[RecommendationsDebug] React polyfill fix applied');
        
        // Try to reload Recharts
        if (typeof window.Recharts === 'undefined') {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/recharts/2.1.9/Recharts.min.js';
            script.crossOrigin = 'anonymous';
            script.onload = function() {
                console.log('[RecommendationsDebug] Recharts reloaded successfully');
            };
            script.onerror = function() {
                console.error('[RecommendationsDebug] Failed to reload Recharts');
            };
            document.head.appendChild(script);
        }
    } catch (error) {
        console.error('[RecommendationsDebug] Error fixing React polyfill:', error);
    }
}

// Expose functions to global scope
window.debugRecommendations = {
    logState: logRecommendationsState,
    resetEnhancements: resetEnhancements,
    forceEnhance: forceEnhance,
    fixReactPolyfill: fixReactPolyfill,
    toggleDebugPanel: toggleDebugPanel
};
