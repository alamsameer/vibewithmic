// Popup script for extension control

document.addEventListener('DOMContentLoaded', function() {
  const toggleBtn = document.getElementById('toggleBtn');
  const permissionBtn = document.getElementById('permissionBtn');
  const status = document.getElementById('status');
  
  // Toggle floating microphone visibility
  toggleBtn.addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: toggleFloatingMic
      });
      
      updateStatus('Microphone toggled');
    } catch (error) {
      console.error('Error toggling microphone:', error);
      updateStatus('Error: Could not toggle microphone');
    }
  });
  
  // Request microphone permission
  permissionBtn.addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      const result = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: requestMicrophonePermission
      });
      
      if (result[0].result) {
        updateStatus('Microphone access granted', true);
      } else {
        updateStatus('Microphone access denied');
      }
    } catch (error) {
      console.error('Error requesting permission:', error);
      updateStatus('Error: Could not request permission');
    }
  });
  
  // Update status display
  function updateStatus(message, isActive = false) {
    status.textContent = message;
    status.classList.toggle('active', isActive);
    
    // Reset status after 3 seconds
    setTimeout(() => {
      status.textContent = 'Ready to record';
      status.classList.remove('active');
    }, 3000);
  }
  
  // Check initial state
  checkInitialState();
  
  async function checkInitialState() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      const result = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: checkMicrophoneState
      });
      
      const state = result[0].result;
      if (state.hasPermission) {
        updateStatus('Microphone ready', true);
      } else {
        updateStatus('Click to grant microphone access');
      }
    } catch (error) {
      console.error('Error checking state:', error);
    }
  }
});

// Functions to be injected into the active tab

function toggleFloatingMic() {
  const existingMic = document.querySelector('#floating-voice-recorder');
  if (existingMic) {
    const isVisible = existingMic.style.display !== 'none';
    existingMic.style.display = isVisible ? 'none' : 'block';
    return !isVisible;
  }
  return false;
}

async function requestMicrophonePermission() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(track => track.stop()); // Stop immediately
    return true;
  } catch (error) {
    console.error('Permission denied:', error);
    return false;
  }
}

function checkMicrophoneState() {
  return new Promise(async (resolve) => {
    try {
      // Check if floating mic exists
      const floatingMic = document.querySelector('#floating-voice-recorder');
      const micExists = !!floatingMic;
      
      // Check microphone permission
      let hasPermission = false;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        hasPermission = true;
      } catch (error) {
        hasPermission = false;
      }
      
      resolve({
        micExists,
        hasPermission,
        isVisible: micExists ? floatingMic.style.display !== 'none' : false
      });
    } catch (error) {
      resolve({ micExists: false, hasPermission: false, isVisible: false });
    }
  });
}