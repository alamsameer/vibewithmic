// Background script - manages extension lifecycle and permissions

chrome.runtime.onInstalled.addListener(() => {
  console.log('Voice Recorder Extension installed');
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'UPLOAD_AUDIO') {
    uploadAudioToServer(message.audioBlob)
      .then(response => {
        sendResponse({ success: true, data: response });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep message channel open for async response
  }
});

// Function to upload audio to server
async function uploadAudioToServer(audioBlob) {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'recording.webm');
  console.log('Uploading audio to server...');
  try {
    const response = await fetch('https://vibewithmic-jj36.vercel.app/transcribe', {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Upload failed:', error);
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