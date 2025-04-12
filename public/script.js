// Config
const CONFIG = {
  api: {
    baseUrl: "https://api.openai.com/v1/realtime",
    model: "gpt-4o-mini-realtime-preview-2024-12-17",
    sessionEndpoint: "/session"
  },
  animation: {
    urls: {
      userSpeaking: 'https://lottie.host/bdb5b41f-8111-4d3e-8018-e8962d96a186/x108PiQKJi.json',
      aiSpeaking: 'https://lottie.host/75f3ff82-a7ff-44a5-bccd-9c6b5514fb23/PIFu2zeQgJ.json',
      aiIdle: 'https://lottie.host/75f3ff82-a7ff-44a5-bccd-9c6b5514fb23/PIFu2zeQgJ.json'
    },
    speeds: {
      idle: 0.5,
      speaking: 2
    },
    transitionDelay: 800
  },
  audio: {
    fftSize: 256,
    threshold: 10
  }
};

// IIFE for encapsulation
(function() {
  // DOM Elements
  const elements = {
    toggleSwitch: document.getElementById('toggleSwitch'),
    animationWrapper: document.getElementById('animationWrapper'),
    userSpeakingIndicator: document.getElementById('userSpeakingIndicator'),
    statusText: document.getElementById('statusText'),
    aiSpeakingAnimation: document.getElementById('aiSpeakingAnimation'),
    aiIdleAnimation: document.getElementById('aiIdleAnimation')
  };

  // State
  const state = {
    connection: {
      peerConnection: null,
      dataChannel: null,
      micStream: null,
      audioElement: null
    },
    status: {
      isActive: false,
      isSpeaking: false
    }
  };

  // UI Controller
  const uiController = {
    updateStatus(message) {
      elements.statusText.textContent = message;
    },

    toggleUserSpeakingIndicator(isSpeaking) {
      if (isSpeaking) {
        elements.userSpeakingIndicator.classList.add('user-speaking');
        elements.userSpeakingIndicator.innerHTML = `
          <dotlottie-player src="${CONFIG.animation.urls.userSpeaking}" background="transparent"
          speed="1" style="width: 100%; height: 100%" loop autoplay></dotlottie-player>
        `;
      } else {
        elements.userSpeakingIndicator.classList.remove('user-speaking');
        elements.userSpeakingIndicator.innerHTML = '';
      }
    },

    switchAnimation(isAISpeaking) {
      if (isAISpeaking === state.status.isSpeaking) return;

      state.status.isSpeaking = isAISpeaking;

      setTimeout(() => {
        if (isAISpeaking) {
          elements.animationWrapper.classList.add('ai-speaking');
          elements.aiSpeakingAnimation.setSpeed(CONFIG.animation.speeds.speaking);
          elements.aiSpeakingAnimation.play();
        } else {
          elements.animationWrapper.classList.remove('ai-speaking');

          setTimeout(() => {
            if (!state.status.isSpeaking) {
              elements.aiSpeakingAnimation.pause();
            }
          }, CONFIG.animation.transitionDelay);
        }
      }, 10);
    },

    resetAnimationState() {
      elements.animationWrapper.classList.remove('ai-speaking');
      state.status.isSpeaking = false;
      elements.aiSpeakingAnimation.pause();
      elements.aiIdleAnimation.setSpeed(CONFIG.animation.speeds.idle);
      elements.aiIdleAnimation.play();
    }
  };

  // Audio Analyzer
  const audioAnalyzer = {
    createAnalyzer(mediaStream) {
      if (!mediaStream || !state.status.isActive) return null;

      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(mediaStream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = CONFIG.audio.fftSize;
      source.connect(analyser);

      return analyser;
    },

    startMonitoring(analyser, mediaStream) {
      if (!analyser || !mediaStream) return;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const checkAudioLevel = () => {
        if (!state.connection.audioElement ||
            !state.connection.audioElement.srcObject ||
            !state.status.isActive) return;

        analyser.getByteFrequencyData(dataArray);
        const average = Array.from(dataArray).reduce((sum, val) => sum + val, 0) / bufferLength;

        uiController.switchAnimation(average > CONFIG.audio.threshold);

        if (state.connection.peerConnection && state.status.isActive) {
          requestAnimationFrame(checkAudioLevel);
        }
      };

      requestAnimationFrame(checkAudioLevel);
    }
  };

  // WebRTC Connection Handler
  const connectionHandler = {
    async createPeerConnection(token) {
      const pc = new RTCPeerConnection();
      state.connection.peerConnection = pc;

      this.setupAudioElement();
      this.setupTrackHandler(pc);

      return pc;
    },

    setupAudioElement() {
      const audioEl = document.createElement("audio");
      audioEl.autoplay = true;
      document.body.appendChild(audioEl);
      state.connection.audioElement = audioEl;
    },

    setupTrackHandler(pc) {
      pc.ontrack = event => {
        if (!state.status.isActive || !pc) return;

        state.connection.audioElement.srcObject = event.streams[0];
        uiController.updateStatus("AI is ready to talk");

        const analyser = audioAnalyzer.createAnalyzer(event.streams[0]);
        if (analyser) {
          audioAnalyzer.startMonitoring(analyser, event.streams[0]);
        }
      };
    },

    async setupMicrophone(pc) {
      try {
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });

        if (!state.status.isActive || !pc) {
          this.cleanupMicStream(micStream);
          return false;
        }

        state.connection.micStream = micStream;
        micStream.getTracks().forEach(track => pc.addTrack(track, micStream));
        return true;
      } catch (error) {
        console.error('Error accessing microphone:', error);
        uiController.updateStatus(`Microphone error: ${error.message}`);
        return false;
      }
    },

    setupDataChannel(pc) {
      const dc = pc.createDataChannel("oai-events");
      state.connection.dataChannel = dc;

      dc.addEventListener("message", event => {
        const data = JSON.parse(event.data);

        if (data.type === "input_audio_buffer.speech_started") {
          uiController.toggleUserSpeakingIndicator(true);
          uiController.updateStatus("Listening to you...");
        } else if (data.type === "input_audio_buffer.speech_stopped") {
          uiController.toggleUserSpeakingIndicator(false);
          uiController.updateStatus("Processing your request...");
        } else if (data.type === "output_audio_buffer.started") {
          // AI has started speaking - mute the microphone
          this.toggleMicrophone(false);
          uiController.updateStatus("AI is speaking...");
        } else if (data.type === "output_audio_buffer.stopped") {
          // AI has finished speaking - unmute the microphone after a short delay
          setTimeout(() => {
            this.toggleMicrophone(true);
            uiController.updateStatus("AI is listening...");
          }, 500); // 500ms delay to ensure AI has fully finished
        }
      });

      return dc;
    },

    toggleMicrophone(enable) {
      if (state.connection.micStream) {
        state.connection.micStream.getTracks().forEach(track => {
          track.enabled = enable;
        });
      }
    },

    cleanupMicStream(stream = null) {
      const micStream = stream || state.connection.micStream;
      if (micStream) {
        micStream.getTracks().forEach(track => track.stop());
        if (stream !== state.connection.micStream) {
          state.connection.micStream = null;
        }
      }
    },

    async connectToAI(token) {
      const pc = state.connection.peerConnection;
      if (!pc) return false;

      try {
        const offer = await pc.createOffer();

        if (!state.status.isActive || !pc) return false;

        await pc.setLocalDescription(offer);

        const sdpResponse = await fetch(`${CONFIG.api.baseUrl}?model=${CONFIG.api.model}`, {
          method: "POST",
          body: offer.sdp,
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/sdp"
          },
        });

        if (!state.status.isActive || !pc) return false;

        if (!sdpResponse.ok) {
          throw new Error(`Failed to connect: ${sdpResponse.status} ${sdpResponse.statusText}`);
        }

        const answer = {
          type: "answer",
          sdp: await sdpResponse.text(),
        };

        if (pc.signalingState === "have-local-offer") {
          await pc.setRemoteDescription(answer);
          uiController.updateStatus("Connected - I'm listening...");

          // After connection, send session update to reinforce non-interruptible mode
          this.sendSessionUpdate();

          return true;
        } else {
          console.warn("Invalid signaling state for setRemoteDescription:", pc.signalingState);
          return false;
        }
      } catch (error) {
        console.error("WebRTC error:", error);
        uiController.updateStatus(`Connection error: ${error.message}`);
        return false;
      }
    },

    sendSessionUpdate() {
      if (!state.connection.dataChannel || state.connection.dataChannel.readyState !== "open") {
        return;
      }

      // Send a session update to reinforce non-interruptible settings
      const updateMessage = JSON.stringify({
        type: "session.update",
        session: {
          turn_detection: {
            type: "semantic_vad",
            eagerness: "low",
            create_response: true,
            interrupt_response: false
          }
        }
      });

      state.connection.dataChannel.send(updateMessage);
    }
  };

  // Main Controller
  const controller = {
    async fetchSessionToken() {
      try {
        const response = await fetch(CONFIG.api.sessionEndpoint);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(`Server error: ${data.error || response.statusText}`);
        }

        return data.client_secret.value;
      } catch (error) {
        throw new Error(`Failed to get session token: ${error.message}`);
      }
    },

    async startConversation() {
      try {
        state.status.isActive = true;
        uiController.updateStatus("Connecting to AI...");
        uiController.resetAnimationState();

        if (state.connection.peerConnection) {
          this.stopConversation();
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        const token = await this.fetchSessionToken();

        if (!state.status.isActive) return;

        const pc = await connectionHandler.createPeerConnection(token);

        if (!state.status.isActive) {
          this.cleanup();
          return;
        }

        const micSetupSuccess = await connectionHandler.setupMicrophone(pc);
        if (!micSetupSuccess) {
          elements.toggleSwitch.checked = false;
          state.status.isActive = false;
          this.cleanup();
          return;
        }

        connectionHandler.setupDataChannel(pc);

        const connectionSuccess = await connectionHandler.connectToAI(token);
        if (!connectionSuccess) {
          elements.toggleSwitch.checked = false;
          this.stopConversation();
        }
      } catch (error) {
        console.error('Error starting conversation:', error);
        uiController.updateStatus(`Error: ${error.message}`);
        elements.toggleSwitch.checked = false;
        state.status.isActive = false;
        this.cleanup();
      }
    },

    stopConversation() {
      state.status.isActive = false;

      this.cleanup();

      uiController.resetAnimationState();
      uiController.toggleUserSpeakingIndicator(false);
      uiController.updateStatus("ACS AI Voice Assistant");
    },

    cleanup() {
      // Close data channel
      if (state.connection.dataChannel) {
        state.connection.dataChannel.close();
        state.connection.dataChannel = null;
      }

      // Close peer connection
      if (state.connection.peerConnection) {
        state.connection.peerConnection.close();
        state.connection.peerConnection = null;
      }

      // Stop microphone
      connectionHandler.cleanupMicStream();
      state.connection.micStream = null;

      // Stop audio
      if (state.connection.audioElement) {
        state.connection.audioElement.pause();
        state.connection.audioElement.srcObject = null;
      }
    },

    toggleConversation() {
      if (elements.toggleSwitch.checked) {
        this.startConversation();
      } else {
        this.stopConversation();
      }
    },

    init() {
      // Event listeners
      elements.toggleSwitch.addEventListener('change', () => this.toggleConversation());

      // Initialize animations
      document.addEventListener('DOMContentLoaded', () => {
        elements.aiIdleAnimation.addEventListener('ready', () => {
          elements.aiIdleAnimation.setSpeed(CONFIG.animation.speeds.idle);
          elements.aiIdleAnimation.play();
        });

        elements.aiSpeakingAnimation.addEventListener('ready', () => {
          elements.aiSpeakingAnimation.setSpeed(CONFIG.animation.speeds.speaking);
          elements.aiSpeakingAnimation.pause();
        });
      });
    }
  };

  // Initialize the application
  controller.init();
})();