# Chrome Extension Setup Guide

## Understanding the Key Concepts

### 1. API URL: Where Your Server Runs

**Default: `http://localhost:3000`**

This is the address where your Express API server runs. Think of it as the "phone number" the extension calls to send data.

```
Your Chrome Extension  ──────→  API Server at http://localhost:3000
                                       ↓
                                  PostgreSQL Database
```

**How to verify it's correct:**
```bash
# Terminal 1: Start the server
cd /home/user/ContactResearch/gtm-contact-intel
npm start
# You should see: Server running on port 3000

# Terminal 2: Test the server
curl http://localhost:3000/health
# Should return: {"status":"healthy"}
```

**If server is NOT running on port 3000:**
- Check `config/.env` file - look for `PORT=3000`
- Check if another process is using port 3000: `lsof -i :3000`
- Update extension API URL to match your actual port

---

### 2. Contact ID: The Person's Database Identifier

**A Contact ID is simply the row number (primary key) in your `contacts` table.**

Think of it like this:
```
Database Table: contacts
┌────┬───────────┬───────────────┬──────────────────────────────────────┐
│ id │ full_name │     email     │            linkedin_url              │
├────┼───────────┼───────────────┼──────────────────────────────────────┤
│ 1  │ JC Haydon │ jc@uaudio.com │ https://linkedin.com/in/jchaydon     │
│ 2  │ Jane Doe  │ jane@co.com   │ https://linkedin.com/in/janedoe      │
│ 3  │ John Doe  │ john@co.com   │ https://linkedin.com/in/johndoe      │
└────┴───────────┴───────────────┴──────────────────────────────────────┘
     ↑
     This is the Contact ID you enter in the extension
```

**Why you need it:**
The extension needs to know WHICH contact record to attach the LinkedIn data to.

---

## Step-by-Step Setup

### Step 1: Find or Create a Contact

**Option A: Check existing contacts**
```bash
# See all contacts in database
psql -U postgres -d gtm_intel -c "SELECT id, full_name, linkedin_url FROM contacts;"

# Example output:
# id | full_name |            linkedin_url
# ----+-----------+--------------------------------------
#  1 | JC Haydon | https://www.linkedin.com/in/jchaydon
#
# → Use Contact ID: 1
```

**Option B: Create a new contact**
```bash
# Start the API server first
cd /home/user/ContactResearch/gtm-contact-intel
npm start

# Then create a contact
curl -X POST http://localhost:3000/api/research \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "Jane Smith",
    "linkedin_url": "https://linkedin.com/in/janesmith",
    "email": "jane@company.com",
    "current_company": "Acme Corp",
    "current_title": "VP of Marketing"
  }'

# Response will show:
# { "contact_id": 2, ... }
#
# → Use Contact ID: 2
```

---

### Step 2: Install Chrome Extension

1. **Open Chrome Extensions**
   - Navigate to: `chrome://extensions/`
   - Or menu → More Tools → Extensions

2. **Enable Developer Mode**
   - Toggle switch in top-right corner

3. **Load Extension**
   - Click "Load unpacked"
   - Navigate to: `/home/user/ContactResearch/gtm-contact-intel/chrome-extension/`
   - Click "Select Folder"

4. **Pin Extension**
   - Click puzzle piece icon in Chrome toolbar
   - Find "GTM Contact Intelligence"
   - Click pin icon

✅ Extension installed!

---

### Step 3: Configure Extension

1. **Click the GTM extension icon** in your toolbar

2. **Check the API URL field**
   - Should show: `http://localhost:3000`
   - This is correct if your server runs on port 3000
   - Change it ONLY if your server runs on a different port/host

3. **Test API connection**
   - Make sure server is running: `npm start`
   - Extension will show error if it can't connect

---

### Step 4: Use the Extension

#### Example with JC Haydon (Contact ID: 1)

1. **Start the API server**
   ```bash
   cd /home/user/ContactResearch/gtm-contact-intel
   npm start
   ```

2. **Open LinkedIn profile in Chrome**
   - Go to: `https://www.linkedin.com/in/jchaydon`
   - Wait for page to fully load

3. **Click GTM extension icon**
   - Popup will open

4. **Extract data**
   - Click "Extract from Current Page" button
   - Wait 2-3 seconds
   - You'll see extracted profile + posts

5. **Enter Contact ID**
   - In the "Contact ID" field, type: `1`
   - (Because JC Haydon's database ID is 1)

6. **Submit to API**
   - Click "Submit to API" button
   - Wait for success message: "Data saved! Created X signals"

7. **View results**
   ```bash
   # Get contact with LinkedIn data
   curl http://localhost:3000/api/contacts/1 | jq .

   # Get intelligence signals (should show 6+ now)
   curl http://localhost:3000/api/signals/1 | jq .

   # Get GTM playbook (should recommend LinkedIn DM)
   curl http://localhost:3000/api/playbook/1 | jq .
   ```

---

## Quick Reference

### Current System State

Based on your database:

```
Contact ID: 1
Name: JC Haydon
Email: jc@uaudio.com
LinkedIn: https://www.linkedin.com/in/jchaydon

→ To extract JC's LinkedIn data:
  1. Visit: https://www.linkedin.com/in/jchaydon
  2. Extract
  3. Enter Contact ID: 1
  4. Submit
```

### API Server Commands

```bash
# Start server
cd /home/user/ContactResearch/gtm-contact-intel
npm start

# Check if server is running
curl http://localhost:3000/health

# Stop server
# Press Ctrl+C in the terminal where it's running

# View server logs
# Check terminal where npm start is running
```

### Database Commands

```bash
# List all contacts with IDs
psql -U postgres -d gtm_intel -c "SELECT id, full_name, linkedin_url FROM contacts;"

# Get details for specific contact
psql -U postgres -d gtm_intel -c "SELECT * FROM contacts WHERE id = 1;"

# Check LinkedIn data for contact
psql -U postgres -d gtm_intel -c "SELECT * FROM linkedin_activity WHERE contact_id = 1;"

# Check signals for contact
psql -U postgres -d gtm_intel -c "SELECT signal_type, source, relevance_score FROM intelligence_signals WHERE contact_id = 1;"
```

---

## Common Issues

### "API URL not reachable"
- **Cause**: Server not running
- **Fix**: Run `npm start` in terminal

### "Contact ID not found"
- **Cause**: Contact doesn't exist in database
- **Fix**: Create contact first (see Step 1, Option B above)

### "No data extracted"
- **Cause**: Not on a LinkedIn profile page
- **Fix**: Navigate to `linkedin.com/in/[username]` page

### "Cannot find extension directory"
- **Cause**: Wrong path in Load unpacked
- **Fix**: Navigate to `/home/user/ContactResearch/gtm-contact-intel/chrome-extension/`

---

## Testing Checklist

Use this checklist to verify everything is working:

- [ ] PostgreSQL is running: `sudo service postgresql status`
- [ ] Database exists: `psql -U postgres -l | grep gtm_intel`
- [ ] API server running: `curl http://localhost:3000/health`
- [ ] Contact exists: `psql -U postgres -d gtm_intel -c "SELECT id, full_name FROM contacts;"`
- [ ] Extension installed: Check `chrome://extensions/`
- [ ] Extension pinned: See GTM icon in Chrome toolbar
- [ ] Can extract: Visit LinkedIn profile, click extract, see data
- [ ] Can submit: Enter valid Contact ID, click submit, see success
- [ ] Data saved: `curl http://localhost:3000/api/contacts/1 | jq .`

---

## What Happens After Submission?

When you submit LinkedIn data via the extension:

1. **Data is saved** to these tables:
   - `linkedin_activity` (profile data)
   - `linkedin_posts` (post content + engagement)

2. **Intelligence is generated** automatically:
   - Signal 1: Recent job change (if tenure < 6 months)
   - Signal 2: Pain point mentions (from post analysis)
   - Signal 3: High influence (if 500+ connections)
   - Signal 4: Active poster (if high engagement)

3. **Playbook is created**:
   - Analyzes all signals
   - Identifies best conversation starter (wedge)
   - Recommends contact channel (usually LinkedIn DM)
   - Generates sample outreach message

4. **Ready for export**:
   - Clay format: `GET /api/export/clay/1`
   - CSV format: `GET /api/export/csv?contact_ids=1`

---

## Next Steps

After your first successful extraction:

1. **Review the intelligence**
   ```bash
   curl http://localhost:3000/api/playbook/1 | jq .
   ```

2. **Add more contacts**
   - Create new contact records
   - Extract their LinkedIn data
   - Build your intelligence database

3. **Export for outreach**
   - Use Clay export for enrichment
   - Use CSV export for CRM import
   - Use playbooks for personalized outreach

---

## Need Help?

See these docs:
- [Quick Start](QUICK_START.md) - 5-minute guide
- [Complete Install](../docs/CHROME_EXTENSION_INSTALL.md) - Full guide with troubleshooting
- [API Documentation](../docs/API.md) - All API endpoints
