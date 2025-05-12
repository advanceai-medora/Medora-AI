/**
 * Enhanced Medical Recommendations Component - Improved Version
 * 
 * This script provides a robust display for medical recommendations
 * with improved error handling, data format flexibility, and debugging capabilities.
 */

// Global variables for tracking state
let expandedSections = new Set(['medication']); // Default expanded section
let currentViewMode = 'bullet'; // Default view mode
let lastLoggedError = null; // Track last error for preventing log spam

// Initialize component when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  initRecommendationsDisplay();
});

/**
 * Initialize the recommendations display component with improved error handling
 */
function initRecommendationsDisplay() {
  try {
    const container = document.getElementById('insights-recommendations');
    if (!container) {
      logError('Recommendations container not found', 'missing-container');
      return;
    }

    // Check if we have recommendations data
    const originalContent = container.innerHTML;
    if (originalContent.includes('N/A') || originalContent.trim() === '<p>N/A</p>') {
      console.log('No recommendations available');
      return;
    }

    // Preserve the existing structure if it's already in the format we want
    if (container.querySelector('.recommendation-section')) {
      console.log('Enhanced recommendations already initialized');
      initViewToggleButtons();
      return;
    }

    // Extract recommendations from current content if available
    let recommendations = extractRecommendationsFromContent(container);
    
    // If we couldn't extract structured data, use a default empty structure
    if (!recommendations || Object.keys(recommendations).length === 0) {
      recommendations = getDefaultRecommendationsStructure();
    }
    
    // Render the enhanced UI
    renderEnhancedRecommendations(container, recommendations);
    
    // Add button event listeners for toggling views
    initViewToggleButtons();
    
    console.log('Successfully initialized recommendations display');
  } catch (error) {
    logError(`Error initializing recommendations display: ${error.message}`, 'init-error');
    // Fall back to maintaining the original content
    console.log('Falling back to original content due to initialization error');
  }
}

/**
 * Logs errors with deduplication to prevent console spam
 */
function logError(message, errorCode) {
  const errorKey = `${errorCode}:${message}`;
  if (lastLoggedError !== errorKey) {
    console.error(`[RecommendationsDisplay] ${message}`);
    lastLoggedError = errorKey;
    
    // Add custom error tracking if needed
    if (window.reportError && typeof window.reportError === 'function') {
      window.reportError('recommendations-display', errorCode, message);
    }
  }
}

/**
 * Extract recommendations from the current HTML content with improved parsing
 */
function extractRecommendationsFromContent(container) {
  try {
    const recommendations = {};
    
    // First, try to find existing formatted structure
    const sections = container.querySelectorAll('div[data-section]');
    if (sections.length > 0) {
      sections.forEach(section => {
        const sectionKey = section.dataset.section;
        const title = section.querySelector('h3')?.textContent || 'Unknown';
        const items = Array.from(section.querySelectorAll('li')).map(li => li.textContent);
        
        recommendations[sectionKey] = {
          title: title,
          items: items.length > 0 ? items : ["No specific recommendations available."]
        };
      });
      
      return recommendations;
    }
    
    // If no structured format found, try to parse from list items or nested JSON
    const listItems = container.querySelectorAll('li');
    
    // Check if content might be JSON (starts with { and ends with })
    const contentText = container.textContent.trim();
    if (contentText.startsWith('{') && contentText.endsWith('}')) {
      try {
        const jsonData = JSON.parse(contentText);
        return convertJSONToRecommendations(jsonData);
      } catch (jsonError) {
        console.log('Content appears to be JSON but failed to parse:', jsonError);
        // Continue with other parsing methods
      }
    }
    
    if (listItems.length === 0) {
      // Try to extract from the current layout with section headings and pills
      return extractFromCurrentLayout(container);
    }
    
    let currentSection = 'general';
    
    // Process each list item
    Array.from(listItems).forEach(item => {
      const text = item.textContent.trim();
      
      // Check if this item is a section header (numbered sections)
      const sectionMatch = text.match(/^(\d+)\.\s+([^:]+):/);
      if (sectionMatch) {
        currentSection = sectionMatch[2].toLowerCase().replace(/\s+/g, '_');
        const sectionTitle = sectionMatch[2];
        
        recommendations[currentSection] = {
          title: sectionTitle,
          items: []
        };
      } else {
        // It's a regular item, add to current section
        if (!recommendations[currentSection]) {
          recommendations[currentSection] = {
            title: currentSection.charAt(0).toUpperCase() + currentSection.slice(1).replace(/_/g, ' '),
            items: []
          };
        }
        recommendations[currentSection].items.push(text);
      }
    });
    
    return recommendations;
  } catch (error) {
    logError(`Error extracting recommendations from content: ${error.message}`, 'extraction-error');
    return null;
  }
}

/**
 * Convert various JSON formats to our recommendations structure
 * This handles both the structured and unstructured JSON formats from the backend
 */
function convertJSONToRecommendations(jsonData) {
  try {
    const recommendations = {};
    
    // Case 1: If the JSON is already in our expected format with section keys
    if (jsonData.medication_management || jsonData.lifestyle_modifications) {
      return jsonData;
    }
    
    // Case 2: Handle the enhanced_recommendations object structure 
    if (typeof jsonData.enhanced_recommendations === 'object') {
      Object.entries(jsonData.enhanced_recommendations).forEach(([key, value]) => {
        const sectionKey = key.toLowerCase().replace(/\d+\.\s+/g, '').replace(/\s+/g, '_');
        const sectionTitle = key.replace(/^\d+\.\s+/, '');
        
        // Extract items from object with bullet points or convert to array of strings
        let items = [];
        if (Array.isArray(value)) {
          items = value;
        } else if (typeof value === 'object') {
          items = Object.entries(value).map(([subKey, subValue]) => {
            if (Array.isArray(subValue)) {
              return `${subKey}: ${subValue.join(', ')}`;
            } else {
              return `${subKey}: ${subValue}`;
            }
          });
        } else if (typeof value === 'string') {
          // Split by newlines or bullet points
          items = value.split(/[\n\r]+|\s*•\s*/).filter(item => item.trim().length > 0);
        }
        
        recommendations[sectionKey] = {
          title: sectionTitle,
          items: items.length > 0 ? items : ["No specific recommendations available."]
        };
      });
      
      return recommendations;
    }
    
    // Case 3: Handle the enhanced_recommendations as a string with structured format
    if (typeof jsonData.enhanced_recommendations === 'string') {
      const enhancedRecs = jsonData.enhanced_recommendations;
      
      // Check if the string has numbered sections like "1. Medication Management:"
      const sections = enhancedRecs.split(/\d+\.\s+[^:]+:/);
      const sectionTitles = enhancedRecs.match(/\d+\.\s+[^:]+:/g) || [];
      
      if (sections.length > 1 && sectionTitles.length > 0) {
        // Skip the first empty split result
        for (let i = 0; i < sectionTitles.length; i++) {
          const sectionTitle = sectionTitles[i].replace(/^\d+\.\s+/, '').replace(/:$/, '');
          const sectionKey = sectionTitle.toLowerCase().replace(/\s+/g, '_');
          const sectionContent = sections[i + 1].trim();
          
          // Split section content into bullet points or paragraphs
          let items = sectionContent.split(/[\n\r]+|\s*•\s*|\s*-\s*/).filter(item => item.trim().length > 0);
          
          recommendations[sectionKey] = {
            title: sectionTitle,
            items: items.length > 0 ? items : ["No specific recommendations available."]
          };
        }
        
        return recommendations;
      }
      
      // If no sections found, treat as a single general section
      recommendations.general = {
        title: "Recommendations",
        items: enhancedRecs.split(/[\n\r]+|\s*•\s*|\s*-\s*/).filter(item => item.trim().length > 0)
      };
      
      return recommendations;
    }
    
    // Case 4: Fall back to using the entire recommendations object
    recommendations.general = {
      title: "Recommendations",
      items: ["See full recommendations in medical record."]
    };
    
    return recommendations;
  } catch (error) {
    logError(`Error converting JSON to recommendations: ${error.message}`, 'json-conversion-error');
    return null;
  }
}

/**
 * Extract recommendations from the current layout with section headings and pills
 */
function extractFromCurrentLayout(container) {
  try {
    const recommendations = {};
    
    // Find all section headers
    const sectionHeaders = container.querySelectorAll('span.section-icon, div.header-content');
    if (sectionHeaders.length === 0) {
      // Look for h3-like elements or any section indicators
      const possibleSections = container.querySelectorAll('div, span');
      
      // Iterate through all elements to find section titles
      possibleSections.forEach(element => {
        const text = element.textContent.trim();
        
        // Look for common section titles
        const sectionTitles = [
          'MEDICATION MANAGEMENT', 'LIFESTYLE MODIFICATIONS', 'MONITORING PROTOCOL',
          'EMERGENCY ACTION PLAN', 'LONG-TERM MANAGEMENT STRATEGY', 'PATIENT EDUCATION RESOURCES', 
          'FOLLOW-UP SCHEDULE'
        ];
        
        for (const title of sectionTitles) {
          if (text.includes(title)) {
            const sectionKey = title.toLowerCase().replace(/\s+/g, '_');
            const itemCount = element.querySelector('span')?.textContent || '0';
            
            recommendations[sectionKey] = {
              title: title,
              items: Array(parseInt(itemCount) || 1).fill("Recommendation item")
            };
            break;
          }
        }
      });
    }
    
    // Alternative: Look for paragraphs that might contain recommendations
    if (Object.keys(recommendations).length === 0) {
      const paragraphs = container.querySelectorAll('p');
      if (paragraphs.length > 0) {
        recommendations.general = {
          title: "General Recommendations",
          items: Array.from(paragraphs).map(p => p.textContent.trim()).filter(text => text && text !== 'N/A')
        };
      }
    }
    
    // If still no recommendations found, check if the container has direct text content
    if (Object.keys(recommendations).length === 0) {
      const textContent = container.textContent.trim();
      if (textContent && textContent !== 'N/A') {
        // Try to split by lines or bullets
        const items = textContent.split(/[\n\r]+|\s*•\s*|\s*-\s*/).filter(item => item.trim().length > 0);
        if (items.length > 0) {
          recommendations.general = {
            title: "General Recommendations",
            items: items
          };
        }
      }
    }
    
    // If still no recommendations found, use default structure
    if (Object.keys(recommendations).length === 0) {
      return null;
    }
    
    return recommendations;
  } catch (error) {
    logError(`Error extracting from current layout: ${error.message}`, 'layout-extraction-error');
    return null;
  }
}

/**
 * Get a default structure for recommendations if none is available
 */
function getDefaultRecommendationsStructure() {
  return {
    medication_management: {
      title: "Medication Management",
      items: ["No specific medication recommendations available."]
    },
    lifestyle_modifications: {
      title: "Lifestyle Modifications",
      items: ["No specific lifestyle recommendations available."]
    },
    monitoring_protocol: {
      title: "Monitoring Protocol",
      items: ["No specific monitoring recommendations available."]
    },
    emergency_action_plan: {
      title: "Emergency Action Plan",
      items: ["No specific emergency action plan available."]
    },
    patient_education_resources: {
      title: "Patient Education Resources",
      items: ["No specific patient education resources available."]
    },
    follow_up_schedule: {
      title: "Follow-Up Schedule",
      items: ["No specific follow-up schedule available."]
    },
    long_term_management_strategy: {
      title: "Long-Term Management Strategy",
      items: ["No specific long-term management strategy available."]
    }
  };
}

/**
 * Renders the enhanced recommendations UI
 */
function renderEnhancedRecommendations(container, recommendations) {
  try {
    // Clear existing content
    container.innerHTML = '';
    container.classList.add('enhanced-recommendations');
    
    // Create the container for recommendations
    const recsContainer = document.createElement('div');
    recsContainer.className = 'recommendations-container';
    
    // Add each section
    Object.keys(recommendations).forEach(sectionKey => {
      const section = recommendations[sectionKey];
      const sectionElement = createSectionElement(sectionKey, section);
      recsContainer.appendChild(sectionElement);
    });
    
    // Add view toggle buttons
    const viewToggle = document.createElement('div');
    viewToggle.className = 'recommendations-view-toggle';
    viewToggle.innerHTML = `
      <button id="concise-view-btn" class="view-btn">Concise</button>
      <button id="bullet-view-btn" class="view-btn active">Bullet</button>
      <button id="copy-edit-btn" class="view-btn">Copy/Edit</button>
    `;
    
    // Add to container
    container.appendChild(recsContainer);
    container.appendChild(viewToggle);
    
    // Set initial view mode
    setViewMode(currentViewMode);
  } catch (error) {
    logError(`Error rendering recommendations: ${error.message}`, 'render-error');
    
    // Fall back to basic display if rendering fails
    try {
      container.innerHTML = '<div class="fallback-recommendations"><p>Recommendations available. Please refresh to view.</p></div>';
    } catch (fallbackError) {
      logError(`Even fallback rendering failed: ${fallbackError.message}`, 'fallback-error');
    }
  }
}

/**
 * Creates a collapsible section element
 */
function createSectionElement(sectionKey, section) {
  const sectionElement = document.createElement('div');
  sectionElement.className = 'recommendation-section';
  sectionElement.dataset.section = sectionKey;
  
  // Determine if this section should be expanded
  const isExpanded = expandedSections.has(sectionKey);
  
  // Create header with toggle
  const header = document.createElement('div');
  header.className = 'section-header';
  
  // Format the title to match existing style
  const formattedTitle = section.title.toUpperCase();
  
  header.innerHTML = `
    <div class="header-content">
      <span class="section-icon">${getSectionIcon(sectionKey)}</span>
      <h3>${formattedTitle}</h3>
      <span class="item-count">${section.items.length}</span>
    </div>
    <button class="toggle-btn ${isExpanded ? 'expanded' : ''}">
      ${isExpanded ? '−' : '+'}
    </button>
  `;
  
  // Create content
  const content = document.createElement('div');
  content.className = 'section-content';
  content.style.display = isExpanded ? 'block' : 'none';
  
  const itemsList = document.createElement('ul');
  section.items.forEach(item => {
    if (item && typeof item === 'string') {
      const listItem = document.createElement('li');
      // Check if the item starts with a dash or bullet and remove it
      let cleanedItem = item.replace(/^[-•]\s+/, '').trim();
      
      // Highlight important keywords
      cleanedItem = highlightKeywords(cleanedItem);
      
      listItem.innerHTML = cleanedItem;
      itemsList.appendChild(listItem);
    } else if (item && typeof item === 'object') {
      // Handle case where items are objects (like in medication lists)
      const listItem = document.createElement('li');
      try {
        const itemText = Object.entries(item)
          .map(([key, value]) => `<strong>${key}:</strong> ${value}`)
          .join(', ');
        listItem.innerHTML = itemText;
      } catch (e) {
        listItem.textContent = 'Invalid recommendation format';
      }
      itemsList.appendChild(listItem);
    }
  });
  
  content.appendChild(itemsList);
  
  // Add actions container
  const actionsContainer = document.createElement('div');
  actionsContainer.className = 'section-actions';
  actionsContainer.innerHTML = `
    <button class="copy-btn" title="Copy to clipboard">Copy</button>
    <button class="edit-btn" title="Edit recommendation">Edit</button>
  `;
  
  content.appendChild(actionsContainer);
  
  // Add event listener for toggling
  header.querySelector('.toggle-btn').addEventListener('click', function() {
    const isCurrentlyExpanded = this.classList.contains('expanded');
    
    // Toggle button appearance
    this.classList.toggle('expanded');
    this.textContent = isCurrentlyExpanded ? '+' : '−';
    
    // Toggle content visibility with animation
    const contentElement = this.closest('.recommendation-section').querySelector('.section-content');
    
    if (isCurrentlyExpanded) {
      // Collapse with animation
      contentElement.style.maxHeight = contentElement.scrollHeight + 'px';
      setTimeout(() => {
        contentElement.style.maxHeight = '0';
      }, 10);
      setTimeout(() => {
        contentElement.style.display = 'none';
      }, 300); // Match transition duration in CSS
      
      expandedSections.delete(sectionKey);
    } else {
      // Expand with animation
      contentElement.style.display = 'block';
      contentElement.style.maxHeight = '0';
      setTimeout(() => {
        contentElement.style.maxHeight = contentElement.scrollHeight + 'px';
      }, 10);
      setTimeout(() => {
        contentElement.style.maxHeight = 'none'; // Allow content to grow if edited
      }, 300); // Match transition duration in CSS
      
      expandedSections.add(sectionKey);
    }
  });
  
  // Add event listeners for action buttons
  content.querySelector('.copy-btn').addEventListener('click', function() {
    try {
      const sectionContent = this.closest('.section-content').querySelector('ul').innerText;
      navigator.clipboard.writeText(sectionContent).then(() => {
        showToast('Copied to clipboard!');
        this.classList.add('copied');
        setTimeout(() => {
          this.classList.remove('copied');
        }, 1500);
      }).catch(err => {
        logError(`Could not copy text: ${err}`, 'clipboard-error');
        showToast('Could not copy to clipboard');
      });
    } catch (error) {
      logError(`Error during copy: ${error.message}`, 'copy-error');
      showToast('Error copying content');
    }
  });
  
  content.querySelector('.edit-btn').addEventListener('click', function() {
    openEditModal(sectionKey, section);
  });
  
  // Assemble section
  sectionElement.appendChild(header);
  sectionElement.appendChild(content);
  
  return sectionElement;
}

/**
 * Get appropriate icon for each section
 */
function getSectionIcon(sectionKey) {
  const icons = {
    medication: '💊',
    medication_management: '💊',
    lifestyle: '🥗',
    lifestyle_modifications: '🥗',
    monitoring: '📊',
    monitoring_protocol: '📊',
    emergency: '🚨',
    emergency_action_plan: '🚨',
    long_term: '📅',
    long_term_management_strategy: '📅',
    education: '📚',
    patient_education_resources: '📚',
    follow_up: '🔄',
    follow_up_schedule: '🔄',
    general: '📋'
  };
  
  return icons[sectionKey] || '📋';
}

/**
 * Highlight important medical keywords
 */
function highlightKeywords(text) {
  if (!text || typeof text !== 'string') {
    return text;
  }
  
  // List of important keywords to highlight
  const keywords = [
    'immediately', 'urgent', 'emergency', 'critical', 'severe', 
    'high risk', 'danger', 'caution', 'warning', 'priority',
    'essential', 'required', 'mandatory', 'necessary', 'crucial',
    'discontinue', 'stop', 'avoid', 'contraindicated', 'allergic',
    'daily', 'twice daily', 'weekly', 'monthly', 'annually'
  ];
  
  let highlightedText = text;
  
  keywords.forEach(keyword => {
    const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
    highlightedText = highlightedText.replace(regex, `<span class="highlight">$&</span>`);
  });
  
  return highlightedText;
}

/**
 * Initialize view toggle buttons
 */
function initViewToggleButtons() {
  try {
    // Concise view button
    const conciseBtn = document.getElementById('concise-view-btn');
    if (conciseBtn) {
      conciseBtn.addEventListener('click', function() {
        setActiveViewButton(this);
        setViewMode('concise');
      });
    }
    
    // Bullet view button
    const bulletBtn = document.getElementById('bullet-view-btn');
    if (bulletBtn) {
      bulletBtn.addEventListener('click', function() {
        setActiveViewButton(this);
        setViewMode('bullet');
      });
    }
    
    // Copy/Edit button
    const copyEditBtn = document.getElementById('copy-edit-btn');
    if (copyEditBtn) {
      copyEditBtn.addEventListener('click', function() {
        setActiveViewButton(this);
        setViewMode('edit');
      });
    }
  } catch (error) {
    logError(`Error initializing view toggle buttons: ${error.message}`, 'button-init-error');
  }
}

/**
 * Set active class on the selected view button
 */
function setActiveViewButton(button) {
  try {
    // Remove active class from all buttons
    document.querySelectorAll('.view-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    
    // Add active class to selected button
    button.classList.add('active');
  } catch (error) {
    logError(`Error setting active view button: ${error.message}`, 'button-activation-error');
  }
}

/**
 * Set the view mode for recommendations
 */
function setViewMode(mode) {
  try {
    const container = document.querySelector('.enhanced-recommendations');
    if (!container) return;
    
    currentViewMode = mode;
    
    // Remove all mode classes
    container.classList.remove('concise-mode', 'bullet-mode', 'edit-mode');
    
    // Add selected mode class
    container.classList.add(`${mode}-mode`);
    
    if (mode === 'concise') {
      // Show only section headers, collapse all sections
      expandedSections.clear();
      document.querySelectorAll('.section-content').forEach(content => {
        content.style.display = 'none';
        content.style.maxHeight = '0';
      });
      document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.classList.remove('expanded');
        btn.textContent = '+';
      });
    } else if (mode === 'bullet') {
      // Standard view, keep current expanded state
    } else if (mode === 'edit') {
      // Expand all sections for editing
      document.querySelectorAll('.section-content').forEach(content => {
        content.style.display = 'block';
        content.style.maxHeight = 'none';
      });
      document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.classList.add('expanded');
        btn.textContent = '−';
      });
      document.querySelectorAll('.recommendation-section').forEach(section => {
        expandedSections.add(section.dataset.section);
      });
    }
  } catch (error) {
    logError(`Error setting view mode to ${mode}: ${error.message}`, 'view-mode-error');
  }
}

/**
 * Open edit modal for a section
 */
function openEditModal(sectionKey, section) {
  try {
    // Check if modal already exists
    let modal = document.getElementById('recommendations-edit-modal');
    
    if (!modal) {
      // Create modal
      modal = document.createElement('div');
      modal.id = 'recommendations-edit-modal';
      modal.className = 'recommendations-modal';
      document.body.appendChild(modal);
    }
    
    // Create modal content
    let listItems;
    if (Array.isArray(section.items)) {
      listItems = section.items.map(item => {
        if (typeof item === 'string') {
          return item.replace(/^[-•]\s+/, '').trim();
        } else if (typeof item === 'object') {
          // Handle object items (like medications)
          try {
            return Object.entries(item)
              .map(([key, value]) => `${key}: ${value}`)
              .join(', ');
          } catch (e) {
            return 'Invalid item format';
          }
        }
        return '';
      }).join('\n');
    } else {
      listItems = 'No items available';
    }
    
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>Edit ${section.title}</h3>
          <button class="close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <p class="modal-instructions">Edit each recommendation on a new line. Changes will be applied when you save.</p>
          <textarea id="edit-recommendations-textarea">${listItems}</textarea>
        </div>
        <div class="modal-footer">
          <button id="cancel-edit-btn" class="secondary-btn">Cancel</button>
          <button id="apply-edit-btn" class="primary-btn">Apply Changes</button>
        </div>
      </div>
    `;
    
    // Show modal
    modal.style.display = 'block';
    
    // Add event listeners
    modal.querySelector('.close-btn').addEventListener('click', () => {
      modal.style.display = 'none';
    });
    
    modal.querySelector('#cancel-edit-btn').addEventListener('click', () => {
      modal.style.display = 'none';
    });
    
    modal.querySelector('#apply-edit-btn').addEventListener('click', () => {
      // Get edited content
      const editedItems = modal.querySelector('#edit-recommendations-textarea')
        .value
        .split('\n')
        .filter(item => item.trim().length > 0)
        .map(item => item.trim());
      
      // Update section
      updateSectionItems(sectionKey, editedItems);
      
      // Hide modal
      modal.style.display = 'none';
      
      // Show success message
      showToast('Recommendations updated successfully!');
    });
    
    // Allow clicking outside modal to close
    window.addEventListener('click', (event) => {
      if (event.target === modal) {
        modal.style.display = 'none';
      }
    });
    
    // Focus textarea
    setTimeout(() => {
      modal.querySelector('#edit-recommendations-textarea').focus();
    }, 100);
  } catch (error) {
    logError(`Error opening edit modal: ${error.message}`, 'modal-error');
    showToast('Error opening edit dialog');
  }
}

/**
 * Update section items after editing
 */
function updateSectionItems(sectionKey, items) {
  try {
    // Find section
    const sectionElement = document.querySelector(`.recommendation-section[data-section="${sectionKey}"]`);
    if (!sectionElement) return;
    
    // Update items list
    const itemsList = sectionElement.querySelector('ul');
    itemsList.innerHTML = '';
    
    items.forEach(item => {
      const listItem = document.createElement('li');
      // Highlight important keywords
      const highlightedText = highlightKeywords(item);
      listItem.innerHTML = highlightedText;
      itemsList.appendChild(listItem);
    });
    
    // Update item count
    const itemCount = sectionElement.querySelector('.item-count');
    itemCount.textContent = items.length;
  } catch (error) {
    logError(`Error updating section items: ${error.message}`, 'update-items-error');
  }
}

/**
 * Show a toast notification
 */
function showToast(message) {
  try {
    // Check if toast container exists
    let toastContainer = document.getElementById('toast-container');
    
    if (!toastContainer) {
      // Create toast container
      toastContainer = document.createElement('div');
      toastContainer.id = 'toast-container';
      document.body.appendChild(toastContainer);
    }
    
    // Create toast
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    
    // Add to container
    toastContainer.appendChild(toast);
    
    // Show toast
    setTimeout(() => {
      toast.classList.add('show');
    }, 10);
    
    // Remove toast after delay
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        if (toastContainer.contains(toast)) {
          toastContainer.removeChild(toast);
        }
      }, 300);
    }, 3000);
  } catch (error) {
    logError(`Error showing toast: ${error.message}`, 'toast-error');
    // No fallback for toast errors as they're not critical
  }
}

// Debug function to manually process recommendations data
function processRecommendationsData(recommendationsData) {
  try {
    console.log('Manual recommendations data processing initiated');
    const container = document.getElementById('insights-recommendations');
    if (!container) {
      console.error('Recommendations container not found');
      return false;
    }
    
    // Clear existing content
    container.innerHTML = '';
    
    // Process the data
    let recommendations;
    if (typeof recommendationsData === 'string') {
      // Try parsing if it's a JSON string
      try {
        recommendations = JSON.parse(recommendationsData);
      } catch (e) {
        // If not valid JSON, treat as plain text
        container.innerHTML = `<p>${recommendationsData}</p>`;
        return true;
      }
    } else {
      recommendations = recommendationsData;
    }
    
    // If it's an object, convert to our format
    if (typeof recommendations === 'object') {
      const structuredRecommendations = convertJSONToRecommendations(recommendations);
      if (structuredRecommendations && Object.keys(structuredRecommendations).length > 0) {
        renderEnhancedRecommendations(container, structuredRecommendations);
        initViewToggleButtons();
        return true;
      }
    }
    
    // Fallback if processing failed
    container.innerHTML = `<p>Unable to process recommendations data</p>`;
    return false;
  } catch (error) {
    console.error('Error in manual recommendations processing:', error);
    return false;
  }
}

// Add function to window object so it can be called from other scripts
window.initRecommendationsDisplay = initRecommendationsDisplay;
window.processRecommendationsData = processRecommendationsData;
