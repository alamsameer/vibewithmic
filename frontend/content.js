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
    <style>
      #floating-voice-recorder {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      
      .recorder-container {
        background: #2a2a2a;
        border-radius: 20px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
        overflow: hidden;
        min-width: 60px;
        transition: all 0.3s ease;
      }
      
      .mic-button {
        width: 60px;
        height: 60px;
        background: linear-gradient(135deg, #ff6b6b, #ff5252);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s ease;
        margin: 0;
        border: 3px solid #444;
      }
      
      .mic-button:hover {
        transform: scale(1.05);
        box-shadow: 0 4px 16px rgba(255, 107, 107, 0.4);
      }
      
      .mic-icon {
        width: 24px;
        height: 24px;
        color: white;
      }
      

      
      .pulse-ring {
        width: 120px;
        height: 60px;
        margin-bottom: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
      }
      
      .sound-waves {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 2px;
        height: 40px;
      }
      
      .wave-bar {
        width: 3px;
        background: rgba(255, 255, 255, 0.8);
        border-radius: 2px;
        animation: wave 1.5s ease-in-out infinite;
      }
      
      .wave-bar:nth-child(1) { height: 10px; animation-delay: 0s; }
      .wave-bar:nth-child(2) { height: 20px; animation-delay: 0.1s; }
      .wave-bar:nth-child(3) { height: 30px; animation-delay: 0.2s; }
      .wave-bar:nth-child(4) { height: 25px; animation-delay: 0.3s; }
      .wave-bar:nth-child(5) { height: 35px; animation-delay: 0.4s; }
      .wave-bar:nth-child(6) { height: 40px; animation-delay: 0.5s; }
      .wave-bar:nth-child(7) { height: 30px; animation-delay: 0.6s; }
      .wave-bar:nth-child(8) { height: 25px; animation-delay: 0.7s; }
      .wave-bar:nth-child(9) { height: 35px; animation-delay: 0.8s; }
      .wave-bar:nth-child(10) { height: 20px; animation-delay: 0.9s; }
      .wave-bar:nth-child(11) { height: 15px; animation-delay: 1s; }
      .wave-bar:nth-child(12) { height: 25px; animation-delay: 1.1s; }
      .wave-bar:nth-child(13) { height: 30px; animation-delay: 1.2s; }
      .wave-bar:nth-child(14) { height: 20px; animation-delay: 1.3s; }
      .wave-bar:nth-child(15) { height: 10px; animation-delay: 1.4s; }
      
      @keyframes wave {
        0%, 100% { transform: scaleY(0.3); opacity: 0.7; }
        50% { transform: scaleY(1); opacity: 1; }
      }
      
      .recording-time {
        color: white;
        font-weight: 600;
        font-size: 16px;
        margin-bottom: 12px;
        font-family: 'Monaco', 'Menlo', monospace;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
      }
      
      .stop-button {
        background: #ff4444;
        border: none;
        border-radius: 8px;
        color: white;
        padding: 8px 16px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        transition: all 0.2s ease;
      }
      
      .stop-button:hover {
        background: #ff2222;
        transform: translateY(-1px);
      }
      
      .processing-indicator {
        display: none;
        flex-direction: column;
        align-items: center;
        padding: 20px;
        background: #2a2a2a;
        min-width: 180px;
        color: #ccc;
      }
      
      .spinner {
        width: 32px;
        height: 32px;
        border: 3px solid #444;
        border-top: 3px solid #ff6b6b;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin-bottom: 12px;
      }
      
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      
      .response-display {
        display: none;
        background: #2a2a2a;
        min-width: 280px;
        max-width: 400px;
      }
      
      .response-text {
        color: #fff;
        padding: 20px;
        font-size: 14px;
        line-height: 1.4;
        border-left: 3px solid #ff6b6b;
        background: #333;
        margin: 0;
        word-wrap: break-word;
      }
      
      .response-actions {
        display: flex;
        justify-content: space-between;
        padding: 12px 16px;
        background: #2a2a2a;
        border-top: 1px solid #444;
      }
      
      .copy-button, .close-response {
        background: #444;
        border: none;
        border-radius: 6px;
        color: #ccc;
        padding: 8px 12px;
        cursor: pointer;
        font-size: 12px;
        transition: all 0.2s ease;
      }
      
      .copy-button:hover {
        background: #555;
        color: #fff;
      }
      
      .close-response {
        background: #ff4444;
        color: white;
      }
      
      .close-response:hover {
        background: #ff2222;
      }
      
      .drag-handle {
        position: absolute;
        top: 5px;
        left: 5px;
        color: #666;
        cursor: move;
        font-size: 12px;
        user-select: none;
        opacity: 0;
        transition: opacity 0.2s ease;
      }
      
      .recorder-container:hover .drag-handle {
        opacity: 1;
      }
    </style>
    
    <div class="recorder-container">
      <div class="mic-button" id="micButton">
        <svg class="mic-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
          <path d="M17.3 11c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
        </svg>
      </div>
      
      <div class="recording-indicator" id="recordingIndicator">
        <div class="pulse-ring">
          <div class="sound-waves" id="soundWaves">
            <div class="wave-bar"></div>
            <div class="wave-bar"></div>
            <div class="wave-bar"></div>
            <div class="wave-bar"></div>
            <div class="wave-bar"></div>
            <div class="wave-bar"></div>
            <div class="wave-bar"></div>
            <div class="wave-bar"></div>
            <div class="wave-bar"></div>
            <div class="wave-bar"></div>
            <div class="wave-bar"></div>
            <div class="wave-bar"></div>
            <div class="wave-bar"></div>
            <div class="wave-bar"></div>
            <div class="wave-bar"></div>
          </div>
        </div>
        <div class="recording-time" id="recordingTime">00:00</div>
        <button class="stop-button" id="stopButton"></button>
      </div>
      
      <div class="processing-indicator" id="processingIndicator">
        <div class="spinner"></div>
        <span>Processing...</span>
      </div>
      
      <div class="response-display" id="responseDisplay">
        <div class="response-text" id="responseText"></div>
        <div class="response-actions">
          <button class="copy-button" id="copyButton">📋</button>
          <button class="close-response" id="closeResponse">✕ </button>
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
async copyResponse() {
  const responseText = document.getElementById('responseText').textContent;
  if (!responseText) return;

  const copyButton = document.getElementById('copyButton');
  const originalText = copyButton.textContent;

  try {
    // Modern Clipboard API
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(responseText);
      this.showCopyFeedback(copyButton, originalText, true);
    } else {
      // Fallback using Selection API (modern alternative to execCommand)
      if (window.getSelection && document.createRange) {
        const range = document.createRange();
        const tempElement = document.createElement('div');
        tempElement.style.position = 'fixed';
        tempElement.style.left = '-999999px';
        tempElement.style.top = '-999999px';
        tempElement.textContent = responseText;
        document.body.appendChild(tempElement);
        
        range.selectNodeContents(tempElement);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        
        // Use the newer writeText if available, otherwise fall back to execCommand
        const successful = document.execCommand('copy');
        document.body.removeChild(tempElement);
        selection.removeAllRanges();
        
        if (successful) {
          this.showCopyFeedback(copyButton, originalText, true);
        } else {
          throw new Error('Copy command failed');
        }
      } else {
        throw new Error('No copy method available');
      }
    }
  } catch (error) {
    console.error('Failed to copy text:', error);
    this.showCopyFeedback(copyButton, originalText, false);
  }
}

showCopyFeedback(copyButton, originalText, success) {
  if (success) {
    copyButton.textContent = '✓ Copied';
    copyButton.style.background = '#4CAF50';
    copyButton.style.color = 'white';
  } else {
    copyButton.textContent = '✗ Failed';
    copyButton.style.background = '#f44336';
    copyButton.style.color = 'white';
  }
  
  setTimeout(() => {
    copyButton.textContent = originalText;
    copyButton.style.background = '#444';
    copyButton.style.color = '#ccc';
  }, 2000);
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