// Content script - handles UI and recording functionality

class FloatingVoiceRecorder {
  constructor() {
    this.isRecording = false;
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.recordingStartTime = null;
    this.recordingTimer = null;
    
    this.init();
  }

  init() {
    this.createFloatingUI();
    this.attachEventListeners();
  }

  createFloatingUI() {
    // Remove existing UI if present
    const existing = document.querySelector('#floating-voice-recorder');
    if (existing) existing.remove();

    const container = document.createElement('div');
    container.id = 'floating-voice-recorder';
    container.innerHTML = `
      <div class="recorder-container">
        <div class="mic-button" id="micButton">
          <svg class="mic-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
            <path d="M17.3 11c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
          </svg>
        </div>
        
        <div class="recording-indicator" id="recordingIndicator">
          <div class="pulse-ring"></div>
          <div class="recording-time" id="recordingTime">00:00</div>
          <button class="stop-button" id="stopButton">⏹</button>
        </div>
        
        <div class="processing-indicator" id="processingIndicator">
          <div class="spinner"></div>
          <span>Processing...</span>
        </div>
        
        <div class="response-display" id="responseDisplay">
          <div class="response-text" id="responseText"></div>
          <button class="close-response" id="closeResponse">✕</button>
        </div>
        
        <div class="drag-handle" id="dragHandle">⋮⋮</div>
      </div>
    `;

    document.body.appendChild(container);
    this.makeFloatingUIDraggable();
  }

  attachEventListeners() {
    const micButton = document.getElementById('micButton');
    const stopButton = document.getElementById('stopButton');
    const closeResponse = document.getElementById('closeResponse');

    micButton.addEventListener('click', () => this.startRecording());
    stopButton.addEventListener('click', () => this.stopRecording());
    closeResponse.addEventListener('click', () => this.hideResponse());
  }

  makeFloatingUIDraggable() {
    const container = document.querySelector('#floating-voice-recorder');
    const handle = document.getElementById('dragHandle');
    let isDragging = false;
    let currentX, currentY, initialX, initialY, xOffset = 0, yOffset = 0;

    handle.addEventListener('mousedown', dragStart);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', dragEnd);

    function dragStart(e) {
      initialX = e.clientX - xOffset;
      initialY = e.clientY - yOffset;
      if (e.target === handle) {
        isDragging = true;
      }
    }

    function drag(e) {
      if (isDragging) {
        e.preventDefault();
        currentX = e.clientX - initialX;
        currentY = e.clientY - initialY;
        xOffset = currentX;
        yOffset = currentY;
        container.style.transform = `translate(${currentX}px, ${currentY}px)`;
      }
    }

    function dragEnd() {
      isDragging = false;
    }
  }

  async startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      });

      this.audioChunks = [];
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        this.processAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      this.mediaRecorder.start(1000); // Collect data every second
      this.isRecording = true;
      this.recordingStartTime = Date.now();
      
      this.showRecordingUI();
      this.startTimer();

    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Microphone access denied or not available');
    }
  }

  stopRecording() {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      this.isRecording = false;
      this.stopTimer();
      this.showProcessingUI();
    }
  }

  startTimer() {
    this.recordingTimer = setInterval(() => {
      const elapsed = Date.now() - this.recordingStartTime;
      const minutes = Math.floor(elapsed / 60000);
      const seconds = Math.floor((elapsed % 60000) / 1000);
      const timeDisplay = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      document.getElementById('recordingTime').textContent = timeDisplay;
    }, 1000);
  }

  stopTimer() {
    if (this.recordingTimer) {
      clearInterval(this.recordingTimer);
      this.recordingTimer = null;
    }
  }

  async processAudio(audioBlob) {
    try {
      // Send to background script to upload
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          { type: 'UPLOAD_AUDIO', audioBlob },
          (response) => {
            if (response.success) {
              resolve(response.data);
            } else {
              reject(new Error(response.error));
            }
          }
        );
      });

      this.showResponse(response);
    } catch (error) {
      console.error('Processing failed:', error);
      this.showResponse({ error: 'Failed to process audio. Please try again.' });
    }
  }

  showRecordingUI() {
    document.getElementById('micButton').style.display = 'none';
    document.getElementById('recordingIndicator').style.display = 'flex';
    document.getElementById('processingIndicator').style.display = 'none';
    document.getElementById('responseDisplay').style.display = 'none';
  }

  showProcessingUI() {
    document.getElementById('micButton').style.display = 'none';
    document.getElementById('recordingIndicator').style.display = 'none';
    document.getElementById('processingIndicator').style.display = 'flex';
    document.getElementById('responseDisplay').style.display = 'none';
  }

  showResponse(response) {
    const responseText = response.error || response.transcription || response.message || 'No response received';
    document.getElementById('responseText').textContent = responseText;
    
    document.getElementById('micButton').style.display = 'none';
    document.getElementById('recordingIndicator').style.display = 'none';
    document.getElementById('processingIndicator').style.display = 'none';
    document.getElementById('responseDisplay').style.display = 'flex';
  }

  hideResponse() {
    document.getElementById('micButton').style.display = 'flex';
    document.getElementById('recordingIndicator').style.display = 'none';
    document.getElementById('processingIndicator').style.display = 'none';
    document.getElementById('responseDisplay').style.display = 'none';
  }
}

// Initialize the floating voice recorder when content script loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new FloatingVoiceRecorder();
  });
} else {
  new FloatingVoiceRecorder();
}