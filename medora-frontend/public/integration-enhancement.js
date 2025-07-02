// Modern UI Integration Enhancement
// This file enhances your existing patient management system with the new UI

(function() {
    console.log('🎨 Modern UI Integration Enhancement loading...');

    // Wait for DOM to be ready
    function initializeModernUI() {
        // Enhance patient selection to work with new UI
        enhancePatientSelection();
        
        // Setup analysis tab management
        setupAnalysisTabManagement();
        
        // Setup SOAP section toggling
        setupSoapSectionHandlers();
        
        // Monitor for patient list updates
        monitorPatientListUpdates();
        
        console.log('✅ Modern UI Integration Enhancement ready');
    }

    function enhancePatientSelection() {
        // Override or enhance the existing showPatientDetails function
        const originalShowPatientDetails = window.showPatientDetails;
        
        window.showPatientDetails = function(patient) {
            console.log('🔄 Enhanced patient selection:', patient);
            
            // Hide no-patient state and show patient details
            const noPatientState = document.getElementById('no-patient-state');
            const patientDetails = document.getElementById('patient-details');
            
            if (noPatientState) {
                noPatientState.style.display = 'none';
            }
            
            if (patientDetails) {
                patientDetails.style.display = 'block';
            }
            
            // Reset analysis tabs to default state
            resetAnalysisTabs();
            
            // Call the original function if it exists
            if (originalShowPatientDetails && typeof originalShowPatientDetails === 'function') {
                try {
                    originalShowPatientDetails(patient);
                } catch (error) {
                    console.warn('Error calling original showPatientDetails:', error);
                }
            }
            
            // Update patient info in the new UI
            updatePatientHeaderInfo(patient);
        };

        // Also enhance the patient list click handlers
        const originalLoadPatientDetails = window.loadPatientDetails;
        
        window.loadPatientDetails = function(patient) {
            console.log('🔄 Enhanced load patient details:', patient);
            
            // Call original function first
            if (originalLoadPatientDetails && typeof originalLoadPatientDetails === 'function') {
                originalLoadPatientDetails(patient);
            }
            
            // Then apply modern UI enhancements
            setTimeout(() => {
                window.showPatientDetails(patient);
            }, 100);
        };
    }

    function resetAnalysisTabs() {
        // Reset all analysis tabs to inactive state
        document.querySelectorAll('.analysis-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        
        // Hide all tab content
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });
        
        // Show default analysis state
        const defaultAnalysis = document.getElementById('default-analysis');
        if (defaultAnalysis) {
            defaultAnalysis.classList.add('active');
        }
        
        console.log('🔄 Analysis tabs reset to default state');
    }

    function updatePatientHeaderInfo(patient) {
        // Update patient name
        const nameElement = document.getElementById('patient-details-name');
        if (nameElement && patient.name) {
            nameElement.textContent = patient.name;
        }
        
        // Update MRN
        const mrnElement = document.getElementById('patient-details-mrn');
        if (mrnElement && patient.mrn) {
            mrnElement.textContent = patient.mrn;
        }
        
        // Update last visit
        const lastVisitElement = document.getElementById('patient-details-last-visit');
        if (lastVisitElement && patient.lastVisit) {
            lastVisitElement.textContent = patient.lastVisit;
        }
        
        // Update current visit
        const currentVisitElement = document.getElementById('patient-details-current-visit');
        if (currentVisitElement && patient.currentVisit) {
            currentVisitElement.textContent = patient.currentVisit;
        }
        
        console.log('🔄 Patient header info updated');
    }

    function setupAnalysisTabManagement() {
        // Ensure switchAnalysisTab function is available globally
        window.switchAnalysisTab = function(tabName) {
            console.log('🔄 Switching to analysis tab:', tabName);
            
            // Hide all tab contents including default state
            document.querySelectorAll('.tab-content').forEach(tab => {
                tab.classList.remove('active');
            });
            
            // Remove active class from all tabs
            document.querySelectorAll('.analysis-tab').forEach(tab => {
                tab.classList.remove('active');
            });
            
            // Show selected tab content
            const targetTab = document.getElementById(tabName + '-tab');
            if (targetTab) {
                targetTab.classList.add('active');
            }
            
            // Add active class to clicked tab
            const clickedTab = document.querySelector(`[data-tab="${tabName}"]`);
            if (clickedTab) {
                clickedTab.classList.add('active');
            }
            
            // Special handling for specific tabs
            if (tabName === 'allergeniq') {
                // Trigger AllergenIQ data refresh if available
                if (window.currentPatientId && window.currentVisitId && typeof updateProfileWithVisitId === 'function') {
                    updateProfileWithVisitId(window.currentPatientId, window.currentVisitId, false);
                }
            }
            
            console.log('✅ Analysis tab switched to:', tabName);
        };
    }

    function setupSoapSectionHandlers() {
        // Ensure toggleSoapSection function works with new styling
        window.toggleSoapSection = function(header) {
            const content = header.nextElementSibling;
            const chevron = header.querySelector('.chevron');
            
            if (!content || !chevron) {
                console.warn('SOAP section elements not found');
                return;
            }
            
            content.classList.toggle('collapsed');
            chevron.classList.toggle('rotated');
            
            if (content.classList.contains('collapsed')) {
                chevron.textContent = '▶';
            } else {
                chevron.textContent = '▼';
            }
            
            console.log('🔄 SOAP section toggled');
        };

        // Add expand/collapse all functionality
        window.expandAllSoapSections = function() {
            document.querySelectorAll('.soap-content').forEach(content => {
                content.classList.remove('collapsed');
            });
            document.querySelectorAll('.soap-header .chevron').forEach(chevron => {
                chevron.textContent = '▼';
                chevron.classList.remove('rotated');
            });
            console.log('🔄 All SOAP sections expanded');
        };

        window.collapseAllSoapSections = function() {
            document.querySelectorAll('.soap-content').forEach(content => {
                content.classList.add('collapsed');
            });
            document.querySelectorAll('.soap-header .chevron').forEach(chevron => {
                chevron.textContent = '▶';
                chevron.classList.add('rotated');
            });
            console.log('🔄 All SOAP sections collapsed');
        };
    }

    function monitorPatientListUpdates() {
        // Monitor for changes to the patient list and apply modern styling
        const patientList = document.getElementById('patient-list');
        if (patientList) {
            const observer = new MutationObserver(function(mutations) {
                mutations.forEach(function(mutation) {
                    if (mutation.type === 'childList') {
                        // Apply modern styling to new patient items
                        mutation.addedNodes.forEach(function(node) {
                            if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains('patient-item')) {
                                applyModernPatientItemStyling(node);
                            }
                        });
                    }
                });
            });
            
            observer.observe(patientList, {
                childList: true,
                subtree: true
            });
        }
    }

    function applyModernPatientItemStyling(patientItem) {
        // Ensure patient items have proper modern styling classes
        if (!patientItem.classList.contains('modern-patient-item')) {
            patientItem.classList.add('modern-patient-item');
        }
        
        // Add hover effects and other modern behaviors
        patientItem.addEventListener('mouseenter', function() {
            this.style.transform = 'translateX(4px)';
        });
        
        patientItem.addEventListener('mouseleave', function() {
            if (!this.classList.contains('active')) {
                this.style.transform = '';
            }
        });
    }

    // Back to patient list functionality
    function setupBackToPatientList() {
        const backBtn = document.getElementById('back-to-patient-list-btn');
        if (backBtn) {
            backBtn.addEventListener('click', function() {
                // Hide patient details and show no-patient state
                const patientDetails = document.getElementById('patient-details');
                const noPatientState = document.getElementById('no-patient-state');
                
                if (patientDetails) {
                    patientDetails.style.display = 'none';
                }
                
                if (noPatientState) {
                    noPatientState.style.display = 'flex';
                }
                
                // Remove active state from all patient items
                document.querySelectorAll('#patient-list .patient-item').forEach(item => {
                    item.classList.remove('active');
                });
                
                console.log('🔄 Returned to patient list view');
            });
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(initializeModernUI, 100);
            setupBackToPatientList();
        });
    } else {
        setTimeout(initializeModernUI, 100);
        setupBackToPatientList();
    }

    // Also initialize when the script loads (fallback)
    setTimeout(function() {
        if (typeof window.showPatientDetails === 'undefined') {
            initializeModernUI();
        }
        setupBackToPatientList();
    }, 500);

    console.log('🎨 Modern UI Integration Enhancement script loaded');
})();
