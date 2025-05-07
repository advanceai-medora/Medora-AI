/**
 * Enhanced Medical Recommendations Component
 * 
 * This script provides an improved display for medical recommendations
 * with collapsible sections, visual indicators, and improved provider experience.
 */

// Global variables for tracking state
let expandedSections = new Set(['medication']); // Default expanded section
let currentViewMode = 'bullet'; // Default view mode

// Initialize component when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  initRecommendationsDisplay();
});

/**
 * Initialize the recommendations display component
 */
function initRecommendationsDisplay() {
  const container = document.getElementById('insights-recommendations');
  if (!container) {
    console.error('Recommendations container not found');
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
}

/**
 * Extract recommendations from the current HTML content
 */
function extractRecommendationsFromContent(container) {
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
  
  // If no structured format found, try to parse from list items
  const listItems = container.querySelectorAll('li');
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
}

/**
 * Extract recommendations from the current layout with section headings and pills
 */
function extractFromCurrentLayout(container) {
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
  
  // If still no recommendations found, use default structure
  if (Object.keys(recommendations).length === 0) {
    return null;
  }
  
  return recommendations;
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
    const listItem = document.createElement('li');
    // Check if the item starts with a dash or bullet and remove it
    let cleanedItem = item.replace(/^[-•]\s+/, '').trim();
    
    // Highlight important keywords
    cleanedItem = highlightKeywords(cleanedItem);
    
    listItem.innerHTML = cleanedItem;
    itemsList.appendChild(listItem);
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
    const sectionContent = this.closest('.section-content').querySelector('ul').innerText;
    navigator.clipboard.writeText(sectionContent).then(() => {
      showToast('Copied to clipboard!');
      this.classList.add('copied');
      setTimeout(() => {
        this.classList.remove('copied');
      }, 1500);
    }).catch(err => {
      console.error('Could not copy text: ', err);
    });
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
  // Concise view button
  document.getElementById('concise-view-btn')?.addEventListener('click', function() {
    setActiveViewButton(this);
    setViewMode('concise');
  });
  
  // Bullet view button
  document.getElementById('bullet-view-btn')?.addEventListener('click', function() {
    setActiveViewButton(this);
    setViewMode('bullet');
  });
  
  // Copy/Edit button
  document.getElementById('copy-edit-btn')?.addEventListener('click', function() {
    setActiveViewButton(this);
    setViewMode('edit');
  });
}

/**
 * Set active class on the selected view button
 */
function setActiveViewButton(button) {
  // Remove active class from all buttons
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  
  // Add active class to selected button
  button.classList.add('active');
}

/**
 * Set the view mode for recommendations
 */
function setViewMode(mode) {
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
}

/**
 * Open edit modal for a section
 */
function openEditModal(sectionKey, section) {
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
  const listItems = section.items.map(item => {
    return item.replace(/^[-•]\s+/, '').trim();
  }).join('\n');
  
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
}

/**
 * Update section items after editing
 */
function updateSectionItems(sectionKey, items) {
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
}

/**
 * Show a toast notification
 */
function showToast(message) {
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
      toastContainer.removeChild(toast);
    }, 300);
  }, 3000);
}

// Add function to window object so it can be called from other scripts
window.initRecommendationsDisplay = initRecommendationsDisplay;
