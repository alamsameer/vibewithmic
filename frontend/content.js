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
          <div class="response-actions">
            <button class="copy-button" id="copyButton">📋</button>
            <button class="close-response" id="closeResponse">✕</button>
          </div>
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
    const copyButton = document.getElementById('copyButton');


    micButton.addEventListener('click', () => this.startRecording());
    stopButton.addEventListener('click', () => this.stopRecording());
    closeResponse.addEventListener('click', () => this.hideResponse());
    copyButton.addEventListener('click', () => this.copyResponse());
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
          sampleRate: 44100,
          channelCount: 1
        }
      });

      this.audioChunks = [];
      
      // Try different MIME types for better compatibility
      let mimeType = '';
      const supportedTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
        'audio/wav'
      ];

      for (const type of supportedTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          mimeType = type;
          console.log("Using MIME type:", mimeType);
          break;
        }
      }

      if (!mimeType) {
        console.warn("No supported MIME type found, using default");
      }

      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: mimeType || undefined,
        bitsPerSecond: 128000 // 128 kbps
      });

      this.mediaRecorder.ondataavailable = (event) => {
        console.log('Audio chunk received:', {
          size: event.data.size,
          type: event.data.type,
          timestamp: Date.now()
        });
        
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        console.log("MediaRecorder stopped, chunks:", this.audioChunks.length);
        
        if (this.audioChunks.length === 0) {
          console.error("No audio chunks captured!");
          this.showResponse({ error: "No audio was recorded. Please try again." });
          return;
        }

        // Calculate total size
        const totalSize = this.audioChunks.reduce((sum, chunk) => sum + chunk.size, 0);
        console.log("Total audio size from chunks:", totalSize, "bytes");

        const audioBlob = new Blob(this.audioChunks, { 
          type: this.mediaRecorder.mimeType || mimeType || 'audio/webm' 
        });

        console.log("Final blob created:", {
          size: audioBlob.size,
          type: audioBlob.type,
          expectedSize: totalSize
        });

        // Ensure minimum recording length
        if (audioBlob.size < 2048) { // Increased minimum to 2KB
          console.error("Audio too small:", audioBlob.size, "bytes");
          this.showResponse({ error: "Recording too short or empty. Please record for at least 2 seconds." });
          return;
        }

        this.processAudio(audioBlob);
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      this.mediaRecorder.onerror = (event) => {
        console.error("MediaRecorder error:", event.error);
        this.showResponse({ error: "Recording failed: " + event.error.message });
      };

      // Start recording - collect data more frequently for better capture
      this.mediaRecorder.start(250); // Collect data every 250ms
      this.isRecording = true;
      this.recordingStartTime = Date.now();
      
      console.log("Recording started with:", {
        mimeType: this.mediaRecorder.mimeType,
        state: this.mediaRecorder.state
      });
      
      this.showRecordingUI();
      this.startTimer();

    } catch (error) {
      console.error('Error starting recording:', error);
      this.showResponse({ error: 'Microphone access denied or not available: ' + error.message });
    }
  }

  stopRecording() {
    if (this.mediaRecorder && this.isRecording) {
      // Ensure we have recorded for at least 1 second
      const recordingDuration = Date.now() - this.recordingStartTime;
      if (recordingDuration < 1000) {
        this.showResponse({ error: "Please record for at least 1 second." });
        this.mediaRecorder.stop();
        this.isRecording = false;
        this.stopTimer();
        return;
      }

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
      console.log("Processing audio... sending to background js");
      console.log("Original blob size:", audioBlob.size, "bytes");
      console.log("Original blob type:", audioBlob.type);

      // Check if Chrome extension APIs are available
      if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.connect) {
        console.error("Chrome extension APIs not available");
        this.showResponse({ error: "Extension APIs not available. Please reload the page and try again." });
        return;
      }

      // Open a persistent port with error handling
      let port;
      try {
        port = chrome.runtime.connect({ name: "audioChannel" });
      } catch (connectError) {
        console.error("Failed to connect to background script:", connectError);
        this.showResponse({ error: "Failed to connect to extension background. Please reload the page." });
        return;
      }

      // Handle port disconnection
      port.onDisconnect.addListener(() => {
        console.log("Port disconnected");
        if (chrome.runtime.lastError) {
          console.error("Port disconnect error:", chrome.runtime.lastError);
          this.showResponse({ error: "Connection lost. Please try again." });
        }
      });

      // Listen for messages coming back from background
      port.onMessage.addListener((msg) => {
        console.log("Response from background:", msg);
        this.showResponse(msg);
      });

    // fine  till here it  is  working fine   i can hear  the   audio  when downkloaded
    const formData = new FormData();
      // Determine file extension based on MIME type
  let extension = 'webm';
  if (audioBlob.type.includes('mp4')) {
    extension = 'mp4';
  } else if (audioBlob.type.includes('wav')) {
    extension = 'wav';
  } else if (audioBlob.type.includes('ogg')) {
    extension = 'ogg';
  }
  
  const filename = `recording_${Date.now()}.${extension}`;
  console.log('Using filename:', filename);
  
  formData.append("file", audioBlob, filename);
    try {
    const response = await fetch('https://vibewithmic-jj36.vercel.app/transcribe', {
      method: 'POST',
      body: formData,
      // Don't set Content-Type header - let browser set it with boundary
    });

    console.log("Server response:", response);
    if (!response.ok) {
        const errorText = await response.text();
        console.error('Server error response:', errorText);
        this.showResponse({ error: `Server error: ${response.status} - ${errorText}` });
        return;
        }
        const result = await response.json();   
        console.log("Transcription result:", result);
        this.showResponse(result);
}catch (error) {
        console.error("Processing failed:", error);
        this.showResponse({ error: "Failed to process audio. Please try again." });
        return;
        }
    } catch (error) {
      console.error("Processing failed:", error);
      this.showResponse({ error: "Failed to process audio. Please try again." });
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
  copyResponse() {
  const responseText = document.getElementById('responseText').textContent;
  if (responseText) {
    navigator.clipboard.writeText(responseText).then(() => {
      // Visual feedback
      const copyButton = document.getElementById('copyButton');
      const originalText = copyButton.textContent;
      copyButton.textContent = '✓';
      setTimeout(() => {
        copyButton.textContent = originalText;
      }, 1000);
    }).catch(err => {
      console.error('Failed to copy text: ', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = responseText;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    });
  }
}
}

// Initialize the floating voice recorder when content script loads
function initializeRecorder() {
  // Check if we're in a proper web page context
  if (typeof chrome === 'undefined' || !chrome.runtime) {
    console.error("Chrome extension APIs not available. Content script may not be properly loaded.");
    return;
  }

  // Check if already initialized
  if (window.voiceRecorderInstance) {
    console.log("Voice recorder already initialized");
    return;
  }

  try {
    window.voiceRecorderInstance = new FloatingVoiceRecorder();
    console.log("Voice recorder initialized successfully");
  } catch (error) {
    console.error("Failed to initialize voice recorder:", error);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeRecorder);
} else {
  initializeRecorder();
}