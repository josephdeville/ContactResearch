# Chrome Extension Installation Guide

## GTM Contact Intelligence - LinkedIn Data Extractor

This Chrome extension enables one-click extraction of LinkedIn profile and post data directly from LinkedIn pages, automatically submitting it to your GTM Contact Intelligence system.

---

## Prerequisites

1. **Google Chrome** or **Chromium-based browser** (Edge, Brave, Opera, etc.)
2. **GTM Contact Intelligence API** running locally or on a server
3. **LinkedIn account** (must be logged in to extract data)
4. **Contact ID** from your database (obtained via the API or database)

---

## Installation Steps

### 1. Build/Locate Extension Files

The extension files are located in:
```
gtm-contact-intel/chrome-extension/
├── manifest.json
├── background.js
├── content.js
├── popup.html
├── popup.js
├── css/
│   └── popup.css
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

### 2. Load Extension in Chrome

#### Step-by-step:

1. **Open Chrome Extensions Page**
   - Navigate to `chrome://extensions/`
   - Or click the three-dot menu → More Tools → Extensions

2. **Enable Developer Mode**
   - Toggle the "Developer mode" switch in the top-right corner

3. **Load Unpacked Extension**
   - Click "Load unpacked" button
   - Navigate to the `gtm-contact-intel/chrome-extension/` directory
   - Select the folder and click "Select Folder" (or "Open" on Mac)

4. **Verify Installation**
   - You should see "GTM Contact Intelligence - LinkedIn Extractor" in your extensions list
   - The extension icon (blue with "GTM" text) should appear in your Chrome toolbar

5. **Pin Extension (Optional but Recommended)**
   - Click the puzzle piece icon in the Chrome toolbar
   - Find "GTM Contact Intelligence - LinkedIn Extractor"
   - Click the pin icon to keep it visible in the toolbar

---

## Configuration

### Set API URL

1. Click the extension icon in your toolbar
2. In the popup, locate the "API URL" field (default: `http://localhost:3000`)
3. Update if your API is running on a different host/port
4. The URL is saved automatically in Chrome storage

**Production Example:**
```
https://api.yourcompany.com
```

**Local Development:**
```
http://localhost:3000
```

---

## Usage Instructions

### Extract LinkedIn Data

#### Step 1: Navigate to LinkedIn Profile

1. Log in to LinkedIn in your browser
2. Navigate to the target contact's profile page
   - Example: `https://www.linkedin.com/in/jchaydon`
3. Wait for the page to fully load (profile details, recent posts)

#### Step 2: Extract Data

1. Click the GTM extension icon in your toolbar
2. The popup will open showing the extraction interface
3. Click **"Extract from Current Page"** button
4. Wait 2-3 seconds for extraction to complete

#### Step 3: Review Extracted Data

The popup will display:
- **Profile Summary**: Name, headline, location, connections count
- **Recent Posts**: Up to 10 posts with content preview and engagement metrics

Review the data for accuracy. The extension extracts:
- Profile headline
- Location
- Connection count
- Follower count
- Current position tenure (if visible)
- Skills (if on profile page)
- Recent posts (content, engagement, dates)

#### Step 4: Submit to API

1. Enter the **Contact ID** in the input field
   - This is the database ID from your `contacts` table
   - You can find this via: `GET /api/contacts/:contactId`

2. Click **"Submit to API"** button

3. Wait for confirmation:
   - **Success**: Green message with signal count
   - **Error**: Red message with error details

#### Step 5: Verify Submission

After successful submission, verify the data was saved:

```bash
# Get contact dossier
curl http://localhost:3000/api/contacts/:contactId

# Get intelligence signals
curl http://localhost:3000/api/signals/:contactId

# Get GTM playbook
curl http://localhost:3000/api/playbook/:contactId
```

---

## Workflow Example

### Complete Workflow for New Contact

1. **Create Contact Record**
```bash
# Via API or directly in database
INSERT INTO contacts (full_name, email, company_name, linkedin_url)
VALUES ('JC Haydon', 'jc@universalaudio.com', 'Universal Audio', 'https://www.linkedin.com/in/jchaydon')
RETURNING id;
```

2. **Navigate to LinkedIn**
   - Go to `https://www.linkedin.com/in/jchaydon`
   - Ensure you're logged in and can view the profile

3. **Extract Data**
   - Click GTM extension icon
   - Click "Extract from Current Page"
   - Review extracted data

4. **Submit Data**
   - Enter contact ID (from step 1)
   - Click "Submit to API"
   - Wait for success message

5. **View Intelligence**
```bash
# Get complete dossier with LinkedIn intelligence
curl http://localhost:3000/api/contacts/1 | jq .

# Get GTM playbook
curl http://localhost:3000/api/playbook/1 | jq .
```

---

## Data Extracted

### Profile Data
- `linkedin_url`: Full LinkedIn profile URL
- `headline`: Current position/headline
- `location`: Geographic location
- `connections_count`: Number of connections
- `followers_count`: Number of followers
- `current_position_tenure_months`: Months in current role
- `skills`: Array of skills (if visible)
- `certifications`: Array of certifications (if visible)
- `education`: Education information (if visible)

### Post Data (up to 10 recent posts)
- `post_url`: Link to the post
- `post_date`: When the post was published
- `post_content`: Full text content
- `post_type`: Type of post (post, article, share)
- `likes_count`: Number of likes/reactions
- `comments_count`: Number of comments
- `shares_count`: Number of shares
- `engagement_count`: Total engagement (likes + comments + shares)

### Auto-Generated Intelligence

The API automatically creates signals based on extracted data:

1. **Recent Job Change Signal** (if tenure < 6 months)
   - Relevance: 0.95
   - Urgency: 0.95
   - Category: timing_trigger

2. **Pain Point Signal** (if posts mention challenges)
   - Relevance: 0.95
   - Urgency: 0.85-0.95 (based on recency)
   - Category: buying_signal

3. **Influence Signal** (if 500+ connections/followers)
   - Relevance: 0.80
   - Urgency: 0.60
   - Category: thought_leadership

4. **High Engagement Signal** (if avg engagement > 20)
   - Relevance: 0.85
   - Urgency: 0.75
   - Category: thought_leadership

---

## Troubleshooting

### Extension Not Loading

**Problem**: Extension doesn't appear after loading
- **Solution**: Check Chrome console for errors (`chrome://extensions/` → Details → Inspect views: background page)
- **Solution**: Verify all files are present in the directory
- **Solution**: Check manifest.json for syntax errors

### Extraction Returns Empty Data

**Problem**: "Extract from Current Page" returns no data
- **Cause**: Not on a LinkedIn profile page
- **Solution**: Navigate to `linkedin.com/in/[username]` page
- **Cause**: Page not fully loaded
- **Solution**: Wait for page to finish loading, then extract
- **Cause**: LinkedIn changed their HTML structure
- **Solution**: Check browser console for errors, may need to update selectors in `content.js`

### API Submission Fails

**Problem**: "Submit to API" returns error
- **Cause**: API not running
- **Solution**: Start the API server (`npm start` in gtm-contact-intel directory)
- **Cause**: Wrong API URL
- **Solution**: Update API URL in extension popup
- **Cause**: CORS error
- **Solution**: Ensure API has CORS enabled (already configured in server.js)
- **Cause**: Invalid Contact ID
- **Solution**: Verify the contact exists in database

### No Posts Extracted

**Problem**: Profile extracted but no posts
- **Cause**: Contact hasn't posted recently
- **Solution**: Normal - some users don't post publicly
- **Cause**: Posts not visible due to privacy settings
- **Solution**: Normal - respect privacy settings
- **Cause**: Not scrolled to activity section
- **Solution**: Scroll down on LinkedIn to load posts before extracting

### Connection Count Shows as 0

**Problem**: Extraction shows 0 connections
- **Cause**: User has hidden connection count
- **Solution**: Normal - privacy setting, manual entry possible
- **Cause**: HTML structure changed
- **Solution**: Check content.js regex patterns for connection extraction

---

## Permissions Explained

The extension requests these permissions:

- **activeTab**: Access the current LinkedIn tab for data extraction
- **storage**: Save API URL and last extracted data locally
- **host_permissions (linkedin.com)**: Run content script on LinkedIn pages
- **host_permissions (localhost:3000)**: Submit data to local API

**Privacy Note**: This extension:
- Does NOT send data to third parties
- Does NOT track browsing history
- Only accesses LinkedIn pages when you click "Extract"
- Only sends data to YOUR configured API endpoint

---

## Advanced Usage

### Batch Extraction

For multiple contacts:

1. Create a list of LinkedIn URLs and Contact IDs
2. Open first LinkedIn profile
3. Extract and submit
4. Open next profile in new tab
5. Repeat

**Tip**: Use LinkedIn Sales Navigator or Recruiter for bulk profile access.

### Custom API Integration

Update `popup.js` to integrate with your own API:

```javascript
// Line 120-130 in popup.js
const response = await fetch(`${apiUrl}/api/linkedin/manual-entry/${contactId}`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_API_KEY' // Add auth if needed
  },
  body: JSON.stringify(extractedData)
});
```

### Debugging Extraction

To see what data is being extracted:

1. Open LinkedIn profile
2. Right-click → Inspect → Console tab
3. Click extension "Extract" button
4. Check console for logged extraction data

Or manually run in console:
```javascript
// Send message to content script
chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
  chrome.tabs.sendMessage(tabs[0].id, {type: 'EXTRACT_DATA'}, (response) => {
    console.log('Extracted:', response);
  });
});
```

---

## Updating the Extension

When you modify extension code:

1. Make changes to extension files
2. Go to `chrome://extensions/`
3. Click the refresh icon on the extension card
4. Test changes

**Note**: For manifest.json changes, you may need to remove and re-add the extension.

---

## Security Best Practices

1. **Never commit API keys** to the extension code
2. **Use HTTPS** for production API endpoints
3. **Implement authentication** on your API endpoints
4. **Rate limit** the manual entry endpoint (already configured: 100 requests/15min)
5. **Validate Contact IDs** before submission to prevent unauthorized access

---

## Support

For issues or questions:

1. Check troubleshooting section above
2. Review API logs: `tail -f logs/api.log` (if logging configured)
3. Check browser console: F12 → Console tab
4. Check extension background logs: `chrome://extensions/` → Details → Inspect views

---

## What's Next?

After installing the extension:

1. **Test with a known contact** (e.g., JC Haydon from Universal Audio)
2. **Extract and submit their LinkedIn data**
3. **View the generated intelligence signals**
4. **Review the GTM playbook**
5. **Export to Clay** for enrichment

Example test workflow:
```bash
# 1. Start API
cd /home/user/ContactResearch/gtm-contact-intel
npm start

# 2. Navigate to LinkedIn profile in Chrome
# https://www.linkedin.com/in/jchaydon

# 3. Extract via extension (click icon → Extract → Submit)

# 4. View results
curl http://localhost:3000/api/contacts/1 | jq .
curl http://localhost:3000/api/playbook/1 | jq .
curl http://localhost:3000/api/export/clay/1 | jq .
```

---

## Changelog

### Version 1.0.0 (2025-01-15)
- Initial release
- LinkedIn profile extraction
- LinkedIn post extraction (up to 10 recent posts)
- One-click API submission
- Auto-generated intelligence signals
- Chrome storage for API URL persistence
- Badge notifications for submission status
