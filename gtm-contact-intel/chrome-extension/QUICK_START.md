# Chrome Extension - Quick Start Guide

## 5-Minute Setup

### Step 1: Install (2 minutes)

1. Open Chrome → `chrome://extensions/`
2. Enable "Developer mode" toggle (top-right)
3. Click "Load unpacked"
4. Select folder: `/home/user/ContactResearch/gtm-contact-intel/chrome-extension`
5. Click "Select Folder"
6. Pin extension to toolbar (puzzle icon → pin GTM extension)

✅ Extension installed!

### Step 2: Start API (1 minute)

```bash
cd /home/user/ContactResearch/gtm-contact-intel
npm start
```

✅ API running on http://localhost:3000

### Step 3: Test Extraction (2 minutes)

1. **Navigate**: Go to https://www.linkedin.com/in/jchaydon
2. **Extract**: Click GTM extension icon → "Extract from Current Page"
3. **Review**: See JC Haydon's profile + posts
4. **Submit**: Enter Contact ID: `1` → "Submit to API"
5. **Success**: Green message "Data saved! Created X signals"

✅ Data extracted and submitted!

### Step 4: View Results

```bash
# View contact with LinkedIn data
curl http://localhost:3000/api/contacts/1 | jq .

# View intelligence signals (should show 6+ signals now)
curl http://localhost:3000/api/signals/1 | jq .

# View GTM playbook (should recommend LinkedIn DM)
curl http://localhost:3000/api/playbook/1 | jq .
```

✅ Complete!

---

## What Just Happened?

1. **Extension extracted** from LinkedIn:
   - Profile: headline, location, 2,847 connections, 1,250 followers
   - Posts: 5 recent posts with engagement metrics

2. **API processed** the data:
   - Saved profile to `linkedin_activity` table
   - Saved posts to `linkedin_posts` table
   - Auto-detected topics, sentiment, pain points

3. **Intelligence generated**:
   - Created 3-6 new signals (job change, pain points, influence)
   - Updated wedge score (likely 1.0+)
   - Generated GTM playbook with LinkedIn DM recommendation

---

## Next Steps

### Extract More Contacts

1. Navigate to any LinkedIn profile
2. Click extract → enter contact ID → submit
3. View intelligence for that contact

### Batch Workflow

For multiple contacts:

```bash
# 1. Get contact list
curl http://localhost:3000/api/research | jq '.[] | {id, name, linkedin_url}'

# 2. For each contact:
#    - Open LinkedIn URL in Chrome
#    - Extract and submit via extension
#    - Move to next

# 3. Export all to CSV
curl http://localhost:3000/api/export/csv | jq .
```

### Export to Clay

```bash
# Get Clay-formatted data for contact
curl http://localhost:3000/api/export/clay/1 | jq .

# Copy-paste into Clay table for enrichment
```

---

## Troubleshooting

**Extension not showing up**
→ Refresh `chrome://extensions/` page

**Extraction returns empty**
→ Ensure on `/in/[username]` page, not company or feed

**API submission fails**
→ Check API is running: `curl http://localhost:3000/health`

**No posts extracted**
→ Normal - user may not have public posts

---

## File Reference

```
chrome-extension/
├── manifest.json       # Chrome extension config
├── background.js       # Service worker
├── content.js          # LinkedIn extraction logic
├── popup.html          # UI
├── popup.js            # UI logic
├── css/popup.css       # Styling
└── icons/              # Extension icons
```

---

## Full Documentation

- [Complete Installation Guide](../docs/CHROME_EXTENSION_INSTALL.md)
- [Extension README](./README.md)
- [API Documentation](../docs/API.md)
- [Manual Entry Guide](../docs/LINKEDIN_MANUAL_ENTRY.md)
