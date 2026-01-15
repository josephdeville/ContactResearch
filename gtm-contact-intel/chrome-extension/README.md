# GTM Contact Intelligence - Chrome Extension

One-click LinkedIn data extraction for GTM intelligence research.

## Overview

This Chrome extension enables you to extract LinkedIn profile and post data directly from LinkedIn pages with a single click. The extracted data is automatically submitted to your GTM Contact Intelligence API for signal generation and playbook creation.

## Features

- **One-Click Extraction**: Extract profile data and recent posts from any LinkedIn profile page
- **Smart Data Parsing**: Automatically detects topics, sentiment, pain points, and buying signals
- **Direct API Integration**: Submits data directly to your GTM intelligence system
- **Auto-Signal Generation**: Creates intelligence signals based on extracted data
- **Visual Feedback**: Badge notifications show submission status
- **Privacy-Focused**: Only accesses LinkedIn when you click extract, data only goes to your API

## Quick Start

### 1. Install Extension

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right)
3. Click "Load unpacked"
4. Select this directory (`chrome-extension/`)
5. Pin the extension to your toolbar (puzzle icon → pin)

### 2. Configure API

1. Click the extension icon
2. Set API URL (default: `http://localhost:3000`)
3. URL is saved automatically

### 3. Extract Data

1. Navigate to a LinkedIn profile (e.g., `https://www.linkedin.com/in/jchaydon`)
2. Click the GTM extension icon
3. Click "Extract from Current Page"
4. Review the extracted data
5. Enter the Contact ID from your database
6. Click "Submit to API"
7. Wait for success confirmation

## Extension Files

```
chrome-extension/
├── manifest.json           # Extension configuration (Manifest V3)
├── background.js          # Service worker (lifecycle events, messaging)
├── content.js             # LinkedIn page data extraction logic
├── popup.html             # Extension popup UI
├── popup.js               # Popup interaction logic
├── generate_icons.py      # Icon generation script
├── css/
│   └── popup.css         # Popup styling
├── icons/
│   ├── icon16.png        # 16x16 toolbar icon
│   ├── icon48.png        # 48x48 extension manager icon
│   └── icon128.png       # 128x128 Chrome Web Store icon
└── README.md             # This file
```

## Extracted Data

### Profile Information
- LinkedIn URL
- Headline (current position)
- Location
- Connection count
- Follower count
- Current position tenure (months)
- Skills (if visible)
- Certifications (if visible)
- Education (if visible)

### Recent Posts (up to 10)
- Post URL
- Post date
- Post content
- Post type (post/article/share)
- Likes count
- Comments count
- Shares count
- Total engagement
- Auto-detected topics
- Sentiment analysis
- Pain point detection
- Buying signal detection

## How It Works

### Architecture

1. **Content Script** (`content.js`)
   - Runs on all LinkedIn pages
   - Extracts profile and post data from DOM
   - Sends data to popup via Chrome messaging

2. **Popup** (`popup.html`, `popup.js`)
   - User interface for extraction and submission
   - Displays extracted data preview
   - Submits to API endpoint

3. **Background Worker** (`background.js`)
   - Handles extension lifecycle
   - Manages cross-component messaging
   - Updates badge notifications

### Data Flow

```
LinkedIn Page
    ↓
Content Script (extracts DOM data)
    ↓
Chrome Storage (temporary)
    ↓
Popup UI (user review)
    ↓
API POST /api/linkedin/manual-entry/:contactId
    ↓
Database (postgres)
    ↓
Signal Generation (automatic)
    ↓
GTM Playbook (automatic)
```

## API Integration

### Endpoint

```
POST /api/linkedin/manual-entry/:contactId
```

### Request Format

```json
{
  "profile": {
    "linkedin_url": "https://www.linkedin.com/in/jchaydon",
    "headline": "SVP of Marketing at Universal Audio",
    "location": "San Francisco Bay Area",
    "connections_count": 2847,
    "followers_count": 1250,
    "tenure_months": 18,
    "skills": ["Marketing", "Product Marketing", "GTM Strategy"],
    "certifications": [],
    "education": null
  },
  "posts": [
    {
      "url": "https://linkedin.com/posts/...",
      "date": "2025-01-10",
      "content": "Excited to share...",
      "type": "post",
      "likes": 45,
      "comments": 12,
      "shares": 3,
      "engagement_count": 60
    }
  ]
}
```

### Response Format

```json
{
  "success": true,
  "message": "LinkedIn data saved successfully",
  "results": {
    "profile_saved": true,
    "posts_saved": 5,
    "signals_created": 3
  }
}
```

## Auto-Generated Signals

Based on extracted data, the API automatically creates:

1. **Recent Job Change** (if tenure < 6 months)
   - Category: timing_trigger
   - Relevance: 0.95, Urgency: 0.95

2. **Pain Point Mentions** (if posts contain challenges)
   - Category: buying_signal
   - Relevance: 0.95, Urgency: 0.85-0.95

3. **High Influence** (if 500+ connections/followers)
   - Category: thought_leadership
   - Relevance: 0.80, Urgency: 0.60

4. **Active Poster** (if avg engagement > 20)
   - Category: thought_leadership
   - Relevance: 0.85, Urgency: 0.75

## Testing

### Prerequisites

1. API server running:
```bash
cd /home/user/ContactResearch/gtm-contact-intel
npm start
```

2. Contact record exists:
```sql
SELECT id, full_name FROM contacts WHERE full_name = 'JC Haydon';
```

### Test Workflow

1. **Navigate**: Go to https://www.linkedin.com/in/jchaydon
2. **Extract**: Click extension icon → "Extract from Current Page"
3. **Review**: Check extracted profile and posts
4. **Submit**: Enter contact ID → "Submit to API"
5. **Verify**: Check for success message

### Verification

```bash
# Get contact with LinkedIn data
curl http://localhost:3000/api/contacts/1 | jq .

# Get generated signals
curl http://localhost:3000/api/signals/1 | jq .

# Get GTM playbook
curl http://localhost:3000/api/playbook/1 | jq .
```

## Troubleshooting

### Extension not loading
- Check `chrome://extensions/` for errors
- Verify all files present in directory
- Inspect background page for console errors

### No data extracted
- Ensure on LinkedIn profile page (`/in/[username]`)
- Wait for page to fully load
- Check browser console (F12) for errors
- LinkedIn may have changed HTML structure

### API submission fails
- Verify API is running (`curl http://localhost:3000/health`)
- Check API URL in extension popup
- Verify contact ID exists in database
- Check CORS is enabled (already configured)

### Posts not extracted
- User may not have recent posts
- Privacy settings may hide posts
- Scroll to activity section before extracting

## Security

- **No third-party data sharing**: All data goes to YOUR API only
- **Minimal permissions**: Only accesses LinkedIn and your API
- **No tracking**: Extension doesn't track browsing history
- **On-demand only**: Only extracts when you click the button

### Production Deployment

For production use:

1. **Use HTTPS** for API endpoint
2. **Add authentication** to API calls (modify popup.js)
3. **Rate limiting** already configured (100 req/15min)
4. **Publish to Chrome Web Store** (requires developer account)

## Development

### Modifying Extraction Logic

Edit `content.js` to change what data is extracted:

```javascript
function extractProfile() {
  return {
    linkedin_url: window.location.href.split('?')[0],
    headline: document.querySelector('.text-body-medium')?.textContent.trim(),
    // Add more fields...
  };
}
```

### Updating UI

Edit `popup.html` and `popup.css` to modify the interface.

### Changing API Endpoint

Edit `popup.js` line ~120:

```javascript
const response = await fetch(`${apiUrl}/api/linkedin/manual-entry/${contactId}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(extractedData)
});
```

## Performance

- **Extraction**: < 1 second
- **API submission**: 1-2 seconds (depends on network)
- **Signal generation**: Automatic, happens server-side
- **Memory usage**: ~5MB (minimal)

## Limitations

- Requires active LinkedIn login
- Respects LinkedIn privacy settings (can't extract hidden data)
- Post extraction limited to what's visible on profile page (~10 posts)
- Connection count may be hidden by user settings
- Skills/certifications only visible if on profile page section

## Future Enhancements

Potential improvements:

1. **Batch extraction** - Extract multiple profiles in sequence
2. **Company extraction** - Extract company page data
3. **Advanced filtering** - Filter posts by date range or keywords
4. **Export options** - Save extracted data as JSON/CSV
5. **Scheduled extraction** - Auto-extract on profile visit
6. **LinkedIn Learning** - Extract completed courses

## Documentation

For complete documentation, see:
- [Installation Guide](../docs/CHROME_EXTENSION_INSTALL.md)
- [API Documentation](../docs/API.md)
- [Manual Entry Guide](../docs/LINKEDIN_MANUAL_ENTRY.md)

## Support

For issues:
1. Check troubleshooting section above
2. Review browser console for errors (F12)
3. Check extension background logs (chrome://extensions → Details → Inspect)
4. Verify API logs for errors

## Version

**Version**: 1.0.0
**Manifest**: V3
**Last Updated**: 2025-01-15

## License

Internal tool for GTM Contact Intelligence system.
