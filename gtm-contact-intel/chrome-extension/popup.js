/**
 * LinkedIn Extractor - Popup Script
 * Handles UI interactions and API communication
 */

let extractedData = null;

// DOM elements
const extractBtn = document.getElementById('extractBtn');
const submitBtn = document.getElementById('submitBtn');
const statusEl = document.getElementById('status');
const previewEl = document.getElementById('preview');
const previewContentEl = document.getElementById('previewContent');
const apiUrlInput = document.getElementById('apiUrl');
const contactIdInput = document.getElementById('contactId');

// Load saved settings
chrome.storage.sync.get(['apiUrl'], (result) => {
  if (result.apiUrl) {
    apiUrlInput.value = result.apiUrl;
  }
});

// Extract button click
extractBtn.addEventListener('click', async () => {
  showStatus('🔍 Extracting LinkedIn data...', 'info');
  extractBtn.disabled = true;

  try {
    // Get active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Check if on LinkedIn
    if (!tab.url.includes('linkedin.com')) {
      throw new Error('Please navigate to a LinkedIn profile page');
    }

    // Send message to content script to extract data
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'extractLinkedInData'
    });

    if (response.success) {
      extractedData = response.data;
      showPreview(extractedData);
      showStatus('✅ Data extracted successfully!', 'success');
      submitBtn.classList.remove('hidden');
    } else {
      throw new Error(response.error || 'Extraction failed');
    }

  } catch (error) {
    showStatus('❌ Error: ' + error.message, 'error');
    console.error('Extraction error:', error);
  } finally {
    extractBtn.disabled = false;
  }
});

// Submit button click
submitBtn.addEventListener('click', async () => {
  if (!extractedData) {
    showStatus('❌ No data to submit', 'error');
    return;
  }

  const apiUrl = apiUrlInput.value.trim();
  const contactId = contactIdInput.value.trim();

  // Save API URL
  chrome.storage.sync.set({ apiUrl });

  if (!contactId) {
    showStatus('❌ Please enter a Contact ID', 'error');
    return;
  }

  showStatus('📤 Sending data to API...', 'info');
  submitBtn.disabled = true;

  try {
    const endpoint = `${apiUrl}/api/linkedin/manual-entry/${contactId}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(extractedData)
    });

    const result = await response.json();

    if (response.ok && result.success) {
      showStatus(
        `✅ Success! Saved ${result.results.posts_saved} posts, created ${result.results.signals_created} signals`,
        'success'
      );

      // Clear form after 3 seconds
      setTimeout(() => {
        extractedData = null;
        previewEl.classList.add('hidden');
        submitBtn.classList.add('hidden');
        contactIdInput.value = '';
      }, 3000);

    } else {
      throw new Error(result.message || result.error || 'API error');
    }

  } catch (error) {
    showStatus('❌ API Error: ' + error.message, 'error');
    console.error('Submit error:', error);
  } finally {
    submitBtn.disabled = false;
  }
});

/**
 * Show status message
 */
function showStatus(message, type) {
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
  statusEl.classList.remove('hidden');

  // Auto-hide after 5 seconds for success
  if (type === 'success') {
    setTimeout(() => {
      statusEl.classList.add('hidden');
    }, 5000);
  }
}

/**
 * Show data preview
 */
function showPreview(data) {
  const { profile, posts } = data;

  let html = '<div class="preview-section">';

  // Profile preview
  html += '<div class="preview-item"><strong>Profile:</strong></div>';
  html += `<div class="preview-data">`;
  if (profile.headline) html += `<div>📌 ${profile.headline}</div>`;
  if (profile.location) html += `<div>📍 ${profile.location}</div>`;
  if (profile.connections_count) html += `<div>🤝 ${profile.connections_count.toLocaleString()} connections</div>`;
  if (profile.tenure_months !== null) html += `<div>⏱️ ${profile.tenure_months} months in role</div>`;
  html += `</div>`;

  // Skills preview
  if (profile.skills && profile.skills.length > 0) {
    html += `<div class="preview-item"><strong>Skills (${profile.skills.length}):</strong></div>`;
    html += `<div class="preview-data">${profile.skills.slice(0, 5).join(', ')}${profile.skills.length > 5 ? '...' : ''}</div>`;
  }

  // Posts preview
  html += `<div class="preview-item"><strong>Posts:</strong> ${posts.length} found</div>`;
  posts.forEach((post, i) => {
    if (i < 3) { // Show first 3 posts
      const engagement = (post.likes || 0) + (post.comments || 0) + (post.shares || 0);
      html += `<div class="preview-post">`;
      html += `<div><strong>Post ${i + 1}:</strong> ${engagement} engagements</div>`;
      html += `<div class="preview-text">${post.content.substring(0, 100)}...</div>`;
      html += `</div>`;
    }
  });

  if (posts.length > 3) {
    html += `<div class="preview-item">...and ${posts.length - 3} more posts</div>`;
  }

  html += '</div>';

  previewContentEl.innerHTML = html;
  previewEl.classList.remove('hidden');
}

// API URL change handler
apiUrlInput.addEventListener('change', () => {
  chrome.storage.sync.set({ apiUrl: apiUrlInput.value });
});
