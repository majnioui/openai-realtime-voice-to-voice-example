// UI elements
const toggleSwitch = document.getElementById('toggleSwitch');
const animationContainer = document.getElementById('animationContainer');
const animationWrapper = document.getElementById('animationWrapper');
const userSpeakingIndicator = document.getElementById('userSpeakingIndicator');
const statusText = document.getElementById('statusText');
const aiSpeakingAnimation = document.getElementById('aiSpeakingAnimation');
const aiIdleAnimation = document.getElementById('aiIdleAnimation');

// Animation URLs
const userSpeakingAnimationUrl = 'https://lottie.host/bdb5b41f-8111-4d3e-8018-e8962d96a186/x108PiQKJi.json';
const speakingAnimationUrl = 'https://lottie.host/75f3ff82-a7ff-44a5-bccd-9c6b5514fb23/PIFu2zeQgJ.json';
const idleAnimationUrl = 'https://lottie.host/75f3ff82-a7ff-44a5-bccd-9c6b5514fb23/PIFu2zeQgJ.json';

// Global variables
let pc = null;
let dc = null;
let micStream = null;
let audioEl = null;
let userAnimation = null;
let isActive = false;
let isSpeaking = false;

// Event listeners
toggleSwitch.addEventListener('change', toggleConversation);

// Initialize animations with proper speeds
document.addEventListener('DOMContentLoaded', () => {
    // Force different speeds for the two animations to distinguish them

    // Make sure both animations are loaded properly
    aiIdleAnimation.addEventListener('ready', () => {
        // Ensure idle animation is always playing at slow speed
        aiIdleAnimation.setSpeed(0.5);
        aiIdleAnimation.play();
    });

    aiSpeakingAnimation.addEventListener('ready', () => {
        // Set faster speed for speaking animation
        aiSpeakingAnimation.setSpeed(2);
        // Preload first frame but keep paused
        aiSpeakingAnimation.pause();
    });
});

// Toggle conversation on/off
function toggleConversation() {
    if (toggleSwitch.checked) {
        startConversation();
    } else {
        stopConversation();
    }
}

// Switch animation with fade effect
function switchAnimation(isAISpeaking) {
    if (isAISpeaking === isSpeaking) return;
    // Set state before visual changes to prevent multiple transitions
    isSpeaking = isAISpeaking;

    // Add a small delay to ensure smooth transition
    setTimeout(() => {
        // Update CSS class for smooth transition
        if (isAISpeaking) {
            animationWrapper.classList.add('ai-speaking');
            // Ensure speaking animation is playing at faster speed
            aiSpeakingAnimation.setSpeed(2);
            aiSpeakingAnimation.play();
        } else {
            animationWrapper.classList.remove('ai-speaking');
            // We don't pause the speaking animation immediately to allow for smooth transition
            setTimeout(() => {
                if (!isSpeaking) {  // Double-check state hasn't changed
                    aiSpeakingAnimation.pause();
                }
            }, 800); // Match transition time from CSS
        }
    }, 10);
}

// Start conversation
async function startConversation() {
    try {
        // Update UI
        isActive = true;
        statusText.textContent = "Connecting to AI...";

        // Reset animation state
        animationWrapper.classList.remove('ai-speaking');
        isSpeaking = false;
        aiSpeakingAnimation.pause();
        aiIdleAnimation.setSpeed(0.5);
        aiIdleAnimation.play();

        // Clean up any previous session
        if (pc) {
            stopConversation();
        }

        // Get session token from our server
        const tokenResponse = await fetch("/session");
        const data = await tokenResponse.json();

        if (!tokenResponse.ok) {
            throw new Error(`Server error: ${data.error || tokenResponse.statusText}`);
        }

        const EPHEMERAL_KEY = data.client_secret.value;

        // Create a peer connection
        pc = new RTCPeerConnection();

        // Set up audio element for AI's voice
        audioEl = document.createElement("audio");
        audioEl.autoplay = true;
        document.body.appendChild(audioEl);

        pc.ontrack = e => {
            audioEl.srcObject = e.streams[0];
            statusText.textContent = "AI is ready to talk";

            // Create audio context to detect when AI is speaking
            const audioContext = new AudioContext();
            const source = audioContext.createMediaStreamSource(e.streams[0]);
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);

            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            // Regularly check if AI is speaking
            function checkAudioLevel() {
                if (!audioEl || !audioEl.srcObject) return;

                analyser.getByteFrequencyData(dataArray);
                let sum = 0;
                for (let i = 0; i < bufferLength; i++) {
                    sum += dataArray[i];
                }

                const average = sum / bufferLength;
                const threshold = 10; // Adjust if needed

                switchAnimation(average > threshold);

                if (pc && isActive) {
                    requestAnimationFrame(checkAudioLevel);
                }
            }

            requestAnimationFrame(checkAudioLevel);
        };

        // Add local audio track (microphone)
        micStream = await navigator.mediaDevices.getUserMedia({
            audio: true
        });
        micStream.getTracks().forEach(track => pc.addTrack(track, micStream));

        // Set up data channel
        dc = pc.createDataChannel("oai-events");
        dc.addEventListener("message", handleMessage);

        // Create and send offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        const baseUrl = "https://api.openai.com/v1/realtime";
        const model = "gpt-4o-realtime-preview-2024-12-17";

        const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
            method: "POST",
            body: offer.sdp,
            headers: {
                Authorization: `Bearer ${EPHEMERAL_KEY}`,
                "Content-Type": "application/sdp"
            },
        });

        if (!sdpResponse.ok) {
            throw new Error(`Failed to connect: ${sdpResponse.status} ${sdpResponse.statusText}`);
        }

        const answer = {
            type: "answer",
            sdp: await sdpResponse.text(),
        };

        await pc.setRemoteDescription(answer);
        statusText.textContent = "Connected - I'm listening...";

    } catch (error) {
        console.error('Error starting conversation:', error);
        statusText.textContent = `Error: ${error.message}`;
        toggleSwitch.checked = false;
        isActive = false;
    }
}

// Handle messages from the data channel
function handleMessage(event) {
    const data = JSON.parse(event.data);

    if (data.type === "input_audio_buffer.speech_started") {
        userSpeakingIndicator.classList.add('user-speaking');
        statusText.textContent = "Listening to you...";

        // Show user speaking animation in the indicator
        userSpeakingIndicator.innerHTML = `
            <dotlottie-player src="${userSpeakingAnimationUrl}" background="transparent" speed="1" style="width: 100%; height: 100%" loop autoplay></dotlottie-player>
        `;
    } else if (data.type === "input_audio_buffer.speech_stopped") {
        userSpeakingIndicator.classList.remove('user-speaking');
        statusText.textContent = "Processing your request...";

        // Remove the user speaking animation
        userSpeakingIndicator.innerHTML = '';
    }
}

// Stop conversation
function stopConversation() {
    // Update UI state
    isActive = false;

    // Close data channel
    if (dc) {
        dc.close();
        dc = null;
    }

    // Close peer connection
    if (pc) {
        pc.close();
        pc = null;
    }

    // Stop microphone
    if (micStream) {
        micStream.getTracks().forEach(track => track.stop());
        micStream = null;
    }

    // Stop audio
    if (audioEl) {
        audioEl.pause();
        audioEl.srcObject = null;
    }

    // Reset animation to idle
    animationWrapper.classList.remove('ai-speaking');
    isSpeaking = false;
    aiSpeakingAnimation.pause();

    // Clean up user speaking animation
    userSpeakingIndicator.innerHTML = '';

    // Update UI
    userSpeakingIndicator.classList.remove('user-speaking');
    statusText.textContent = "ACS AI Voice Assistant";
}