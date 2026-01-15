/**
 * GTM Contact Intelligence - Background Service Worker
 * Handles extension lifecycle events and cross-component messaging
 */

// Extension installation handler
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('GTM Contact Intelligence extension installed successfully');

    // Set default API URL in storage
    chrome.storage.local.set({
      apiUrl: 'http://localhost:3000'
    });
  } else if (details.reason === 'update') {
    console.log('GTM Contact Intelligence extension updated to version', chrome.runtime.getManifest().version);
  }
});

// Message handler for communication between content script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request.type);

  switch (request.type) {
    case 'PROFILE_EXTRACTED':
      // Profile data extracted from LinkedIn page
      console.log('Profile extracted for:', request.data?.profile?.headline);
      // Store in chrome.storage for popup to access
      chrome.storage.local.set({
        lastExtractedData: request.data,
        lastExtractedUrl: sender.tab?.url,
        lastExtractedTime: new Date().toISOString()
      });
      sendResponse({ success: true });
      break;

    case 'SUBMISSION_STATUS':
      // Update badge based on submission status
      if (request.status === 'success') {
        chrome.action.setBadgeText({ text: '✓', tabId: sender.tab?.id });
        chrome.action.setBadgeBackgroundColor({ color: '#28a745', tabId: sender.tab?.id });

        // Clear badge after 3 seconds
        setTimeout(() => {
          chrome.action.setBadgeText({ text: '', tabId: sender.tab?.id });
        }, 3000);
      } else if (request.status === 'error') {
        chrome.action.setBadgeText({ text: '!', tabId: sender.tab?.id });
        chrome.action.setBadgeBackgroundColor({ color: '#dc3545', tabId: sender.tab?.id });
      }
      sendResponse({ success: true });
      break;

    case 'GET_TAB_INFO':
      // Send current tab info back to requester
      if (sender.tab) {
        sendResponse({
          tabId: sender.tab.id,
          url: sender.tab.url,
          title: sender.tab.title
        });
      }
      break;

    default:
      console.warn('Unknown message type:', request.type);
      sendResponse({ success: false, error: 'Unknown message type' });
  }

  // Return true to indicate async response
  return true;
});

// Tab update listener - detect LinkedIn profile pages
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url?.includes('linkedin.com/in/')) {
    console.log('LinkedIn profile page detected:', tab.url);
    // Could update badge or show notification here
  }
});

// Error handler
self.addEventListener('error', (event) => {
  console.error('Background service worker error:', event.error);
});

// Unhandled rejection handler
self.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection in background:', event.reason);
});

console.log('GTM Contact Intelligence background service worker initialized');
