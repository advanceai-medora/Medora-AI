console.log('patient-spinner.js loaded');

// Minimum display time for loading indicators (in milliseconds)
const MIN_SPINNER_DISPLAY_TIME = 1000;

// Timeout for references spinner (in milliseconds)
const REFERENCES_SPINNER_TIMEOUT = 5000; // 5 seconds

// Track loading start times to enforce minimum display duration
let spinnerStartTimes = {
    patientList: 0,
    content: 0,
    transcript: 0,
    references: 0
};

// Track timeout for references spinner
let referencesSpinnerTimeout = null;

// Show faint "Loading..." text for patient list
function showSpinner() {
    console.log('Showing loading text for patient list...');
    const patientList = document.getElementById('patient-list');

    if (patientList) {
        // Record start time for minimum display duration
        spinnerStartTimes.patientList = Date.now();

        // Clear existing content to prevent overlap
        patientList.innerHTML = '';

        // Create a faint "Loading..." text overlay
        let loadingText = document.getElementById('patient-list-loading-text');
        if (!loadingText) {
            loadingText = document.createElement('div');
            loadingText.id = 'patient-list-loading-text';
            loadingText.className = 'patient-list-loading-text';
            loadingText.innerText = 'Loading...';
            patientList.appendChild(loadingText);
        }

        // Fade-in the loading text
        loadingText.style.opacity = '0';
        loadingText.style.display = 'block';
        loadingText.setAttribute('aria-busy', 'true'); // Accessibility
        loadingText.setAttribute('aria-label', 'Loading patient list');
        loadingText.style.transition = 'opacity 0.3s ease';
        setTimeout(() => {
            loadingText.style.opacity = '1';
        }, 50);
    } else {
        console.error('Patient list element not found');
    }
}

// Hide faint "Loading..." text for patient list with minimum display time
function hideSpinner() {
    console.log('Hiding loading text for patient list...');
    const loadingText = document.getElementById('patient-list-loading-text');

    if (loadingText) {
        const elapsedTime = Date.now() - spinnerStartTimes.patientList;
        const remainingTime = Math.max(0, MIN_SPINNER_DISPLAY_TIME - elapsedTime);

        setTimeout(() => {
            // Fade-out the loading text
            loadingText.style.transition = 'opacity 0.3s ease';
            loadingText.style.opacity = '0';
            setTimeout(() => {
                loadingText.style.display = 'none';
                loadingText.setAttribute('aria-busy', 'false'); // Accessibility
                // Remove the element to clean up DOM
                if (loadingText.parentNode) {
                    loadingText.parentNode.removeChild(loadingText);
                }
            }, 300);
        }, remainingTime);
    } else {
        console.warn('Patient list loading text not found; may have been removed or not initialized');
    }
}

// Show faint "Loading..." text and skeleton UI for patient switch
function showContentSpinner() {
    console.log('Showing content loading text...');
    const mainContent = document.getElementById('main-content');

    if (mainContent) {
        // Record start time
        spinnerStartTimes.content = Date.now();

        // Create a faint "Loading..." text overlay
        let loadingText = document.getElementById('content-loading-text');
        if (!loadingText) {
            loadingText = document.createElement('div');
            loadingText.id = 'content-loading-text';
            loadingText.className = 'content-loading-text';
            loadingText.innerText = 'Loading...';
            mainContent.appendChild(loadingText);
        }

        // Fade-in the loading text
        loadingText.style.opacity = '0';
        loadingText.style.display = 'block';
        loadingText.setAttribute('aria-busy', 'true'); // Accessibility
        loadingText.setAttribute('aria-label', 'Loading patient details');
        loadingText.style.transition = 'opacity 0.3s ease';
        setTimeout(() => {
            loadingText.style.opacity = '1';
        }, 50);
    } else {
        console.error('Main content area not found');
    }

    // Enhanced skeleton UI for SOAP sections with more realistic placeholders
    const soapSections = document.querySelectorAll('.soap-section .content');
    soapSections.forEach(section => {
        section.classList.add('skeleton');
        section.setAttribute('aria-hidden', 'true'); // Accessibility: Hide skeleton from screen readers
        section.innerHTML = `
            <p style="width: 100%; height: 14px; margin-bottom: 8px;"></p>
            <p style="width: 80%; height: 14px; margin-bottom: 8px;"></p>
            <p style="width: 90%; height: 14px;"></p>
        `;
    });

    // Enhanced skeleton UI for Insights sections
    const insightSections = document.querySelectorAll('.insights-section .content');
    insightSections.forEach(section => {
        section.classList.add('skeleton');
        section.setAttribute('aria-hidden', 'true'); // Accessibility
        section.innerHTML = `
            <p style="width: 100%; height: 14px; margin-bottom: 8px;"></p>
            <p style="width: 80%; height: 14px;"></p>
        `;
    });
}

// Hide faint "Loading..." text and remove skeleton UI with minimum display time
function hideContentSpinner() {
    console.log('Hiding content loading text...');
    const loadingText = document.getElementById('content-loading-text');

    if (loadingText) {
        const elapsedTime = Date.now() - spinnerStartTimes.content;
        const remainingTime = Math.max(0, MIN_SPINNER_DISPLAY_TIME - elapsedTime);

        setTimeout(() => {
            // Fade-out the loading text
            loadingText.style.transition = 'opacity 0.3s ease';
            loadingText.style.opacity = '0';
            setTimeout(() => {
                loadingText.style.display = 'none';
                loadingText.setAttribute('aria-busy', 'false'); // Accessibility
                // Remove the element to clean up DOM
                if (loadingText.parentNode) {
                    loadingText.parentNode.removeChild(loadingText);
                }
            }, 300);
        }, remainingTime);
    } else {
        console.warn('Content loading text not found; may have been removed or not initialized');
    }

    // Remove skeleton UI with a slight delay for smooth transition
    const soapSections = document.querySelectorAll('.soap-section .content');
    soapSections.forEach(section => {
        section.classList.remove('skeleton');
        section.removeAttribute('aria-hidden'); // Accessibility: Make content accessible again
    });

    const insightSections = document.querySelectorAll('.insights-section .content');
    insightSections.forEach(section => {
        section.classList.remove('skeleton');
        section.removeAttribute('aria-hidden'); // Accessibility
    });
}

// Show transcript spinner with fade-in effect
function showTranscriptSpinner() {
    console.log('Showing transcript spinner...');
    const submitBtn = document.getElementById('submit-transcript-btn');

    if (submitBtn) {
        // Record start time
        spinnerStartTimes.transcript = Date.now();

        // Create spinner element if not already present
        let spinnerElement = document.getElementById('transcript-spinner');
        if (!spinnerElement) {
            spinnerElement = document.createElement('span');
            spinnerElement.id = 'transcript-spinner';
            spinnerElement.className = 'spinner';
            submitBtn.appendChild(spinnerElement);
        }

        // Fade-in spinner
        spinnerElement.style.opacity = '0';
        spinnerElement.style.display = 'inline-block';
        spinnerElement.setAttribute('aria-busy', 'true'); // Accessibility
        spinnerElement.setAttribute('aria-label', 'Submitting transcript');
        spinnerElement.style.transition = 'opacity 0.3s ease';
        setTimeout(() => {
            spinnerElement.style.opacity = '1';
        }, 50);

        // Disable button
        submitBtn.disabled = true;
        submitBtn.classList.add('disabled');
    } else {
        console.error('Submit Transcript button not found');
    }
}

// Hide transcript spinner with fade-out effect and minimum display time
function hideTranscriptSpinner() {
    console.log('Hiding transcript spinner...');
    const spinner = document.getElementById('transcript-spinner');
    const submitBtn = document.getElementById('submit-transcript-btn');

    if (spinner && submitBtn) {
        const elapsedTime = Date.now() - spinnerStartTimes.transcript;
        const remainingTime = Math.max(0, MIN_SPINNER_DISPLAY_TIME - elapsedTime);

        setTimeout(() => {
            // Fade-out spinner
            spinner.style.transition = 'opacity 0.3s ease';
            spinner.style.opacity = '0';
            setTimeout(() => {
                spinner.style.display = 'none';
                spinner.setAttribute('aria-busy', 'false'); // Accessibility
                // Remove spinner element to clean up DOM
                if (spinner.parentNode) {
                    spinner.parentNode.removeChild(spinner);
                }
            }, 300);

            // Enable button
            submitBtn.disabled = false;
            submitBtn.classList.remove('disabled');
        }, remainingTime);
    } else {
        console.error('Transcript spinner or submit button not found', {
            spinner: !!spinner,
            submitBtn: !!submitBtn
        });
    }
}

// Show references spinner and enhanced skeleton UI with fade-in effect
function showReferencesSpinner() {
    console.log('Showing references spinner...');
    const referencesSpinner = document.getElementById('references-spinner');
    const referencesTable = document.getElementById('references-table');

    if (referencesSpinner && referencesTable) {
        // Record start time
        spinnerStartTimes.references = Date.now();

        // Fade-in spinner
        referencesSpinner.style.opacity = '0';
        referencesSpinner.style.display = 'block';
        referencesSpinner.setAttribute('aria-busy', 'true'); // Accessibility
        referencesSpinner.setAttribute('aria-label', 'Loading references');
        referencesSpinner.style.transition = 'opacity 0.3s ease';
        setTimeout(() => {
            referencesSpinner.style.opacity = '1';
        }, 50);

        // Enhanced skeleton UI for references table
        referencesTable.classList.add('skeleton');
        const tableBody = document.getElementById('references-table-body');
        if (tableBody) {
            tableBody.setAttribute('aria-hidden', 'true'); // Accessibility
            tableBody.innerHTML = `
                <tr>
                    <td style="height: 20px;"></td>
                    <td style="height: 20px;"></td>
                    <td style="height: 20px;"></td>
                    <td style="height: 20px;"></td>
                    <td style="height: 20px;"></td>
                </tr>
                <tr>
                    <td style="height: 20px;"></td>
                    <td style="height: 20px;"></td>
                    <td style="height: 20px;"></td>
                    <td style="height: 20px;"></td>
                    <td style="height: 20px;"></td>
                </tr>
                <tr>
                    <td style="height: 20px;"></td>
                    <td style="height: 20px;"></td>
                    <td style="height: 20px;"></td>
                    <td style="height: 20px;"></td>
                    <td style="height: 20px;"></td>
                </tr>
            `;
        } else {
            console.error('References table body not found');
        }

        // Set a timeout to hide the spinner if fetchReferences doesn't complete
        if (referencesSpinnerTimeout) {
            clearTimeout(referencesSpinnerTimeout);
        }
        referencesSpinnerTimeout = setTimeout(() => {
            console.warn('References spinner timeout reached, hiding spinner...');
            hideReferencesSpinner();
        }, REFERENCES_SPINNER_TIMEOUT);
    } else {
        console.error('References spinner or table not found', {
            referencesSpinner: !!referencesSpinner,
            referencesTable: !!referencesTable
        });
    }
}

// Hide references spinner and remove skeleton UI with minimum display time and fade-out effect
function hideReferencesSpinner() {
    console.log('Hiding references spinner...');
    const referencesSpinner = document.getElementById('references-spinner');
    const referencesTable = document.getElementById('references-table');

    // Clear the timeout since we're hiding the spinner
    if (referencesSpinnerTimeout) {
        clearTimeout(referencesSpinnerTimeout);
        referencesSpinnerTimeout = null;
    }

    if (referencesSpinner && referencesTable) {
        const elapsedTime = Date.now() - spinnerStartTimes.references;
        const remainingTime = Math.max(0, MIN_SPINNER_DISPLAY_TIME - elapsedTime);

        setTimeout(() => {
            // Fade-out spinner
            referencesSpinner.style.transition = 'opacity 0.3s ease';
            referencesSpinner.style.opacity = '0';
            setTimeout(() => {
                referencesSpinner.style.display = 'none';
                referencesSpinner.setAttribute('aria-busy', 'false'); // Accessibility
            }, 300);

            // Remove skeleton UI
            referencesTable.classList.remove('skeleton');
            const tableBody = document.getElementById('references-table-body');
            if (tableBody) {
                tableBody.removeAttribute('aria-hidden'); // Accessibility
            }
        }, remainingTime);
    } else {
        console.error('References spinner or table not found', {
            referencesSpinner: !!referencesSpinner,
            referencesTable: !!referencesTable
        });
    }
}

// Expose spinner functions to the global scope
window.showSpinner = showSpinner;
window.hideSpinner = hideSpinner;
window.showContentSpinner = showContentSpinner;
window.hideContentSpinner = hideContentSpinner;
window.showTranscriptSpinner = showTranscriptSpinner;
window.hideTranscriptSpinner = hideTranscriptSpinner;
window.showReferencesSpinner = showReferencesSpinner;
window.hideReferencesSpinner = hideReferencesSpinner;
