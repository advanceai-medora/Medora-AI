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
                stopListeningBtn.classList.remove('disabled'); // Remove disabled class
                stopListeningBtn.disabled = false; // Ensure the button is not disabled
                stopListeningBtn.classList.add('blink-red'); // Add blinking red effect
                stopListeningBtn.style.pointerEvents = 'auto'; // Ensure the button is clickable
                stopListeningBtn.style.opacity = '1'; // Ensure the button is fully visible
                // Force a repaint to ensure the animation triggers
                stopListeningBtn.style.animation = 'none';
                void stopListeningBtn.offsetWidth; // Trigger reflow
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
                stopListeningBtn.classList.remove('blink-red'); // Remove blinking effect
                stopListeningBtn.classList.add('disabled'); // Add disabled class
                stopListeningBtn.disabled = true; // Disable the button
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
                stopListeningBtn.classList.remove('blink-red'); // Remove blinking effect
                stopListeningBtn.classList.add('disabled'); // Add disabled class
                stopListeningBtn.disabled = true; // Disable the button
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
            if (transcriptText) {
                console.log('Transcript submitted:', transcriptText);
                // Add a DOM-based feedback mechanism
                const feedbackDiv = document.createElement('div');
                feedbackDiv.className = 'transcript-feedback';
                feedbackDiv.style.color = 'green';
                feedbackDiv.style.marginTop = '10px';
                feedbackDiv.style.display = 'block'; // Ensure visibility
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
                }, 3000); // Remove after 3 seconds

                // Show spinner and disable button
                submitTranscriptBtn.disabled = true;
                submitTranscriptBtn.classList.add('disabled');
                submitTranscriptBtn.classList.remove('blink'); // Remove blinking effect during submission
                transcriptSpinner.classList.remove('hidden');
                transcriptSpinner.style.display = 'inline-block'; // Ensure spinner is visible
                console.log('Showing spinner during submission, spinner display:', transcriptSpinner.style.display);

                // Submit the transcript to the backend
                const transcriptData = {
                    patient_id: currentPatientId,
                    visit_id: activeVisitId,
                    transcript: transcriptText
                };
                fetch('/submit-transcript', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(transcriptData)
                })
                .then(response => response.json())
                .then(data => {
                    if (data.statusCode === 200) {
                        console.log('Transcript successfully submitted to backend:', data.body);
                        // Refresh SOAP notes by re-selecting the patient
                        if (typeof window.selectPatient === 'function' && currentPatient) {
                            console.log('Re-selecting patient to update SOAP notes:', currentPatient);
                            window.selectPatient(currentPatient);
                        } else {
                            console.error('Cannot update SOAP notes: selectPatient function or currentPatient not available');
                        }
                    } else {
                        console.error('Failed to submit transcript to backend:', data);
                        alert('Failed to submit transcript: ' + (data.error || 'Unknown error'));
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
                    submitTranscriptBtn.classList.remove('blink'); // Ensure blinking is removed after submission
                    transcriptSpinner.classList.add('hidden');
                    transcriptSpinner.style.display = 'none'; // Ensure spinner is hidden
                    console.log('Hiding spinner after submission, spinner display:', transcriptSpinner.style.display);
                });
            } else {
                console.log('No transcript to submit');
                alert('No transcript to submit. Please enter or dictate a transcript.');
            }
        } else {
            console.error('Transcript input, submit button, or spinner element not found', { transcriptInput, submitTranscriptBtn, transcriptSpinner });
            alert('Error: Transcript input field or submit button not found.');
        }
    }

    // Function to reset the transcript state
    function resetTranscript() {
        console.log('resetTranscript called');
        finalTranscript = ''; // Clear the final transcript
        console.log('finalTranscript cleared:', finalTranscript);
        const transcriptInput = document.getElementById('transcript-input');
        if (transcriptInput) {
            transcriptInput.value = ''; // Clear the input field
            console.log('Transcript input cleared via resetTranscript, current value:', transcriptInput.value);
        } else {
            console.error('Transcript input not found in resetTranscript');
        }
        if (recognition && isRecognizing) {
            recognition.stop(); // Stop any active speech recognition
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
