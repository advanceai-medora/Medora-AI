try {
    console.log('script-transcript.js loaded');

    let recognition = null;
    let isRecognizing = false;
    let finalTranscript = '';

    function startSpeechRecognition() {
        console.log('Starting speech recognition...');
        if ('webkitSpeechRecognition' in window) {
            recognition = new webkitSpeechRecognition();
        } else if ('SpeechRecognition' in window) {
            recognition = new SpeechRecognition();
        } else {
            console.error('Speech recognition not supported in this browser');
            alert('Speech recognition is not supported in your browser. Please use a compatible browser like Chrome.');
            return;
        }

        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US'; // Default language

        recognition.onstart = () => {
            console.log('Speech recognition started');
            isRecognizing = true;
            const startListeningBtn = document.getElementById('start-listening-btn');
            const stopListeningBtn = document.getElementById('stop-listening-btn');
            if (startListeningBtn && stopListeningBtn) {
                startListeningBtn.classList.add('hidden');
                stopListeningBtn.classList.remove('hidden');
                stopListeningBtn.classList.remove('disabled');
                stopListeningBtn.disabled = false;
                stopListeningBtn.classList.add('blink-red');
                stopListeningBtn.style.pointerEvents = 'auto';
                stopListeningBtn.style.opacity = '1';
                stopListeningBtn.style.animation = 'none';
                void stopListeningBtn.offsetWidth;
                stopListeningBtn.style.animation = 'blink-animation 1s infinite';
                console.log('Switched to Stop Listening button with blink-red class', stopListeningBtn.classList.toString(), {
                    disabled: stopListeningBtn.disabled,
                    pointerEvents: stopListeningBtn.style.pointerEvents,
                    opacity: stopListeningBtn.style.opacity,
                    hasBlinkRed: stopListeningBtn.classList.contains('blink-red')
                });
            } else {
                console.error('Start or Stop Listening button not found', { startListeningBtn, stopListeningBtn });
            }
        };

        recognition.onresult = (event) => {
            console.log('Speech recognition result received');
            let interimTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript + ' ';
                } else {
                    interimTranscript += transcript;
                }
            }
            const transcriptInput = document.getElementById('transcript-input');
            if (transcriptInput) {
                transcriptInput.value = finalTranscript + interimTranscript;
                console.log('Updated transcript input:', transcriptInput.value);
            } else {
                console.error('Transcript input not found during onresult');
            }
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            if (event.error === 'no-speech') {
                alert('No speech detected. Please try again.');
            } else if (event.error === 'audio-capture') {
                alert('Microphone not detected. Please ensure your microphone is connected and try again.');
            } else {
                alert('Speech recognition error: ' + event.error);
            }
            stopSpeechRecognition();
        };

        recognition.onend = () => {
            console.log('Speech recognition ended');
            isRecognizing = false;
            const startListeningBtn = document.getElementById('start-listening-btn');
            const stopListeningBtn = document.getElementById('stop-listening-btn');
            if (startListeningBtn && stopListeningBtn) {
                startListeningBtn.classList.remove('hidden');
                stopListeningBtn.classList.add('hidden');
                stopListeningBtn.classList.remove('blink-red');
                stopListeningBtn.classList.add('disabled');
                stopListeningBtn.disabled = true;
                console.log('Switched back to Start Listening button', startListeningBtn.classList.toString());
            } else {
                console.error('Start or Stop Listening button not found', { startListeningBtn, stopListeningBtn });
            }
        };

        recognition.start();
    }

    function stopSpeechRecognition() {
        console.log('Stopping speech recognition...');
        if (recognition && isRecognizing) {
            recognition.stop();
            isRecognizing = false;
            const startListeningBtn = document.getElementById('start-listening-btn');
            const stopListeningBtn = document.getElementById('stop-listening-btn');
            if (startListeningBtn && stopListeningBtn) {
                startListeningBtn.classList.remove('hidden');
                stopListeningBtn.classList.add('hidden');
                stopListeningBtn.classList.remove('blink-red');
                stopListeningBtn.classList.add('disabled');
                stopListeningBtn.disabled = true;
                console.log('Speech recognition stopped, switched to Start Listening button', startListeningBtn.classList.toString());
            } else {
                console.error('Start or Stop Listening button not found', { startListeningBtn, stopListeningBtn });
            }
        } else {
            console.log('No active speech recognition to stop');
        }
    }

    function submitTranscript() {
        console.log('Submitting transcript...');
        // Stop speech recognition before submitting
        stopSpeechRecognition();

        const transcriptInput = document.getElementById('transcript-input');
        const submitTranscriptBtn = document.getElementById('submit-transcript-btn');
        const transcriptSpinner = document.getElementById('transcript-spinner');
        
        if (transcriptInput && submitTranscriptBtn && transcriptSpinner) {
            const transcriptText = transcriptInput.value.trim() || finalTranscript;
            
            if (!transcriptText) {
                console.log('No transcript to submit');
                alert('No transcript to submit. Please enter or dictate a transcript.');
                return;
            }
            
            if (!currentPatientId) {
                console.error('No patient selected for transcript submission');
                alert('Please select a patient before submitting a transcript.');
                return;
            }
            
            if (!activeVisitId) {
                console.error('No active visit for transcript submission');
                alert('Please start a visit before submitting a transcript.');
                return;
            }
            
            // Ensure tenantID is set to email for DynamoDB GSI compatibility
            if (typeof currentTenantId === 'undefined' || currentTenantId === null) {
                if (typeof currentEmail !== 'undefined' && currentEmail !== null) {
                    currentTenantId = currentEmail;
                    console.log('Setting tenantID to email for transcript submission:', currentTenantId);
                } else {
                    alert('User email is not defined. Please ensure you are logged in.');
                    return;
                }
            } else if (currentTenantId !== currentEmail && currentEmail !== null) {
                console.warn('TenantID doesn\'t match email, updating for transcript submission:', {
                    oldTenantId: currentTenantId,
                    newTenantId: currentEmail
                });
                currentTenantId = currentEmail;
            }

            // Print critical validation info
            console.log("CRITICAL - Values before transcript submission:", {
                currentEmail,
                currentTenantId,
                currentPatientId,
                activeVisitId
            });
            
            // Add a DOM-based feedback mechanism
            const feedbackDiv = document.createElement('div');
            feedbackDiv.className = 'transcript-feedback';
            feedbackDiv.style.color = 'green';
            feedbackDiv.style.marginTop = '10px';
            feedbackDiv.style.display = 'block';
            feedbackDiv.style.fontSize = '14px';
            feedbackDiv.style.textAlign = 'center';
            feedbackDiv.innerText = 'Transcript submitted successfully!';
            console.log('Adding feedback div to DOM...');
            transcriptInput.parentNode.appendChild(feedbackDiv);
            console.log('Feedback div added:', feedbackDiv);
            setTimeout(() => {
                console.log('Removing feedback div...');
                if (feedbackDiv.parentNode) {
                    feedbackDiv.parentNode.removeChild(feedbackDiv);
                }
            }, 3000);

            // Show spinner and disable button
            submitTranscriptBtn.disabled = true;
            submitTranscriptBtn.classList.add('disabled');
            submitTranscriptBtn.classList.remove('blink');
            transcriptSpinner.classList.remove('hidden');
            transcriptSpinner.style.display = 'inline-block';
            console.log('Showing spinner during submission, spinner display:', transcriptSpinner.style.display);

            // FIXED: Use the correct data format for the Freed-style endpoint
            const transcriptData = {
                transcript: transcriptText,
                patientId: currentPatientId,
                visitId: activeVisitId,
                email: currentEmail,
                tenantId: currentEmail
            };
            
            // Log the exact request for debugging
            console.log('Submitting transcript with data:', {
                patientId: transcriptData.patientId,
                visitId: transcriptData.visitId,
                tenantId: transcriptData.tenantId,
                email: transcriptData.email,
                transcriptLength: transcriptData.transcript.length
            });

            // FIXED: Use the correct endpoint that exists in your backend
            fetch('/api/analyze-transcript-freed', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(transcriptData)
            })
            .then(response => {
                if (!response.ok) {
                    return response.text().then(text => {
                        throw new Error(`HTTP error! Status: ${response.status}, Response: ${text}`);
                    });
                }
                return response.json();
            })
            .then(data => {
                console.log('Transcript successfully submitted to backend:', data);
                
                // Check if the backend returned 'default_tenant' value
                const responseTenantId = data.tenant_id || data.tenantId;
                if (responseTenantId === 'default_tenant') {
                    console.warn('BACKEND ISSUE: Server still using default_tenant despite sending email! The backend validate_tenant_id() function may need fixing.');
                }
                
                // Refresh SOAP notes by re-selecting the patient
                if (typeof window.selectPatient === 'function' && currentPatient) {
                    console.log('Re-selecting patient to update SOAP notes:', currentPatient);
                    window.selectPatient(currentPatient);
                } else {
                    console.error('Cannot update SOAP notes: selectPatient function or currentPatient not available');
                }
            })
            .catch(error => {
                console.error('Error submitting transcript to backend:', error);
                alert('Error submitting transcript: ' + error.message);
            })
            .finally(() => {
                // Hide spinner and re-enable button
                submitTranscriptBtn.disabled = false;
                submitTranscriptBtn.classList.remove('disabled');
                submitTranscriptBtn.classList.remove('blink');
                transcriptSpinner.classList.add('hidden');
                transcriptSpinner.style.display = 'none';
                console.log('Hiding spinner after submission, spinner display:', transcriptSpinner.style.display);
            });
        } else {
            console.error('Transcript input, submit button, or spinner element not found', { transcriptInput, submitTranscriptBtn, transcriptSpinner });
            alert('Error: Transcript input field or submit button not found.');
        }
    }

    // Function to reset the transcript state
    function resetTranscript() {
        console.log('resetTranscript called');
        finalTranscript = '';
        console.log('finalTranscript cleared:', finalTranscript);
        const transcriptInput = document.getElementById('transcript-input');
        if (transcriptInput) {
            transcriptInput.value = '';
            console.log('Transcript input cleared via resetTranscript, current value:', transcriptInput.value);
        } else {
            console.error('Transcript input not found in resetTranscript');
        }
        if (recognition && isRecognizing) {
            recognition.stop();
            isRecognizing = false;
            console.log('Stopped active speech recognition');
        } else {
            console.log('No active speech recognition to stop in resetTranscript');
        }
    }

    // Expose functions to the global scope
    window.startSpeechRecognition = startSpeechRecognition;
    window.stopSpeechRecognition = stopSpeechRecognition;
    window.submitTranscript = submitTranscript;
    window.resetTranscript = resetTranscript;

    console.log('Speech recognition functions exposed to global scope:', {
        startSpeechRecognition: typeof window.startSpeechRecognition,
        stopSpeechRecognition: typeof window.stopSpeechRecognition,
        submitTranscript: typeof window.submitTranscript,
        resetTranscript: typeof window.resetTranscript
    });
} catch (error) {
    console.error('Error initializing script-transcript.js:', error);
    alert('Speech recognition and transcript submission are unavailable due to a script error. Please refresh the page or contact support.');
}
