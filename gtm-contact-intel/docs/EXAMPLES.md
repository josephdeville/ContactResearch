# Usage Examples

Real-world examples and workflows for the GTM Contact Intelligence System.

## Table of Contents

- [Basic Workflows](#basic-workflows)
- [LinkedIn-Focused Research](#linkedin-focused-research)
- [Clay Integration](#clay-integration)
- [Bulk Processing](#bulk-processing)
- [Advanced Use Cases](#advanced-use-cases)
- [Scripts & Automation](#scripts--automation)

---

## Basic Workflows

### Example 1: Research a Single Contact

**Scenario**: You found a prospect on LinkedIn and want deep intelligence before outreach.

```bash
# 1. Start research
curl -X POST http://localhost:3000/api/research \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "Sarah Johnson",
    "linkedin_url": "https://linkedin.com/in/sarahjohnson",
    "email": "sarah@techcorp.com",
    "current_company": "TechCorp",
    "current_title": "Director of Revenue Operations",
    "company_domain": "techcorp.com"
  }'

# Response:
{
  "job_id": 1,
  "contact_id": 1,
  "status": "pending",
  "estimated_time": "3-5 minutes"
}

# 2. Wait 3-5 minutes, then check status
curl http://localhost:3000/api/research/1

# 3. Get complete dossier
curl http://localhost:3000/api/contacts/1 | jq '.'

# 4. Get GTM playbook
curl http://localhost:3000/api/playbook/1 | jq '.playbook.sample_outreach'
```

**Output**:
- LinkedIn profile with influence score
- 12 recent LinkedIn posts analyzed
- 3 high-priority intelligence signals
- GTM playbook with personalized outreach
- Recommended channel: LinkedIn DM (95% confidence)

---

### Example 2: High-Intent Prospect Identification

**Scenario**: Find contacts who recently posted about pain points.

```bash
# Get all signals
curl http://localhost:3000/api/signals/1 | jq '.signals[] | select(.signal_category == "buying_signal")'

# Example output:
{
  "signal_type": "linkedin_content",
  "signal_category": "buying_signal",
  "description": "Recently discussed challenges: pipeline accuracy, forecasting. Posted 3 days ago with 45 engagements.",
  "relevance_score": 0.95,
  "urgency_score": 0.95,
  "wedge_potential": 0.95
}

# Get the LinkedIn post that triggered this
curl http://localhost:3000/api/linkedin/recent-activity/1 | jq '.posts[0]'
```

**Use Case**: Prioritize outreach to contacts with active pain points.

---

## LinkedIn-Focused Research

### Example 3: Analyze LinkedIn Posting Patterns

**Scenario**: Understand a prospect's LinkedIn activity before engaging.

```bash
# Get engagement patterns
curl http://localhost:3000/api/linkedin/engagement-patterns/1

# Response shows:
{
  "patterns": {
    "posting_frequency": 12,
    "avg_engagement_per_post": 28,
    "high_engagement_posts": 3,
    "posts_with_pain_points": 2,
    "posts_with_buying_signals": 1,
    "top_topics": [
      {"topic": "revenue operations", "count": 8},
      {"topic": "forecasting", "count": 5}
    ],
    "sentiment_distribution": {
      "positive": 6,
      "neutral": 5,
      "negative": 1
    },
    "influence_level": "high"
  }
}
```

**Insights**:
- Active poster (12 posts/month)
- High engagement (28 avg per post)
- Primary topics: RevOps, forecasting
- 2 posts mentioned pain points
- High influence level

**Action**: Engage on their next RevOps post with thoughtful comment, then DM.

---

### Example 4: New Job Transition Outreach

**Scenario**: Find contacts who recently changed jobs (optimal timing window).

```bash
# Check LinkedIn profile for tenure
curl http://localhost:3000/api/contacts/1 | jq '.linkedin_activity.profile | {
  tenure_months: .current_position_tenure_months,
  company: .profile_headline
}'

# Get timing-based signals
curl http://localhost:3000/api/signals/1 | jq '.signals[] | select(.signal_type == "linkedin_profile_change")'

# Example:
{
  "signal_type": "linkedin_profile_change",
  "signal_category": "timing_trigger",
  "description": "8 months into current role - past honeymoon phase, likely evaluating tools",
  "urgency_score": 0.75,
  "wedge_potential": 0.85
}
```

**Optimal Windows**:
- **< 6 months**: "Getting settled, what are you prioritizing?"
- **6-12 months**: "What gaps have you identified?"
- **12+ months**: Use different wedge (not job change)

---

## Clay Integration

### Example 5: Enrich Clay Table with LinkedIn Intelligence

**Workflow**: Upload LinkedIn URLs to Clay, enrich with intelligence.

**Step 1**: Export contacts from Clay with LinkedIn URLs

**Step 2**: Batch research via API

```bash
# Create contacts array
CONTACTS='[
  {"full_name": "Sarah Johnson", "linkedin_url": "https://linkedin.com/in/sarahjohnson"},
  {"full_name": "Mike Chen", "linkedin_url": "https://linkedin.com/in/mikechen"},
  {"full_name": "Emma Davis", "linkedin_url": "https://linkedin.com/in/emmadavis"}
]'

# Start research jobs (run in parallel)
echo $CONTACTS | jq -c '.[]' | while read contact; do
  curl -X POST http://localhost:3000/api/research \
    -H "Content-Type: application/json" \
    -d "$contact" &
done

# Wait for completion (5-10 minutes)
sleep 300

# Export to Clay format
curl "http://localhost:3000/api/export/csv?contact_ids=1,2,3&format=default" > clay_enrichment.csv
```

**Step 3**: Import CSV back into Clay

Clay columns created:
- `linkedin_influence_score`
- `linkedin_last_post_topic`
- `linkedin_mentions_pain_points`
- `top_signal_1`
- `primary_wedge`
- `contact_readiness_score`

**Step 4**: Filter Clay table by `is_high_priority = true`

---

### Example 6: Clay API Integration (Webhook)

**Scenario**: Automatically enrich new Clay table rows.

**Clay HTTP API Column Configuration**:

```
POST https://your-gtm-intel.com/api/research

Body:
{
  "full_name": "{{column_name}}",
  "linkedin_url": "{{column_linkedin_url}}",
  "current_company": "{{column_company}}",
  "current_title": "{{column_title}}"
}

Wait for job completion, then:
GET https://your-gtm-intel.com/api/export/clay/{{contact_id}}
```

---

## Bulk Processing

### Example 7: Process Account List

**Scenario**: SDR manager has list of 50 target accounts with key contacts.

**accounts.csv**:
```csv
name,linkedin_url,email,company,title,domain
Sarah Johnson,https://linkedin.com/in/sarahjohnson,sarah@techcorp.com,TechCorp,Director of RevOps,techcorp.com
Mike Chen,https://linkedin.com/in/mikechen,mike@salesinc.com,SalesInc,VP of Sales,salesinc.com
```

**Bulk research script**:

```bash
#!/bin/bash

# Read CSV and process each contact
tail -n +2 accounts.csv | while IFS=, read -r name linkedin email company title domain; do
  echo "Processing: $name"

  curl -X POST http://localhost:3000/api/research \
    -H "Content-Type: application/json" \
    -d "{
      \"full_name\": \"$name\",
      \"linkedin_url\": \"$linkedin\",
      \"email\": \"$email\",
      \"current_company\": \"$company\",
      \"current_title\": \"$title\",
      \"company_domain\": \"$domain\"
    }" \
    -s | jq -r '.contact_id' >> contact_ids.txt

  # Rate limit: 1 per second to avoid overwhelming system
  sleep 1
done

# Wait for all jobs to complete (estimate: 50 contacts * 4 min = 200 min)
echo "Research started for $(wc -l contact_ids.txt) contacts"
echo "Estimated completion: ~3 hours"
```

**After completion, export all**:

```bash
# Get all contact IDs
CONTACT_IDS=$(cat contact_ids.txt | tr '\n' ',' | sed 's/,$//')

# Export to CSV
curl "http://localhost:3000/api/export/csv?contact_ids=$CONTACT_IDS&format=playbook" \
  > account_playbooks.csv

# Open in Excel/Sheets for review
```

---

### Example 8: High-Priority Daily Digest

**Scenario**: Every morning, get list of contacts who posted about pain points yesterday.

**Script (`daily_digest.sh`)**:

```bash
#!/bin/bash

# Get all contacts with recent LinkedIn activity
YESTERDAY=$(date -d "yesterday" +%Y-%m-%d)

# Query would need custom endpoint, but concept:
# Find contacts with posts in last 24h that mention pain points

# For now, manual approach:
# 1. Get all your contact IDs from your database
# 2. Check each for recent activity

CONTACT_IDS="1,2,3,4,5,6,7,8,9,10"  # Your tracked contacts

curl "http://localhost:3000/api/export/csv?contact_ids=$CONTACT_IDS&format=high_priority" \
  > daily_digest_$(date +%Y%m%d).csv

# Email to team
echo "High priority contacts for today" | \
  mail -s "GTM Intel Daily Digest" \
  -a daily_digest_$(date +%Y%m%d).csv \
  sales-team@company.com
```

**Cron job**:
```bash
# Run at 8 AM daily
0 8 * * * /home/gtm-intel/daily_digest.sh
```

---

## Advanced Use Cases

### Example 9: Technical Buyer Identification

**Scenario**: Find prospects who are technical evaluators (GitHub + LinkedIn).

```bash
# Get contact with both LinkedIn and GitHub activity
curl http://localhost:3000/api/contacts/1 | jq '{
  name: .contact.full_name,
  linkedin_posts: .linkedin_activity.recent_posts | length,
  github_active: (.github_activity.activity_score > 0.6),
  technical_topics: [.linkedin_activity.recent_posts[].topics_detected[] | select(. == "API" or . == "integration" or . == "technical")],
  primary_language: .github_activity.primary_languages[0].language
}'

# Find technical buyer signals
curl http://localhost:3000/api/signals/1 | jq '.signals[] | select(.signal_type == "github_activity" or (.signal_type == "linkedin_content" and .description | contains("technical")))'
```

**Use Case**: Technical buyers require different approach - send API docs, technical architecture, security white papers.

---

### Example 10: Competitive Displacement

**Scenario**: Find accounts using competitor tools (from job postings).

```bash
# Get company tech stack signals
curl http://localhost:3000/api/contacts/1 | jq '.company_context.job_postings[] | select(.tech_stack_mentions | length > 0) | {
  job_title,
  tech_stack: .tech_stack_mentions,
  posted_date
}'

# Example output:
{
  "job_title": "Senior Sales Operations Analyst",
  "tech_stack": ["Salesforce", "Outreach", "Gong"],
  "posted_date": "2025-01-10"
}

# Get competitive signals
curl http://localhost:3000/api/signals/1 | jq '.signals[] | select(.signal_category == "competitive")'
```

**Displacement Strategy**:
1. Identify current tool from job postings
2. Find complaints about current tool in LinkedIn posts
3. Craft wedge around limitations of current tool
4. Reference similar customer migrations

---

### Example 11: Account-Based Marketing (ABM)

**Scenario**: Research all decision-makers at target account.

```bash
# Research each contact at account
TECHCORP_CONTACTS=(
  "https://linkedin.com/in/sarahjohnson"  # Director of RevOps
  "https://linkedin.com/in/johnsmith"     # VP of Sales
  "https://linkedin.com/in/emilydavis"    # CRO
)

for linkedin in "${TECHCORP_CONTACTS[@]}"; do
  curl -X POST http://localhost:3000/api/research \
    -H "Content-Type: application/json" \
    -d "{
      \"full_name\": \"Auto-detect\",
      \"linkedin_url\": \"$linkedin\",
      \"company_domain\": \"techcorp.com\"
    }"
  sleep 2
done

# After completion, get multi-threaded view
curl "http://localhost:3000/api/export/csv?contact_ids=1,2,3&format=playbook" \
  > techcorp_account_plan.csv
```

**ABM Strategy**:
- Identify champion (highest influence score + pain point posts)
- Map influencers (high LinkedIn engagement)
- Find budget holder (seniority + job change signals)
- Coordinate multi-threaded outreach

---

## Scripts & Automation

### Example 12: Monitoring Script

**Purpose**: Monitor research jobs and alert on completion.

```python
#!/usr/bin/env python3
import requests
import time
import sys

def check_job_status(job_id):
    """Check research job status."""
    resp = requests.get(f'http://localhost:3000/api/research/{job_id}')
    return resp.json()

def monitor_jobs(job_ids):
    """Monitor multiple jobs until completion."""
    pending = set(job_ids)

    while pending:
        for job_id in list(pending):
            status = check_job_status(job_id)

            if status['status'] == 'completed':
                print(f"✓ Job {job_id} completed - Contact {status['contact_id']}")
                pending.remove(job_id)

                # Get playbook
                playbook_resp = requests.get(
                    f'http://localhost:3000/api/playbook/{status["contact_id"]}'
                )
                playbook = playbook_resp.json()
                print(f"  Primary wedge: {playbook['playbook']['primary_wedge']}")

            elif status['status'] == 'failed':
                print(f"✗ Job {job_id} failed: {status.get('error')}")
                pending.remove(job_id)

        if pending:
            time.sleep(30)  # Check every 30 seconds

    print("\nAll jobs completed!")

if __name__ == '__main__':
    job_ids = sys.argv[1:]  # Pass job IDs as arguments
    monitor_jobs(job_ids)
```

**Usage**:
```bash
python3 monitor_jobs.py 1 2 3 4 5
```

---

### Example 13: Slack Integration

**Purpose**: Post high-priority findings to Slack channel.

```javascript
// slack_notifier.js
const axios = require('axios');

const WEBHOOK_URL = 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL';

async function notifyHighPriority(contactId) {
  // Get contact data
  const { data: contact } = await axios.get(
    `http://localhost:3000/api/contacts/${contactId}`
  );

  // Get playbook
  const { data: playbookData } = await axios.get(
    `http://localhost:3000/api/playbook/${contactId}`
  );

  const playbook = playbookData.playbook;

  // Check if high priority
  if (playbook.wedge_score < 0.85) {
    return; // Skip low priority
  }

  // Send to Slack
  await axios.post(WEBHOOK_URL, {
    text: `🔥 High-Priority Contact: ${contact.contact.full_name}`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${contact.contact.full_name}* at *${contact.contact.current_company}*\n${contact.contact.current_title}`
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Wedge Score:*\n${Math.round(playbook.wedge_score * 100)}/100`
          },
          {
            type: 'mrkdwn',
            text: `*LinkedIn Influence:*\n${Math.round((contact.linkedin_activity.influence_score || 0) * 100)}/100`
          }
        ]
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Primary Wedge:*\n${playbook.primary_wedge}`
        }
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'View Full Dossier' },
            url: contact.contact.linkedin_url
          }
        ]
      }
    ]
  });
}

// Usage
const contactId = process.argv[2];
notifyHighPriority(contactId);
```

**Automate**:
```bash
# After research completes, notify Slack
node slack_notifier.js 1
```

---

## Best Practices

1. **Batch Processing**: Process 10-20 contacts at once, not hundreds at once
2. **Rate Limits**: Respect LinkedIn 10 req/min limit - spread research over time
3. **Prioritization**: Use `contact_readiness_score` and `is_high_priority` to focus effort
4. **Refresh Cadence**: Re-research contacts every 30 days for updated LinkedIn posts
5. **Data Privacy**: Only research contacts you have legitimate business reason to contact

---

## Troubleshooting

**Q: Research job stuck in "processing"**
```bash
# Check job status
curl http://localhost:3000/api/research/:jobId

# If stuck >10 minutes, check logs
pm2 logs gtm-intel

# Restart if needed
pm2 restart gtm-intel
```

**Q: LinkedIn circuit breaker triggered**
```bash
# Circuit breaker opens after 3 consecutive failures
# Wait 5 minutes for auto-reset
# Check rate limiter status in logs

# Resume research after reset
```

**Q: Low signal scores**
```bash
# Check if profile has enough data
curl http://localhost:3000/api/linkedin/recent-activity/:contactId

# If few posts, scores will be lower
# Try different wedge types (GitHub, speaking, job change)
```

---

For more examples, see [API Documentation](API.md).
