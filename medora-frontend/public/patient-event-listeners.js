console.log('patient-event-listeners.js loaded');

// Ensure references spinner is hidden on initial page load and set up event listeners
window.addEventListener('load', () => {
    console.log('Setting up event listeners for patient-event-listeners.js...');
    window.hideReferencesSpinner();

    // Set up event listener for the section select dropdown in the modal
    const sectionSelect = document.getElementById('separate-section-select');
    if (sectionSelect) {
        sectionSelect.addEventListener('change', window.loadSectionContent);
    } else {
        console.warn('Separate section select element not found on window load');
    }

    // Set up event listeners for the Apply, Cancel, and Save buttons in the modal
    const applyBtn = document.getElementById('separate-apply-btn');
    const cancelBtn = document.getElementById('separate-cancel-btn');
    const saveBtn = document.getElementById('separate-save-btn');

    if (applyBtn) {
        applyBtn.addEventListener('click', window.applySeparateEdits);
    } else {
        console.warn('Apply button not found in separate modal');
    }

    if (cancelBtn) {
        cancelBtn.addEventListener('click', window.closeSeparateModal);
    } else {
        console.warn('Cancel button not found in separate modal');
    }

    if (saveBtn) {
        saveBtn.addEventListener('click', window.applySeparateEdits); // Same behavior as Apply for now
    } else {
        console.warn('Save button not found in separate modal');
    }

    // Set up event listeners for buttons in the DOM
    const backToPatientListBtn = document.getElementById('back-to-patient-list-btn');
    if (backToPatientListBtn) {
        backToPatientListBtn.addEventListener('click', () => window.showPatientList());
    } else {
        console.warn('Back to Patient List button not found');
    }

    const copySoapBtn = document.getElementById('copy-soap-btn');
    if (copySoapBtn) {
        copySoapBtn.addEventListener('click', window.copySOAP);
    } else {
        console.warn('Copy All SOAP Notes button not found');
    }

    const insightsCopyEditBtn = document.getElementById('insights-copy-edit-btn');
    if (insightsCopyEditBtn) {
        insightsCopyEditBtn.addEventListener('click', () => window.copySection('insights'));
    } else {
        console.warn('Insights Copy/Edit button not found');
    }

    // Set up event listeners for copy and edit buttons in SOAP sections
    const copySectionBtns = document.querySelectorAll('.copy-section-btn');
    copySectionBtns.forEach(btn => {
        const section = btn.getAttribute('data-section');
        btn.addEventListener('click', () => window.copySection(section));
    });

    const editSectionBtns = document.querySelectorAll('.edit-section-btn');
    editSectionBtns.forEach(btn => {
        const section = btn.getAttribute('data-section');
        btn.addEventListener('click', () => window.editSection(section));
    });
});
