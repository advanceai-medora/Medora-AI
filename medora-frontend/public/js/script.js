document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const loginSection = document.getElementById('login-section');
    const mainContent = document.querySelector('.main-content');
    const loginButton = document.getElementById('loginButton');
    const tenantIdInput = document.getElementById('tenantIdInput');
    const passwordInput = document.getElementById('passwordInput');
    const clock = document.getElementById('clock');
    const startButton = document.getElementById('startButton');
    const stopButton = document.getElementById('stopButton');
    const transcriptContent = document.getElementById('transcriptContent');
    const subjectiveContent = document.getElementById('subjectiveContent');
    const objectiveContent = document.getElementById('objectiveContent');
    const assessmentContent = document.getElementById('assessmentContent');
    const planContent = document.getElementById('planContent');
    const transcriptInput = document.getElementById('transcriptInput');
    const submitTranscriptButton = document.getElementById('submitTranscriptButton');
    const languageSelect = document.getElementById('language');
    const allergensDetected = document.getElementById('allergensDetected');
    const asthmaFrequency = document.getElementById('asthmaFrequency');
    const asthmaSeverity = document.getElementById('asthmaSeverity');
    const asthmaTriggers = document.getElementById('asthmaTriggers');
    const infectionFrequency = document.getElementById('infectionFrequency');
    const inflammationLevel = document.getElementById('inflammationLevel');
    const recommendationsList = document.getElementById('recommendationsList');
    const subscriptionInfo = document.createElement('div');
    const logoutButton = document.getElementById('logout-button');
    const signInterpreterButton = document.getElementById('signInterpreterButton');
    const signInterpreterSection = document.getElementById('signInterpreterSection');
    const signInterpreterOutput = document.getElementById('signInterpreterOutput');
    const signInterpreterAvatar = document.getElementById('signInterpreterAvatar');
    const patientVideo = document.getElementById('patientVideo');
    const signInterpreterText = document.getElementById('signInterpreterText');
    const signInterpreterInstructions = document.getElementById('signInterpreterInstructions');
    const handOverlay = document.getElementById('handOverlay');

    // Check for required elements
    const requiredElements = {
        loginSection, mainContent, loginButton, tenantIdInput, passwordInput,
        startButton, stopButton, transcriptContent, subjectiveContent, objectiveContent,
        assessmentContent, planContent, clock, transcriptInput, submitTranscriptButton,
        languageSelect, allergensDetected, asthmaFrequency, asthmaSeverity, asthmaTriggers,
        infectionFrequency, inflammationLevel, recommendationsList, logoutButton,
        signInterpreterButton, signInterpreterSection, signInterpreterOutput,
        signInterpreterAvatar, patientVideo, signInterpreterText, signInterpreterInstructions,
        handOverlay
    };
    const missingElements = Object.entries(requiredElements).filter(([key, value]) => value === null).map(([key]) => key);
    if (missingElements.length > 0) {
        console.error('One or more DOM elements not found:', missingElements.reduce((obj, key) => ({ ...obj, [key]: null }), {}));
        document.body.innerHTML = '<div style="text-align: center; padding: 20px; color: red;"><h2>Error: Missing DOM Elements</h2><p>Please check the console for details.</p></div>';
        return;
    }

    // Object to store the original content of each section
    const sectionContents = {
        transcript: '',
        subjective: '',
        objective: '',
        assessment: '',
        plan: ''
    };

    // Sign Language Interpreter State
    let isSignInterpreterEnabled = false;
    let stream = null;
    let scene, camera, renderer, avatar;
    let hands, cameraFeed;
    let gestureQueue = [];
    let currentGesture = null;
    let gestureStartTime = 0;
    const gestureDuration = 1000;
    let ctx = handOverlay.getContext('2d');
    let lastFrameTime = 0;
    let detectionAttempts = 0;

    // Login functionality
    if (localStorage.getItem('jwt')) {
        loginSection.style.display = 'none';
        mainContent.style.display = 'block';
    } else {
        loginSection.style.display = 'block';
        mainContent.style.display = 'none';
    }

    loginButton.addEventListener('click', async () => {
        const tenantId = tenantIdInput.value;
        const password = passwordInput.value;

        try {
            const response = await fetch('/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tenantId, password })
            });
            const data = await response.json();
            if (data.error) throw new Error(data.error);

            localStorage.setItem('jwt', data.token);
            localStorage.setItem('tenantId', tenantId);
            sessionStorage.setItem('isAuthenticated', 'true'); // Set authentication flag
            loginSection.style.display = 'none';
            mainContent.style.display = 'block';
        } catch (error) {
            alert('Login failed: ' + error.message);
        }
    });

    // Initialize Three.js for Avatar Animation
    function initAvatar() {
        try {
            scene = new THREE.Scene();
            scene.background = new THREE.Color(0x000000);

            camera = new THREE.PerspectiveCamera(75, signInterpreterAvatar.clientWidth / signInterpreterAvatar.clientHeight, 0.1, 1000);
            renderer = new THREE.WebGLRenderer({ antialias: true });
            renderer.setSize(signInterpreterAvatar.clientWidth, signInterpreterAvatar.clientHeight);
            signInterpreterAvatar.appendChild(renderer.domElement);

            const bodyGeometry = new THREE.BoxGeometry(1, 2, 0.5);
            const bodyMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
            const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
            scene.add(body);

            const armGeometry = new THREE.BoxGeometry(0.2, 1, 0.2);
            const armMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff });
            const leftArm = new THREE.Mesh(armGeometry, armMaterial);
            leftArm.position.set(-0.6, 0, 0);
            body.add(leftArm);
            const rightArm = new THREE.Mesh(armGeometry, armMaterial);
            rightArm.position.set(0.6, 0, 0);
            body.add(rightArm);

            avatar = { body, leftArm, rightArm };

            camera.position.z = 5;

            function animate() {
                requestAnimationFrame(animate);
                console.log('Animate loop running');

                const currentTime = performance.now();
                if (!currentGesture && gestureQueue.length > 0) {
                    currentGesture = gestureQueue.shift();
                    gestureStartTime = currentTime;
                    console.log('Playing gesture:', currentGesture, 'at time:', currentTime);
                }

                if (currentGesture && (currentTime - gestureStartTime) >= gestureDuration) {
                    console.log('Gesture', currentGesture, 'finished at time:', currentTime);
                    currentGesture = null;
                }

                if (avatar) {
                    if (currentGesture === 'wave') {
                        avatar.rightArm.rotation.x = Math.sin(currentTime * 0.005) * 0.5;
                        avatar.leftArm.rotation.x = 0;
                        console.log('Wave animation - rightArm rotation.x:', avatar.rightArm.rotation.x);
                    } else if (currentGesture === 'point') {
                        avatar.leftArm.rotation.x = -Math.PI / 4;
                        avatar.rightArm.rotation.x = 0;
                        console.log('Point animation - leftArm rotation.x:', avatar.leftArm.rotation.x);
                    } else if (currentGesture === 'breathe') {
                        avatar.leftArm.rotation.x = Math.sin(currentTime * 0.003) * 0.3;
                        avatar.rightArm.rotation.x = Math.sin(currentTime * 0.003) * 0.3;
                        console.log('Breathe animation - leftArm rotation.x:', avatar.leftArm.rotation.x, 'rightArm rotation.x:', avatar.rightArm.rotation.x);
                    } else {
                        avatar.leftArm.rotation.x = 0;
                        avatar.rightArm.rotation.x = 0;
                        console.log('Default animation - arms reset to 0');
                    }
                } else {
                    console.warn('Avatar not initialized in animate loop');
                }

                renderer.render(scene, camera);
            }
            animate();
            console.log('Three.js avatar initialized successfully.');
        } catch (error) {
            console.error('Error initializing Three.js avatar:', error);
            signInterpreterOutput.textContent = '[Error initializing avatar]';
        }
    }

    // Handle Edit button clicks
    document.querySelectorAll('.edit-button').forEach(button => {
        button.addEventListener('click', (e) => {
            const targetButton = e.target.closest('.edit-button');
            if (!targetButton) return;

            const section = targetButton.dataset.section;
            const contentDiv = document.getElementById(`${section}Content`);
            const currentContent = sectionContents[section] || contentDiv.innerHTML;

            if (!sectionContents[section]) {
                sectionContents[section] = currentContent;
            }

            contentDiv.innerHTML = `
                <textarea class="edit-textarea">${currentContent}</textarea>
                <div class="edit-actions">
                    <button class="save-button" data-section="${section}">Save</button>
                    <button class="cancel-button" data-section="${section}">Cancel</button>
                </div>
            `;

            contentDiv.querySelector('.save-button').addEventListener('click', (e) => {
                const section = e.target.dataset.section;
                const textarea = contentDiv.querySelector('.edit-textarea');
                const newContent = textarea.value;

                sectionContents[section] = newContent;
                contentDiv.innerHTML = newContent;
            });

            contentDiv.querySelector('.cancel-button').addEventListener('click', (e) => {
                const section = e.target.dataset.section;
                contentDiv.innerHTML = sectionContents[section];
            });
        });
    });

    // Handle Copy button clicks
    document.querySelectorAll('.copy-button').forEach(button => {
        button.addEventListener('click', (e) => {
            const targetButton = e.target.closest('.copy-button');
            if (!targetButton) return;

            const section = targetButton.dataset.section;
            const contentDiv = document.getElementById(`${section}Content`);
            const textToCopy = contentDiv.textContent || contentDiv.innerText;

            navigator.clipboard.writeText(textToCopy).then(() => {
                alert(`Copied ${section.replace('-', ' ')} to clipboard!`);
            }).catch(err => {
                console.error('Failed to copy:', err);
                alert('Failed to copy content. Please try again.');
            });
        });
    });

    // Add subscription info to header
    subscriptionInfo.style.cssText = 'color: #e6f0fa; font-size: 0.875rem; font-weight: 500;';
    document.querySelector('.header-right').insertBefore(subscriptionInfo, document.querySelector('.clock-container'));

    // Update digital clock every second
    function updateClock() {
        try {
            const now = new Date();
            const timeString = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short' });
            clock.textContent = timeString;
        } catch (error) {
            console.error('Error updating clock:', error);
            clock.textContent = 'Error loading time';
        }
    }
    updateClock();
    setInterval(updateClock, 1000);

    // Speech-to-Text Functionality
    let recognition;
    let isRecording = false;
    let fullTranscript = '';
    let isProcessing = false;

    startButton.addEventListener('click', () => {
        console.log('Start Listening button clicked.');
        if (!isRecording && !isProcessing) {
            if ('webkitSpeechRecognition' in window) {
                console.log('webkitSpeechRecognition is supported.');
                recognition = new webkitSpeechRecognition();
                recognition.continuous = true;
                recognition.interimResults = true;
                recognition.lang = languageSelect.value === 'EN' ? 'en-US' : languageSelect.value === 'ES' ? 'es-ES' : languageSelect.value === 'FR' ? 'fr-FR' : languageSelect.value === 'ZH' ? 'zh-CN' : languageSelect.value === 'PA' ? 'pa-IN' : languageSelect.value === 'HI' ? 'hi-IN' : 'en-US';

                recognition.onstart = () => {
                    console.log('Speech recognition started.');
                    fullTranscript = '';
                    transcriptContent.innerHTML = '<div class="content"><ul><li>Listening...</li></ul></div>';
                    transcriptInput.value = '';
                    isRecording = true;
                    startButton.disabled = true;
                    stopButton.disabled = false;
                    submitTranscriptButton.disabled = true;
                };

                recognition.onresult = (event) => {
                    console.log('Speech recognition result received:', event);
                    let interimTranscript = '';
                    let finalTranscript = '';

                    for (let i = event.resultIndex; i < event.results.length; i++) {
                        const transcript = event.results[i][0].transcript;
                        if (event.results[i].isFinal) {
                            finalTranscript += transcript + ' ';
                        } else {
                            interimTranscript += transcript;
                        }
                    }

                    if (finalTranscript) {
                        fullTranscript += finalTranscript.trim() + ' ';
                    }
                    transcriptContent.innerHTML = `<div class="content"><ul><li>${fullTranscript + (interimTranscript ? ' ' + interimTranscript : '')}</li></ul></div>`;
                    transcriptInput.value = fullTranscript + (interimTranscript ? ' ' + interimTranscript : '');

                    if (isSignInterpreterEnabled) {
                        interpretSignLanguage(fullTranscript + (interimTranscript ? ' ' + interimTranscript : ''));
                    }
                };

                recognition.onerror = (event) => {
                    console.error('Speech recognition error:', event.error);
                    transcriptContent.innerHTML = `<div class="content"><ul><li>${fullTranscript || 'Speech recognition error: ' + event.error}</li></ul></div>`;
                    isRecording = false;
                    startButton.disabled = false;
                    stopButton.disabled = true;
                    submitTranscriptButton.disabled = false;
                };

                recognition.onend = () => {
                    console.log('Speech recognition ended due to pause or stop.');
                    if (isRecording) {
                        setTimeout(() => {
                            if (isRecording) {
                                try {
                                    recognition.start();
                                } catch (error) {
                                    console.error('Error restarting speech recognition:', error);
                                    transcriptContent.innerHTML = `<div class="content"><ul><li>${fullTranscript || 'Error restarting speech recognition: ' + error.message}</li></ul></div>`;
                                    isRecording = false;
                                    startButton.disabled = false;
                                    stopButton.disabled = true;
                                    submitTranscriptButton.disabled = false;
                                }
                            }
                        }, 1000);
                    }
                };

                try {
                    recognition.start();
                    startButton.style.display = 'none';
                    stopButton.style.display = 'block';
                } catch (error) {
                    console.error('Error starting speech recognition:', error);
                    transcriptContent.innerHTML = `<div class="content"><ul><li>Error starting speech recognition: ${error.message}</li></ul></div>`;
                    isRecording = false;
                    startButton.disabled = false;
                    stopButton.disabled = true;
                    submitTranscriptButton.disabled = false;
                }
            } else {
                console.error('Speech recognition not supported in this browser. Please use Chrome.');
                transcriptContent.innerHTML = '<div class="content"><ul><li>Speech recognition not supported. Please use Chrome.</li></ul></div>';
                startButton.disabled = true;
                stopButton.disabled = true;
                submitTranscriptButton.disabled = false;
            }
        }
    });

    stopButton.addEventListener('click', () => {
        console.log('Stop Listening button clicked.');
        if (isRecording && fullTranscript.trim()) {
            recognition.stop();
            isRecording = false;
            startButton.style.display = 'block';
            stopButton.style.display = 'none';
            transcriptContent.innerHTML = `<div class="content"><ul><li>${fullTranscript || 'No speech detected.'}</li></ul></div>`;
            processTranscript(fullTranscript);
        } else {
            console.log('No valid transcript to process.');
            transcriptContent.innerHTML = `<div class="content"><ul><li>${fullTranscript || 'No speech detected.'}</li></ul></div>`;
            isRecording = false;
            startButton.disabled = false;
            stopButton.disabled = true;
            submitTranscriptButton.disabled = false;
            startButton.style.display = 'block';
            stopButton.style.display = 'none';
        }
    });

    // Submit Transcript via Text Input
    submitTranscriptButton.addEventListener('click', () => {
        console.log('Submit Transcript button clicked.');
        if (isRecording) {
            recognition.stop();
            isRecording = false;
            startButton.style.display = 'block';
            stopButton.style.display = 'none';
        }
        const pastedTranscript = transcriptInput.value.trim();
        if (pastedTranscript && !isProcessing) {
            transcriptContent.innerHTML = `<div class="content"><ul><li>${pastedTranscript}</li></ul></div>`;
            processTranscript(pastedTranscript);
        } else if (!pastedTranscript) {
            transcriptContent.innerHTML = '<div class="content"><ul><li>Please paste a transcript to analyze.</li></ul></div>';
        }
    });

    // Sign Language Interpreter Button
    signInterpreterButton.addEventListener('click', () => {
        isSignInterpreterEnabled = !isSignInterpreterEnabled;
        signInterpreterButton.textContent = isSignInterpreterEnabled ? 'Disable Sign Language Interpreter' : 'Enable Sign Language Interpreter';
        signInterpreterSection.style.display = isSignInterpreterEnabled ? 'block' : 'none';
        if (isSignInterpreterEnabled) {
            initAvatar();
            startCamera();
            if (fullTranscript) {
                interpretSignLanguage(fullTranscript);
            }
            startSignToSpeech();
        } else {
            stopCamera();
            stopSignToSpeech();
            signInterpreterOutput.textContent = '[Interpreted ASL gestures will appear here]';
            signInterpreterText.textContent = "[Interpreted text from patient's sign language will appear here]";
            signInterpreterInstructions.textContent = "Hold your hand palm-up, centered within the dashed box, about 1-2 feet from the camera. Wave to test gesture detection.";
            signInterpreterAvatar.innerHTML = '';
            gestureQueue = [];
            currentGesture = null;
            ctx.clearRect(0, 0, handOverlay.width, handOverlay.height);
            detectionAttempts = 0;
        }
    });

    // Function to Start Camera for Sign-to-Speech
    async function startCamera() {
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'user',
                    width: 1280,
                    height: 720
                }
            });
            patientVideo.srcObject = stream;
            console.log('Camera started successfully with resolution 1280x720.');
        } catch (error) {
            console.error('Error accessing camera:', error);
            signInterpreterText.textContent = '[Error accessing camera: Please allow camera access]';
        }
    }

    // Function to Stop Camera
    function stopCamera() {
        if (stream) {
            const tracks = stream.getTracks();
            tracks.forEach(track => track.stop());
            patientVideo.srcObject = null;
            stream = null;
            console.log('Camera stopped.');
        }
    }

    // Function to Interpret Transcript into Sign Language (Speech to Sign)
    function interpretSignLanguage(transcript) {
        if (!transcript) {
            signInterpreterOutput.textContent = '[No transcript to interpret]';
            return;
        }

        const words = transcript.toLowerCase().split(/\s+/);
        let signOutput = 'Interpreting: ';
        gestureQueue = [];

        words.forEach(word => {
            if (word === 'hello') {
                signOutput += '[ASL: Wave hand] ';
                gestureQueue.push('wave');
                console.log('Added wave to gesture queue');
            } else if (word === 'patient') {
                signOutput += '[ASL: Point to person] ';
                gestureQueue.push('point');
                console.log('Added point to gesture queue');
            } else if (word === 'asthma') {
                signOutput += '[ASL: Hand on chest, breathing motion] ';
                gestureQueue.push('breathe');
                console.log('Added breathe to gesture queue');
            } else {
                signOutput += `[ASL: ${word.toUpperCase()}] `;
                gestureQueue.push('default');
                console.log('Added default to gesture queue');
            }
        });

        signInterpreterOutput.textContent = signOutput;
    }

    // Function to Draw Hand Landmarks on the Canvas Overlay
    function drawHandLandmarks(landmarks, width, height) {
        ctx.clearRect(0, 0, width, height);
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 2;

        landmarks.forEach((landmark, index) => {
            const x = landmark.x * width;
            const y = landmark.y * height;
            ctx.beginPath();
            ctx.arc(x, y, 5, 0, 2 * Math.PI);
            ctx.stroke();
        });

        const connections = [
            [0, 1], [1, 2], [2, 3], [3, 4],
            [0, 5], [5, 6], [6, 7], [7, 8],
            [0, 9], [9, 10], [10, 11], [11, 12],
            [0, 13], [13, 14], [14, 15], [15, 16],
            [0, 17], [17, 18], [18, 19], [19, 20]
        ];

        ctx.beginPath();
        connections.forEach(([start, end]) => {
            const startPoint = landmarks[start];
            const endPoint = landmarks[end];
            ctx.moveTo(startPoint.x * width, startPoint.y * height);
            ctx.lineTo(endPoint.x * width, endPoint.y * height);
        });
        ctx.stroke();
    }

    // Function to Start Sign-to-Speech Interpretation
    function startSignToSpeech() {
        try {
            hands = new Hands({
                locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4/${file}`
            });
            hands.setOptions({
                maxNumHands: 2,
                modelComplexity: 0,
                minDetectionConfidence: 0.05,
                minTrackingConfidence: 0.05,
                selfieMode: true
            });

            hands.onResults((results) => {
                console.log('MediaPipe Hands results:', results);
                handOverlay.width = patientVideo.videoWidth;
                handOverlay.height = patientVideo.videoHeight;

                const currentTime = performance.now();
                if (lastFrameTime > 0) {
                    const frameRate = 1000 / (currentTime - lastFrameTime);
                    console.log('Frame rate:', frameRate.toFixed(2), 'fps');
                }
                lastFrameTime = currentTime;

                if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
                    detectionAttempts = 0;
                    signInterpreterInstructions.textContent = "Hand detected! Wave to test gesture recognition.";

                    const landmarks = results.multiHandLandmarks[0];
                    if (landmarks) {
                        const handedness = results.multiHandedness[0];
                        console.log('Hand detected with confidence:', handedness.score);
                        signInterpreterText.textContent = 'Hand detected';

                        drawHandLandmarks(landmarks, handOverlay.width, handOverlay.height);

                        const wrist = landmarks[0];
                        const tip = landmarks[8];
                        const distance = Math.abs(wrist.y - tip.y);
                        console.log('Distance between wrist and tip:', distance);
                        if (distance > 0.05) {
                            signInterpreterText.textContent = 'Hello';
                            console.log('Wave gesture detected');
                        }
                    }
                } else {
                    detectionAttempts++;
                    console.log('No hands detected after', detectionAttempts, 'frames');
                    signInterpreterText.textContent = '[No hands detected]';
                    ctx.clearRect(0, 0, handOverlay.width, handOverlay.height);

                    if (detectionAttempts > 50) {
                        signInterpreterInstructions.textContent = "No hand detected. Try moving closer to the camera, adjusting lighting, or ensuring your hand is palm-up in the dashed box.";
                    } else if (detectionAttempts > 30) {
                        signInterpreterInstructions.textContent = "No hand detected. Ensure your hand is centered in the dashed box and well-lit.";
                    }
                }
            });

            cameraFeed = new Camera(patientVideo, {
                onFrame: async () => {
                    console.log('Processing video frame for MediaPipe Hands');
                    await hands.send({ image: patientVideo });
                },
                width: 1280,
                height: 720
            });
            cameraFeed.start();
            console.log('Sign-to-speech interpretation started');
        } catch (error) {
            console.error('Error starting sign-to-speech:', error);
            signInterpreterText.textContent = '[Error starting sign-to-speech]';
        }
    }

    // Function to Stop Sign-to-Speech Interpretation
    function stopSignToSpeech() {
        if (cameraFeed) {
            cameraFeed.stop();
            cameraFeed = null;
            console.log('Camera feed stopped');
        }
        if (hands) {
            hands.close();
            hands = null;
            console.log('MediaPipe Hands closed');
        }
        stopCamera();
    }

    async function processTranscript(transcript) {
        console.log('Processing transcript:', transcript);
        isProcessing = true;
        startButton.disabled = true;
        stopButton.disabled = true;
        submitTranscriptButton.disabled = true;

        try {
            const email = sessionStorage.getItem('email') || "doctor@allergyaffiliates";
            const subscription = sessionStorage.getItem('subscription') || 'None';
            const trialEnd = sessionStorage.getItem('trial_end') || '';
            let currentDate = new Date().toISOString().split('T')[0];

            if (subscription === 'Trial' && trialEnd && currentDate > trialEnd) {
                throw new Error("Free trial has expired. Upgrade to Premium.");
            }

            const response = await fetch('/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('jwt')}`
                },
                body: JSON.stringify({
                    text: transcript,
                    language: languageSelect.value,
                    email,
                    allergensDetected: allergensDetected.textContent,
                    asthmaFrequency: asthmaFrequency.textContent,
                    asthmaSeverity: asthmaSeverity.textContent,
                    asthmaTriggers: asthmaTriggers.textContent,
                    infectionFrequency: infectionFrequency.textContent,
                    inflammationLevel: inflammationLevel.textContent,
                    recommendations: recommendationsList.innerHTML
                })
            });
            console.log('Response status:', response.status);
            console.log('Response headers:', response.headers);

            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            const data = await response.json();
            console.log('Response data:', data);

            if (data.error) {
                throw new Error(data.error);
            }

            sectionContents.transcript = `<div class="content"><ul><li><strong>Transcript:</strong> ${transcript}</li></ul></div>`;
            transcriptContent.innerHTML = sectionContents.transcript;

            sectionContents.subjective = `
                <div class="content">
                    <ul>
                        <li><strong>Chief Complaint:</strong> ${data.patient_history?.chief_complaint || 'N/A'}</li>
                        <li><strong>History of Present Illness:</strong> ${data.patient_history?.history_of_present_illness || 'N/A'}</li>
                        <li><strong>Past Medical History:</strong> ${data.patient_history?.past_medical_history || 'N/A'}</li>
                        <li><strong>Allergies:</strong> ${data.patient_history?.allergies || 'N/A'}</li>
                    </ul>
                </div>
            `;
            subjectiveContent.innerHTML = sectionContents.subjective;

            sectionContents.objective = `
                <div class="content">
                    <ul>
                        <li><strong>Physical Examination Findings:</strong> ${data.physical_examination || 'N/A'}</li>
                        <li><strong>Allergy & Asthma Insights:</strong>
                            <ul>
                                <li><strong>Allergen Exposure:</strong> <span id="allergensDetectedOutput">${allergensDetected.textContent || 'N/A'}</span></li>
                                <li><strong>Asthma Status:</strong>
                                    <ul>
                                        <li>Frequency: <span id="asthmaFrequencyOutput">${asthmaFrequency.textContent || 'N/A'}</span></li>
                                        <li>Severity: <span id="asthmaSeverityOutput">${asthmaSeverity.textContent || 'N/A'}</span></li>
                                        <li>Triggers: <span id="asthmaTriggersOutput">${asthmaTriggers.textContent || 'N/A'}</span></li>
                                    </ul>
                                </li>
                                <li><strong>Immunology Profile:</strong>
                                    <ul>
                                        <li>Infections: <span id="infectionFrequencyOutput">${infectionFrequency.textContent || 'N/A'}</span></li>
                                        <li>Inflammatory Response: <span id="inflammationLevelOutput">${inflammationLevel.textContent || 'N/A'}</span></li>
                                    </ul>
                                </li>
                            </ul>
                        </li>
                    </ul>
                </div>
            `;
            objectiveContent.innerHTML = sectionContents.objective;

            sectionContents.assessment = `
                <div class="content">
                    <ul>
                        <li><strong>Clinical Summary:</strong> ${data.summary || 'No summary available.'}</li>
                        <li><strong>Differential Diagnosis:</strong>
                            <ol>
                                ${data.differential_diagnosis ? data.differential_diagnosis.split('\n').map(item => `<li>${item.trim()}</li>`).join('') : '<li>No diagnosis available.</li>'}
                            </ol>
                        </li>
                    </ul>
                </div>
            `;
            assessmentContent.innerHTML = sectionContents.assessment;

            sectionContents.plan = `
                <div class="content">
                    <ul>
                        <li><strong>Plan of Care:</strong>
                            <ol>
                                ${data.plan_of_care ? data.plan_of_care.split('\n').map(item => `<li>${item.trim()}</li>`).join('') : '<li>No plan generated.</li>'}
                            </ol>
                        </li>
                        <li><strong>Diagnostic Workup:</strong>
                            <ul>
                                ${data.diagnostic_workup ? data.diagnostic_workup.split('\n').map(item => `<li>${item.trim()}</li>`).join('') : '<li>No workup recommended.</li>'}
                            </ul>
                        </li>
                        <li><strong>Patient Education:</strong>
                            <ul>
                                ${data.patient_education ? data.patient_education.split('\n').map(item => `<li>${item.trim()}</li>`).join('') : '<li>N/A</li>'}
                            </ul>
                        </li>
                        <li><strong>Follow-up Instructions:</strong>
                            <ul>
                                ${data.follow_up_instructions ? data.follow_up_instructions.split('\n').map(item => `<li>${item.trim()}</li>`).join('') : '<li>N/A</li>'}
                            </ul>
                        </li>
                        <li><strong>Recommendations:</strong>
                            <ul id="recommendationsListOutput">
                                ${recommendationsList.innerHTML || '<li>N/A</li>'}
                            </ul>
                        </li>
                    </ul>
                </div>
            `;
            planContent.innerHTML = sectionContents.plan;

            const transcriptLower = transcript.toLowerCase();
            let allDetectedAllergens = [];
            let envDetected = [];
            if (transcriptLower.includes('sneezing') || transcriptLower.includes('nasal congestion') || transcriptLower.includes('pollen')) {
                envDetected.push('Pollen');
            }
            if (transcriptLower.includes('dust')) {
                envDetected.push('Dust');
            }
            if (transcriptLower.includes('mold')) {
                envDetected.push('Mold');
            }
            if (envDetected.length > 0) {
                allDetectedAllergens.push(...envDetected);
            }

            let foodDetected = [];
            if (transcriptLower.includes('peanuts')) foodDetected.push('Peanuts');
            if (transcriptLower.includes('dairy') || transcriptLower.includes('milk')) foodDetected.push('Dairy');
            if (transcriptLower.includes('eggs')) foodDetected.push('Eggs');
            if (transcriptLower.includes('shellfish')) foodDetected.push('Shellfish');
            if (transcriptLower.includes('food') || transcriptLower.includes('drooling') || transcriptLower.includes('hives')) {
                if (foodDetected.length === 0) foodDetected.push('Unspecified Food Reactions');
            }
            if (foodDetected.length > 0) {
                allDetectedAllergens.push(...foodDetected);
            }

            let venomDetected = [];
            if (transcriptLower.includes('bee sting') || transcriptLower.includes('venom')) {
                venomDetected.push('Bee Sting');
            }
            if (venomDetected.length > 0) {
                allDetectedAllergens.push(...venomDetected);
            }

            let drugDetected = [];
            if (transcriptLower.includes('antibiotic') || transcriptLower.includes('rash')) {
                drugDetected.push('Antibiotic Reaction');
            }
            if (transcriptLower.includes('drug')) {
                drugDetected.push('Unspecified Drug Reaction');
            }
            if (drugDetected.length > 0) {
                allDetectedAllergens.push(...drugDetected);
            }

            let contactDetected = [];
            if (transcriptLower.includes('eczema') || transcriptLower.includes('itch')) {
                contactDetected.push('Skincare');
            }
            if (transcriptLower.includes('metals')) {
                contactDetected.push('Metals');
            }
            if (contactDetected.length > 0) {
                allDetectedAllergens.push(...contactDetected);
            }

            if (allDetectedAllergens.length > 0) {
                allergensDetected.textContent = allDetectedAllergens.join(', ');
                allergensDetected.parentElement.classList.add('show');
            }

            let asthmaFrequencyText = '';
            let asthmaSeverityText = '';
            let asthmaTriggersText = '';

            if (transcriptLower.includes('daily') || transcriptLower.includes('every day')) {
                asthmaFrequencyText = 'Daily';
                asthmaFrequency.textContent = asthmaFrequencyText;
                asthmaFrequency.parentElement.classList.add('show');
            } else if (transcriptLower.includes('weekly') || transcriptLower.includes('week')) {
                asthmaFrequencyText = 'Weekly';
                asthmaFrequency.textContent = asthmaFrequencyText;
                asthmaFrequency.parentElement.classList.add('show');
            } else if (transcriptLower.includes('monthly') || transcriptLower.includes('month')) {
                asthmaFrequencyText = 'Monthly';
                asthmaFrequency.textContent = asthmaFrequencyText;
                asthmaFrequency.parentElement.classList.add('show');
            }

            if (transcriptLower.includes('severe') || transcriptLower.includes('wheezing') || transcriptLower.includes('breathing difficulty')) {
                asthmaSeverityText = 'Severe';
                asthmaSeverity.textContent = asthmaSeverityText;
                asthmaSeverity.parentElement.classList.add('show');
            } else if (transcriptLower.includes('mild') || transcriptLower.includes('shortness')) {
                asthmaSeverityText = 'Mild';
                asthmaSeverity.textContent = asthmaSeverityText;
                asthmaSeverity.parentElement.classList.add('show');
            }

            let triggersDetected = [];
            if (transcriptLower.includes('pollen')) {
                triggersDetected.push('Pollen');
            }
            if (transcriptLower.includes('exercise')) {
                triggersDetected.push('Exercise');
            }
            if (transcriptLower.includes('cold air')) {
                triggersDetected.push('Cold Air');
            }
            if (triggersDetected.length > 0) {
                asthmaTriggersText = triggersDetected.join(', ');
                asthmaTriggers.textContent = asthmaTriggersText;
                asthmaTriggers.parentElement.classList.add('show');
            }

            let infectionFrequencyText = '';
            let inflammationLevelText = '';

            let infectionsDetected = [];
            if (transcriptLower.includes('sinus infection')) {
                infectionsDetected.push('Sinus Infections');
            }
            if (transcriptLower.includes('cold')) {
                infectionsDetected.push('Frequent Colds');
            }
            if (infectionsDetected.length > 0) {
                if (transcriptLower.includes('frequent') || transcriptLower.includes('often')) {
                    infectionFrequencyText = 'High (' + infectionsDetected.join(', ') + ')';
                } else {
                    infectionFrequencyText = 'Low (' + infectionsDetected.join(', ') + ')';
                }
                infectionFrequency.textContent = infectionFrequencyText;
                infectionFrequency.parentElement.classList.add('show');
            }

            let inflammationDetected = [];
            if (transcriptLower.includes('swelling')) {
                inflammationDetected.push('Swelling');
            }
            if (transcriptLower.includes('redness') || transcriptLower.includes('inflammation')) {
                inflammationDetected.push('Redness');
            }
            if (inflammationDetected.length > 0) {
                inflammationLevelText = 'Elevated (' + inflammationDetected.join(', ') + ')';
                inflammationLevel.textContent = inflammationLevelText;
                inflammationLevel.parentElement.classList.add('show');
            }

            let recommendationsArray = [];
            if (foodDetected.length > 0 || venomDetected.length > 0) {
                recommendationsArray.push('Consider epinephrine auto-injector for potential anaphylaxis.');
            }
            if (asthmaSeverityText === 'Severe') {
                recommendationsArray.push('Urgently assess asthma management plan.');
            }
            if (recommendationsArray.length === 0) {
                recommendationsArray.push('Conduct allergen testing and review treatment plan.');
            }

            recommendationsList.innerHTML = '';
            recommendationsArray.forEach(rec => {
                const li = document.createElement('li');
                li.textContent = rec;
                li.classList.add('show');
                recommendationsList.appendChild(li);
            });

            const subscriptionTier = sessionStorage.getItem('subscription') || 'None';
            const trialEndDate = sessionStorage.getItem('trial_end') || '';
            subscriptionInfo.textContent = `Subscription: ${subscriptionTier} Tier`;
            if (trialEndDate) {
                subscriptionInfo.textContent += ` (Trial ends: ${trialEndDate})`;
            }
            if (subscriptionTier === 'None' || subscriptionTier === 'Basic' || (subscriptionTier === 'Trial' && trialEndDate && new Date() > new Date(trialEndDate))) {
                subscriptionInfo.innerHTML += ' <a href="#" onclick="upgradeSubscription()" style="color: #a3bffa; text-decoration: underline;">Upgrade to Premium</a>';
            }

            if (isSignInterpreterEnabled) {
                interpretSignLanguage(transcript);
            }
        } catch (error) {
            console.error('Error in processTranscript:', error);
            sectionContents.transcript = `<div class="content"><ul><li>Error processing transcript: ${error.message}</li></ul></div>`;
            transcriptContent.innerHTML = sectionContents.transcript;

            sectionContents.subjective = `<div class="content"><ul><li>Error generating Subjective: ${error.message}</li></ul></div>`;
            subjectiveContent.innerHTML = sectionContents.subjective;

            sectionContents.objective = `<div class="content"><ul><li>Error generating Objective: ${error.message}</li></ul></div>`;
            objectiveContent.innerHTML = sectionContents.objective;

            sectionContents.assessment = `<div class="content"><ul><li>Error generating Assessment: ${error.message}</li></ul></div>`;
            assessmentContent.innerHTML = sectionContents.assessment;

            sectionContents.plan = `<div class="content"><ul><li>Error generating Plan: ${error.message}</li></ul></div>`;
            planContent.innerHTML = sectionContents.plan;
        } finally {
            isProcessing = false;
            startButton.disabled = false;
            stopButton.disabled = true;
            submitTranscriptButton.disabled = false;
        }
    }

    function upgradeSubscription() {
        alert("Upgrade to Premium tier required for full access. Contact admin or enter payment details to subscribe.");
    }

    // Attach logout event listener programmatically
    logoutButton.addEventListener('click', () => {
        console.log('Logout clicked');
        sessionStorage.removeItem('isAuthenticated');
        sessionStorage.removeItem('email');
        sessionStorage.removeItem('subscription');
        sessionStorage.removeItem('trial_end');
        sessionStorage.removeItem('card_last4');
        localStorage.removeItem('jwt');
        localStorage.removeItem('tenantId');
        loginSection.style.display = 'block';
        mainContent.style.display = 'none';
    });

    // Check authentication and subscription for sign language interpreter
    const isAuthenticated = sessionStorage.getItem('isAuthenticated');
    const currentPath = window.location.pathname;
    if (!isAuthenticated && currentPath !== '/') {
        console.log('User not authenticated, redirecting to login page.');
        window.location.href = 'http://127.0.0.1:8080/';
    } else {
        const email = sessionStorage.getItem('email') || "doctor@allergyaffiliates";
        sessionStorage.setItem('email', email);
        const subscription = sessionStorage.getItem('subscription') || 'None';
        const trialEnd = sessionStorage.getItem('trial_end') || '';
        sessionStorage.setItem('subscription', subscription);
        sessionStorage.setItem('trial_end', trialEnd);
        subscriptionInfo.textContent = `Subscription: ${subscription} Tier`;
        if (trialEnd) {
            subscriptionInfo.textContent += ` (Trial ends: ${trialEnd})`;
        }
        if (subscription === 'None' || subscription === 'Basic' || (subscription === 'Trial' && trialEnd && new Date() > new Date(trialEnd))) {
            subscriptionInfo.innerHTML += ' <a href="#" onclick="upgradeSubscription()" style="color: #a3bffa; text-decoration: underline;">Upgrade to Premium</a>';
            signInterpreterButton.style.display = 'none';
            signInterpreterSection.style.display = 'none';
        } else if (subscription === 'Premium') {
            signInterpreterButton.style.display = 'block';
        }
    }
});
