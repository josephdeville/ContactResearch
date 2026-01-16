# LinkedIn Profile Automation

Automated LinkedIn profile scraping system using Puppeteer with intelligent rate limiting and queue management.

## Features

- ✅ **Queue-based processing** - Add hundreds of URLs, process automatically
- ✅ **Rate limiting** - Respects LinkedIn's limits (6s delays, max 10/min)
- ✅ **Auto-retry** - Failed profiles automatically retry up to 3 times
- ✅ **Data extraction** - Profile info, connections, posts, skills
- ✅ **Direct database storage** - Automatically creates contacts and LinkedIn data
- ✅ **Progress tracking** - Monitor queue status and completion

## Installation

1. **Install Puppeteer:**
```bash
npm install puppeteer
```

2. **Create queue table:**
```bash
psql gtm_intelligence < src/db/linkedin-queue-schema.sql
```

3. **Make CLI executable:**
```bash
chmod +x linkedin-automation.js
```

## Quick Start

### 1. Add LinkedIn URLs to Queue

**Single URL:**
```bash
node linkedin-automation.js add https://www.linkedin.com/in/john-doe
```

**Multiple URLs:**
```bash
node linkedin-automation.js add \
  https://www.linkedin.com/in/user1 \
  https://www.linkedin.com/in/user2 \
  https://www.linkedin.com/in/user3
```

**From a file:**
```bash
# Create a file with URLs (one per line)
cat > linkedin-urls.txt <<EOF
https://www.linkedin.com/in/sarah-johnson
https://www.linkedin.com/in/mike-chen
https://www.linkedin.com/in/emma-wilson
EOF

# Add all URLs to queue
node linkedin-automation.js add --file linkedin-urls.txt
```

### 2. Check Queue Status

```bash
node linkedin-automation.js status
```

Output:
```
📊 Queue Status:

  ⏳ pending         15
  ✅ completed        5
  ❌ failed           1

📝 Next profiles to process:
  1. https://www.linkedin.com/in/sarah-johnson
  2. https://www.linkedin.com/in/mike-chen
  3. https://www.linkedin.com/in/emma-wilson
```

### 3. Run Automation

**Process 10 profiles (default):**
```bash
node linkedin-automation.js run
```

**Process specific number:**
```bash
node linkedin-automation.js run --max 50
```

**Run with visible browser (useful for debugging or login):**
```bash
node linkedin-automation.js run --visible
```

**Stop on first error:**
```bash
node linkedin-automation.js run --stop-on-error
```

## Workflow Examples

### Scenario 1: Scrape 100 Target Accounts

```bash
# 1. Prepare list of LinkedIn URLs
cat > targets.txt <<EOF
https://www.linkedin.com/in/vp-sales-acme
https://www.linkedin.com/in/cro-techcorp
# ... 98 more URLs
EOF

# 2. Add to queue
node linkedin-automation.js add --file targets.txt
# ✓ Added: 100

# 3. Check status
node linkedin-automation.js status
# ⏳ pending  100

# 4. Run automation (process 20 at a time)
node linkedin-automation.js run --max 20

# 5. Wait 10 minutes (respect rate limits)
sleep 600

# 6. Process next batch
node linkedin-automation.js run --max 20

# Repeat until queue is empty
```

### Scenario 2: Initial Setup with Login

LinkedIn may require authentication for some profiles:

```bash
# 1. Add test URLs
node linkedin-automation.js add https://www.linkedin.com/in/test-profile

# 2. Run in VISIBLE mode to login manually
node linkedin-automation.js run --visible --max 1

# 3. When browser opens:
#    - Login to LinkedIn manually
#    - Wait for profile to load
#    - Automation will extract data

# 4. After successful login, browser session is saved
#    Future runs can use headless mode

# 5. Process remaining queue in headless mode
node linkedin-automation.js run --max 100
```

### Scenario 3: Continuous Processing

```bash
# Run automation every hour via cron
# Add to crontab: crontab -e

0 * * * * cd /path/to/gtm-contact-intel && node linkedin-automation.js run --max 10

# This processes 10 profiles every hour
# 240 profiles per day while respecting rate limits
```

## Data Extracted

The automation extracts and stores:

**Contact Info:**
- Full name
- Current title
- Current company
- LinkedIn URL

**LinkedIn Activity:**
- Profile headline
- Location
- Connections count
- Skills (top 10)
- About/summary
- Influence score (calculated)

**Recent Posts:**
- Post content
- Timestamp
- Engagement metrics

## Rate Limiting

The system automatically enforces LinkedIn's rate limits:

- **6 second delay** between each profile
- **Max 10 requests per minute**
- **Auto-retry** for rate-limited profiles
- **Exponential backoff** on repeated failures

Example timeline for 100 profiles:
- 100 profiles × 6 seconds = 600 seconds = 10 minutes minimum
- With page load time: ~15-20 minutes total

## Queue Status Meanings

| Status | Emoji | Description |
|--------|-------|-------------|
| `pending` | ⏳ | Waiting to be processed |
| `processing` | ⚙️ | Currently being scraped |
| `completed` | ✅ | Successfully scraped and stored |
| `failed` | ❌ | Failed after 3 attempts |
| `rate_limited` | ⏸️ | Temporarily rate-limited, will retry |

## Error Handling

**Common issues and solutions:**

**1. "Failed to extract profile data - may require login"**
- Run with `--visible` flag
- Login to LinkedIn manually when browser opens
- Resume automation after login

**2. "Rate limited - will retry later"**
- Automation will automatically slow down
- Profile moves back to queue for retry
- Wait 10-15 minutes before rerunning

**3. "Failed after 3 attempts"**
- Check if profile URL is valid
- Profile may be private or deleted
- Review error message in database:
  ```sql
  SELECT linkedin_url, error_message
  FROM linkedin_scrape_queue
  WHERE status = 'failed';
  ```

## Database Schema

Queue table structure:
```sql
linkedin_scrape_queue
├── id (serial)
├── linkedin_url (unique)
├── status (pending|processing|completed|failed|rate_limited)
├── priority (higher = processed first)
├── attempts (retry count)
├── contact_id (linked contact after successful scrape)
├── error_message
└── timestamps (added_at, last_attempt_at, completed_at)
```

## Best Practices

1. **Start small** - Test with 5-10 URLs first
2. **Use priorities** - High-value targets get processed first
3. **Monitor status** - Check queue regularly for failures
4. **Respect limits** - Don't try to circumvent rate limiting
5. **Login proactively** - Run visible mode periodically to maintain session
6. **Batch processing** - Process 10-20 at a time, multiple times per day
7. **Review failed** - Investigate profiles that fail repeatedly

## Integration with Clay

After automation completes, send enriched profiles to Clay:

```bash
# Check how many contacts were created
psql gtm_intelligence -c "SELECT COUNT(*) FROM contacts;"

# Send all contacts to Clay
for id in $(psql gtm_intelligence -t -c "SELECT id FROM contacts ORDER BY id;"); do
  ./send-to-clay.sh $id
  sleep 2
done
```

## Troubleshooting

**Puppeteer installation issues:**
```bash
# Install with specific Chrome version
npm install puppeteer --save

# Or use system Chrome
npm install puppeteer-core --save
```

**Database connection errors:**
```bash
# Make sure PostgreSQL is running
brew services list | grep postgres

# Check config/.env has correct credentials
cat config/.env
```

**Permissions errors:**
```bash
# Make CLI executable
chmod +x linkedin-automation.js

# Make sure database schema is loaded
psql gtm_intelligence < src/db/linkedin-queue-schema.sql
```

## Advanced Usage

**Custom priority for VIP contacts:**
```javascript
// In your code
const automation = require('./src/scrapers/linkedin-automation');

await automation.addToQueue([
  'https://www.linkedin.com/in/vip-contact'
], 100); // High priority
```

**Query queue programmatically:**
```sql
-- Get all completed profiles from last 24 hours
SELECT c.full_name, c.email, c.current_company, q.completed_at
FROM linkedin_scrape_queue q
JOIN contacts c ON c.id = q.contact_id
WHERE q.status = 'completed'
  AND q.completed_at > NOW() - INTERVAL '24 hours'
ORDER BY q.completed_at DESC;
```

## Safety & Ethics

⚠️ **Important Guidelines:**

1. Only scrape public profiles
2. Respect LinkedIn's Terms of Service
3. Use rate limiting (never disable it)
4. Don't scrape personal/private data
5. Use for legitimate business purposes only
6. Consider LinkedIn's Commercial Use Limit

This tool is for GTM research and should be used responsibly.
