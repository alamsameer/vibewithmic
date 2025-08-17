// Background script - manages extension lifecycle and permissions

chrome.runtime.onInstalled.addListener(() => {
  console.log('Voice Recorder Extension installed');
});

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "audioChannel") {
    port.onMessage.addListener(async (message) => {
      if (message.type === "UPLOAD_AUDIO") {
        console.log("Received audio data:", {
          size: message.size,
          originalSize: message.originalSize,
          mimeType: message.mimeType,
          arrayBufferLength: message.audioArrayBuffer?.byteLength
        });

        try {
          // Validate the received data
          if (!message.audioArrayBuffer) {
            throw new Error("No audio data received");
          }

          if (message.audioArrayBuffer.byteLength === 0) {
            throw new Error("Empty audio data received");
          }

          if (message.audioArrayBuffer.byteLength < 1024) {
            throw new Error("Audio data too small (less than 1KB)");
          }

          // Recreate Blob from ArrayBuffer with exact same type
          const audioBlob = new Blob([message.audioArrayBuffer], { 
            type: message.mimeType || 'audio/webm' 
          });
          
          console.log("Recreated blob:", {
            size: audioBlob.size,
            type: audioBlob.type,
            constructorUsed: audioBlob.constructor.name
          });

          // Double-check the recreated blob
          if (audioBlob.size !== message.audioArrayBuffer.byteLength) {
            console.warn("Blob size mismatch!", {
              expected: message.audioArrayBuffer.byteLength,
              actual: audioBlob.size
            });
          }

          // Upload to server
          const result = await uploadAudioToServer(audioBlob);
          console.log("Upload successful:", result);
          
          port.postMessage({ 
            success: true, 
            ...result 
          });

        } catch (error) {
          console.error("Upload failed:", error);
          port.postMessage({ 
            success: false, 
            error: error.message || "Failed to process audio"
          });
        }
      }
    });

    port.onDisconnect.addListener(() => {
      console.log("Audio channel disconnected");
    });
  }
});

// Function to upload audio to server
async function uploadAudioToServer(audioBlob) {
  console.log('Preparing to upload audio...');
  console.log('Audio Blob type:', audioBlob.type);
  console.log('Audio Blob size:', audioBlob.size);

  // Create FormData with proper file naming
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

  console.log('Uploading audio to server...');
  
  try {
    const response = await fetch('https://vibewithmic-jj36.vercel.app/transcribe', {
      method: 'POST',
      body: formData,
      // Don't set Content-Type header - let browser set it with boundary
    });
    
    console.log('Server response status:', response.status);
    console.log('Server response', response);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Server error response:', errorText);
      throw new Error(`Server error: ${response.status} - ${errorText}`);
    }
    
    const result = await response.json();
    console.log('Server response data:', result);
    
    return result;
    
  } catch (error) {
    console.error('Upload failed:', error);
    
    // Provide more specific error messages
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error('Cannot connect to transcription server. Please ensure the server is running.');
    } else if (error.message.includes('Server error: 400')) {
      throw new Error('Invalid audio file format. Please try recording again.');
    } else if (error.message.includes('Server error: 500')) {
      throw new Error('Server processing error. Please try again.');
    }
    
    throw error;
  }
}

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    function: toggleFloatingMic
  });
});

// Function to be injected
function toggleFloatingMic() {
  const existingMic = document.querySelector('#floating-voice-recorder');
  if (existingMic) {
    existingMic.style.display = existingMic.style.display === 'none' ? 'block' : 'none';
  }
}