# Clay Integration Guide

## Overview

Send GTM Contact Intelligence data directly to Clay tables via webhooks. This integration automatically formats and pushes LinkedIn intelligence, signals, and GTM playbooks to your Clay enrichment workflows.

---

## Quick Start

### 1. Get Your Clay Webhook URL

1. Log into Clay.com
2. Create or open your table
3. Add "Webhook" as a data source
4. Copy the webhook URL (format: `https://api.clay.com/v3/sources/webhook/pull-in-data-from-a-webhook-XXXXXX`)

### 2. Configure the Integration

Edit `send-to-clay.sh` and set your webhook URL:

```bash
CLAY_WEBHOOK_URL="https://api.clay.com/v3/sources/webhook/pull-in-data-from-a-webhook-YOUR-WEBHOOK-ID"
```

### 3. Send Data to Clay

```bash
# Send single contact
./send-to-clay.sh 1

# Preview data before sending
./send-to-clay.sh preview 1

# Send multiple contacts
./send-to-clay.sh batch 1,2,3
```

---

## Data Sent to Clay

The integration sends **30+ enriched fields** per contact:

### Contact Basics
- `email` - Contact email address
- `full_name` - Full name
- `company_name` - Current company
- `current_title` - Current job title
- `linkedin_url` - LinkedIn profile URL

### LinkedIn Profile Data
- `linkedin_headline` - Profile headline
- `linkedin_location` - Geographic location
- `linkedin_connections` - Number of connections
- `linkedin_followers` - Number of followers
- `linkedin_influence_score` - Calculated influence (0-1)
- `linkedin_tenure_months` - Months in current role
- `linkedin_skills` - Comma-separated skills list

### Top Intelligence Signal
- `top_signal_type` - Type of highest-scoring signal
- `top_signal_description` - Signal description
- `top_signal_score` - Composite score (0-1)
- `top_signal_relevance` - Relevance score (0-1)
- `top_signal_urgency` - Urgency score (0-1)

### GTM Playbook
- `primary_wedge` - Best conversation starter
- `wedge_score` - Wedge effectiveness score
- `recommended_channel` - Best contact channel (email/linkedin dm/phone)
- `recommended_channel_confidence` - Confidence score (0-1)

### LinkedIn Activity
- `recent_post_count` - Number of recent posts
- `recent_post_avg_engagement` - Average engagement per post
- `recent_pain_point` - Most recent pain point mentioned
- `recent_pain_point_date` - When pain point was posted
- `recent_pain_point_engagement` - Engagement on that post

### Actionable Intelligence
- `conversation_starter` - Top conversation opener
- `timing_rationale` - Why to reach out now
- `signal_count` - Total number of signals detected
- `intelligence_updated_at` - When intelligence was generated

---

## API Endpoints

### Send Single Contact

```bash
POST /api/clay/send/:contactId

# Request Body:
{
  "webhookUrl": "https://api.clay.com/v3/sources/webhook/..."
}

# Response:
{
  "success": true,
  "message": "Contact 1 sent to Clay successfully",
  "status": 200,
  "sent_fields": ["email", "full_name", ...]
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/api/clay/send/1 \
  -H "Content-Type: application/json" \
  -d '{
    "webhookUrl": "https://api.clay.com/v3/sources/webhook/pull-in-data-from-a-webhook-YOUR-ID"
  }'
```

### Send Multiple Contacts (Batch)

```bash
POST /api/clay/send-batch

# Request Body:
{
  "contactIds": [1, 2, 3],
  "webhookUrl": "https://api.clay.com/v3/sources/webhook/..."
}

# Response:
{
  "success": true,
  "total": 3,
  "successful": 3,
  "failed": 0,
  "results": [...]
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/api/clay/send-batch \
  -H "Content-Type: application/json" \
  -d '{
    "contactIds": [1, 2, 3],
    "webhookUrl": "https://api.clay.com/v3/sources/webhook/pull-in-data-from-a-webhook-YOUR-ID"
  }'
```

### Preview Data (No Send)

```bash
GET /api/clay/preview/:contactId

# Response:
{
  "contact_id": 1,
  "preview": {
    "email": "jc@uaudio.com",
    "full_name": "JC Haydon",
    ...
  },
  "field_count": 30,
  "fields": ["email", "full_name", ...]
}
```

**Example:**
```bash
curl http://localhost:3000/api/clay/preview/1 | jq .
```

---

## Usage Examples

### Example 1: Send JC Haydon to Clay

```bash
# Preview the data first
./send-to-clay.sh preview 1

# Send to Clay
./send-to-clay.sh 1

# Output:
# ✓ Successfully sent to Clay!
# Data includes:
#   - email
#   - full_name
#   - linkedin_headline
#   - primary_wedge
#   - wedge_score
#   - (30+ fields total)
```

### Example 2: Batch Send Multiple Contacts

```bash
# Send contacts 1, 2, and 3
./send-to-clay.sh batch 1,2,3

# Output:
# ✓ Batch send successful!
# Total: 3
# Successful: 3
# Failed: 0
```

### Example 3: Integration with Chrome Extension Workflow

```bash
# 1. Extract LinkedIn data via Chrome extension
# (Navigate to LinkedIn profile, click extension, extract & submit)

# 2. Immediately send to Clay
./send-to-clay.sh 1

# 3. Data now available in Clay for enrichment!
```

---

## Clay Workflow Setup

### Recommended Clay Table Structure

**Column Setup:**

1. **Email** (Primary Key)
   - Import from webhook: `email`

2. **Full Name**
   - Import from webhook: `full_name`

3. **Company**
   - Import from webhook: `company_name`

4. **LinkedIn Profile**
   - Import from webhook: `linkedin_url`

5. **LinkedIn Headline**
   - Import from webhook: `linkedin_headline`

6. **Connections**
   - Import from webhook: `linkedin_connections`

7. **Influence Score**
   - Import from webhook: `linkedin_influence_score`

8. **Primary Wedge** ⭐
   - Import from webhook: `primary_wedge`

9. **Wedge Score**
   - Import from webhook: `wedge_score`

10. **Recommended Channel** ⭐
    - Import from webhook: `recommended_channel`

11. **Conversation Starter** ⭐
    - Import from webhook: `conversation_starter`

12. **Recent Pain Point** ⭐
    - Import from webhook: `recent_pain_point`

13. **Top Signal**
    - Import from webhook: `top_signal_description`

14. **Timing Rationale** ⭐
    - Import from webhook: `timing_rationale`

### Clay Enrichment Flow

```
1. GTM Intelligence (via webhook)
   ↓
2. Additional Clay enrichments
   - Company info
   - Technographics
   - Social profiles
   ↓
3. Scoring/Filtering
   - Filter by wedge_score > 0.8
   - Filter by recommended_channel = "linkedin dm"
   ↓
4. Outbound Sequences
   - Use conversation_starter for subject line
   - Reference recent_pain_point in message
   - Send via recommended_channel
```

---

## Example Payloads

### JC Haydon Example

```json
{
  "email": "jc@uaudio.com",
  "full_name": "JC Haydon",
  "company_name": "Universal Audio",
  "current_title": "VP of Sales",
  "linkedin_url": "https://www.linkedin.com/in/jchaydon",
  "linkedin_headline": "VP of Sales at Universal Audio | Revenue Operations Leader | GTM Strategy",
  "linkedin_location": "Santa Cruz, California",
  "linkedin_connections": 2847,
  "linkedin_followers": 1250,
  "linkedin_influence_score": "0.85",
  "linkedin_tenure_months": 8,
  "linkedin_skills": "Revenue Operations, Sales Strategy, GTM Planning, Salesforce, Sales Enablement, Forecasting, Pipeline Management",
  "top_signal_type": "linkedin_content",
  "top_signal_description": "Recently discussed challenges in LinkedIn post (5 days ago). Topics: pipeline accuracy, forecasting, Q4 planning",
  "top_signal_score": 0.97,
  "top_signal_relevance": 1,
  "top_signal_urgency": "0.95",
  "primary_wedge": "Recent LinkedIn post discussing pain points",
  "wedge_score": "1.10",
  "recommended_channel": "linkedin dm",
  "recommended_channel_confidence": 0.95,
  "recent_post_count": 5,
  "recent_post_avg_engagement": 84,
  "recent_pain_point": "Just wrapped up Q4 planning with the team. The biggest challenge we're facing is pipeline accuracy and forecast confidence. Anyone else struggling with this? Would love to hear how other RevOps leaders are tackling this problem...",
  "recent_pain_point_date": "2026-01-10T14:30:00.000Z",
  "recent_pain_point_engagement": 60,
  "conversation_starter": "Saw your recent post about pipeline accuracy",
  "timing_rationale": "Posted 5 days ago with 60 engagements - indicates active, shared pain point. Past honeymoon phase - has context to identify gaps and push for changes. 1 high-urgency signals detected - time-sensitive opportunity",
  "intelligence_updated_at": "2026-01-15T23:45:00.000Z",
  "signal_count": 6
}
```

---

## Automation Ideas

### 1. Chrome Extension → Clay (Instant)

```bash
# Add to Chrome extension or create a button
# After successful LinkedIn data extraction:
curl -X POST http://localhost:3000/api/clay/send/$CONTACT_ID \
  -H "Content-Type: application/json" \
  -d '{"webhookUrl": "YOUR_WEBHOOK"}'
```

### 2. Nightly Batch Sync

```bash
#!/bin/bash
# cron: 0 2 * * * /path/to/nightly-clay-sync.sh

# Get all contacts updated in last 24 hours
UPDATED_IDS=$(psql -U postgres -d gtm_intel -t -c "
  SELECT id FROM contacts
  WHERE updated_at > NOW() - INTERVAL '24 hours'
  ORDER BY id
" | tr '\n' ',' | sed 's/,$//')

# Send to Clay
./send-to-clay.sh batch $UPDATED_IDS
```

### 3. Webhook Trigger from API

```bash
# Add to linkedin.js manual-entry endpoint
# After successful LinkedIn data save:

const clayWebhookUrl = process.env.CLAY_WEBHOOK_URL;
if (clayWebhookUrl) {
  await sendToClay(contactId, clayWebhookUrl);
}
```

---

## Troubleshooting

### "Failed to send to Clay"

**Causes:**
- Invalid webhook URL
- Clay webhook disabled or deleted
- Network/firewall issues
- Contact data incomplete

**Solutions:**
```bash
# Test webhook manually
curl -X POST "YOUR_CLAY_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com"}'

# Preview data before sending
./send-to-clay.sh preview 1

# Check API logs
tail -f /tmp/api-server.log
```

### "Contact not found"

```bash
# Verify contact exists
psql -U postgres -d gtm_intel -c "SELECT id, full_name FROM contacts WHERE id = 1;"

# Check contact has data
curl http://localhost:3000/api/clay/preview/1
```

### Clay Not Receiving Data

1. **Check webhook URL** - Copy from Clay, ensure no extra spaces
2. **Test webhook in Clay** - Send test data from Clay interface
3. **Check Clay table permissions** - Ensure webhook is enabled
4. **Review response** - Look for Clay error messages

---

## Rate Limiting

- **Single sends**: No rate limit (immediate)
- **Batch sends**: 500ms delay between contacts (120 contacts/minute max)
- **Clay limits**: Check Clay documentation for webhook rate limits

To adjust batch delay, edit `src/exporters/clay-webhook.js`:

```javascript
// Change this line:
await new Promise(resolve => setTimeout(resolve, 500)); // 500ms

// To (for slower rate):
await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second
```

---

## Best Practices

1. **Preview First**: Always preview data before sending to production Clay table
2. **Test Webhook**: Send test contact to verify webhook is working
3. **Batch Wisely**: Don't send thousands at once, use batches of 50-100
4. **Update Regularly**: Re-send contacts when LinkedIn data is refreshed
5. **Filter in Clay**: Use Clay filters for wedge_score, recommended_channel, etc.

---

## Advanced: Custom Field Mapping

To customize what data is sent to Clay, edit `src/exporters/clay-webhook.js`:

```javascript
// Add custom fields:
return {
  // Existing fields...

  // Custom computed field
  is_high_priority: topSignal?.composite_score > 0.9,

  // Custom formatting
  full_headline: `${linkedinProfile?.profile_headline} | ${linkedinProfile?.location}`,

  // Additional data
  company_size: contact.company_size || 'Unknown'
};
```

---

## Example Clay Table

See `examples/clay-table-template.csv` for a sample Clay table structure optimized for GTM intelligence.

---

## Support

For issues:
- Check API logs: `tail -f /tmp/api-server.log`
- Test webhook: `curl -X POST "YOUR_WEBHOOK" -d '{"test":"data"}'`
- Preview data: `./send-to-clay.sh preview 1`
- Review Clay webhook logs in Clay interface

---

## Next Steps

After setting up Clay integration:

1. **Test with JC Haydon**: `./send-to-clay.sh 1`
2. **Verify in Clay**: Check your Clay table for new row
3. **Set up enrichments**: Add additional Clay enrichments
4. **Create sequences**: Build outbound sequences using the intelligence
5. **Automate**: Set up automatic sync after LinkedIn extractions
