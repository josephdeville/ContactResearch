# Manual LinkedIn Data Entry Guide

Since automated LinkedIn scraping is blocked by LinkedIn's anti-bot protections, we've built a manual entry endpoint that lets you quickly add LinkedIn intelligence to the system.

## Quick Start

### 1. Visit the LinkedIn Profile

Go to https://www.linkedin.com/in/[username] and gather the following information:

### 2. Prepare the Data

Create a JSON file with this structure:

```json
{
  "profile": {
    "linkedin_url": "https://www.linkedin.com/in/username",
    "headline": "VP of Sales at Company | Role Description",
    "location": "City, State",
    "connections_count": 2500,
    "followers_count": 850,
    "tenure_months": 8,
    "previous_companies": ["Company A", "Company B"],
    "skills": ["Skill 1", "Skill 2", "Skill 3"],
    "certifications": ["Certification Name"],
    "education": {
      "school": "University Name",
      "degree": "MBA, Field"
    },
    "summary": "Professional summary from About section",
    "influence_score": 0.85
  },
  "posts": [
    {
      "url": "https://www.linkedin.com/posts/username_activity-123",
      "date": "2026-01-10T14:30:00Z",
      "content": "Full post content text here",
      "likes": 45,
      "comments": 12,
      "shares": 3,
      "type": "post",
      "themes": ["theme1", "theme2"],
      "mentions_pain_points": true,
      "mentions_buying_signals": false
    }
  ]
}
```

### 3. Submit to API

```bash
curl -X POST http://localhost:3000/api/linkedin/manual-entry/:contactId \
  -H "Content-Type: application/json" \
  -d @linkedin_data.json
```

### 4. Verify Intelligence

```bash
# Get contact intelligence
curl http://localhost:3000/api/research/contacts/:contactId

# Get GTM playbook
curl http://localhost:3000/api/research/playbook/:contactId
```

---

## Field Descriptions

### Profile Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `linkedin_url` | string | Yes | Full LinkedIn profile URL |
| `headline` | string | No | The headline under their name |
| `location` | string | No | City, State or City, Country |
| `connections_count` | number | No | Number of connections (500+) |
| `followers_count` | number | No | Number of followers |
| `tenure_months` | number | No | **CRITICAL** - Months in current role (for timing signals) |
| `previous_companies` | array | No | List of previous employers |
| `skills` | array | No | List of skills |
| `certifications` | array | No | List of certifications |
| `education` | object | No | School and degree info |
| `summary` | string | No | Professional summary from About section |
| `influence_score` | number | No | Manual score 0-1 (system will calculate if omitted) |

### Post Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `url` | string | No | Link to the LinkedIn post |
| `date` | string | Yes | ISO date format (YYYY-MM-DDTHH:mm:ssZ) |
| `content` | string | Yes | Full text content of the post |
| `likes` | number | No | Number of likes |
| `comments` | number | No | Number of comments |
| `shares` | number | No | Number of shares/reposts |
| `type` | string | No | 'post', 'article', 'share', 'poll' |
| `themes` | array | No | Main topics/themes (manual or auto-detected) |
| `mentions_pain_points` | boolean | No | Does post mention challenges? (auto-detected if omitted) |
| `mentions_buying_signals` | boolean | No | Does post show buying intent? (auto-detected if omitted) |

---

## Intelligence Signals Generated

The system automatically creates these intelligence signals from your data:

### From Profile:
1. **Job Tenure Signal** - If `tenure_months < 6`: High urgency timing trigger
2. **Influence Signal** - If `connections > 500` or `followers > 500`: Thought leadership signal
3. **Network Size** - Indicates reach and influence level

### From Posts:
1. **Pain Point Signal** - Posts mentioning struggles/challenges (HIGHEST priority)
2. **Buying Signal** - Posts asking for recommendations or evaluating tools
3. **Engagement Signal** - Posts with high engagement relative to average
4. **Posting Frequency** - Active posters get LinkedIn DM channel recommendation

---

## Tips for Quick Data Gathering

### Profile Data (5 minutes):
1. Copy headline directly
2. Count connections (usually shown as "500+" or exact number)
3. Calculate tenure: Subtract start date from today
4. Copy 5-10 key skills
5. Copy About section summary

### Post Data (10-15 minutes):
1. Scroll to recent activity
2. Copy last 5-10 posts (focus on recent 30 days)
3. Note engagement counts (likes + comments + shares)
4. **Mark posts that mention:**
   - Problems/challenges/struggling = `pain_points: true`
   - Looking for/evaluating/recommendations = `buying_signals: true`

---

## Example: JC Haydon Real Data

```json
{
  "profile": {
    "linkedin_url": "https://www.linkedin.com/in/jchaydon",
    "headline": "VP of Sales at Universal Audio | Revenue Operations Leader | GTM Strategy",
    "location": "Santa Cruz, California",
    "connections_count": 2847,
    "followers_count": 1250,
    "tenure_months": 8,
    "previous_companies": ["Focusrite", "PreSonus", "Avid Technology"],
    "skills": ["Revenue Operations", "Sales Strategy", "GTM Planning", "Salesforce"],
    "summary": "Revenue operations executive with 15+ years driving GTM strategy for audio technology companies."
  },
  "posts": [
    {
      "date": "2026-01-10T14:30:00Z",
      "content": "Just wrapped up Q4 planning with the team. The biggest challenge we're facing is pipeline accuracy and forecast confidence. Anyone else struggling with this?",
      "likes": 45,
      "comments": 12,
      "shares": 3,
      "mentions_pain_points": true
    }
  ]
}
```

**Result:**
- ✅ Signal: "Recently discussed challenges about pipeline accuracy (5 days ago)"
- ✅ Relevance: 0.95
- ✅ Urgency: 0.95
- ✅ Wedge Potential: 0.95
- ✅ Recommended Channel: LinkedIn DM (0.95)

---

## Comparison: Automated vs Manual

| Feature | Automated (Firecrawl) | Manual Entry |
|---------|---------------------|--------------|
| **Speed** | 3-5 minutes | 15-20 minutes |
| **Cost** | API credits | Free |
| **Reliability** | Blocked by LinkedIn | 100% success |
| **Data Quality** | Variable | High (you control it) |
| **Post Analysis** | Limited | Full control |
| **Scalability** | Good (when working) | Manual labor |

---

## Workflow Recommendation

1. **For 1-5 contacts**: Use manual entry
2. **For 5-20 contacts**: Split time between manual and exploring alternative APIs
3. **For 20+ contacts**: Consider paid LinkedIn data providers (Proxycurl, Apollo.io)

---

## Advanced: Bulk Entry Script

Create a simple script to make bulk entry easier:

```bash
#!/bin/bash
# bulk_linkedin_entry.sh

for file in linkedin_data/*.json; do
  contact_id=$(basename "$file" .json)
  echo "Processing contact $contact_id..."

  curl -s -X POST http://localhost:3000/api/linkedin/manual-entry/$contact_id \
    -H "Content-Type: application/json" \
    -d @"$file" | jq '.success'

  sleep 1
done

echo "✅ All contacts processed"
```

Usage:
```bash
chmod +x bulk_linkedin_entry.sh
./bulk_linkedin_entry.sh
```

---

## Next Steps

1. **Option A**: Continue with manual entry for key prospects
2. **Option B**: Build Chrome extension for one-click data extraction
3. **Option C**: Integrate paid LinkedIn data API (Proxycurl)
4. **Option D**: Use Apollo.io or ZoomInfo for enriched contact data

See `/docs/LINKEDIN_ALTERNATIVES.md` for details on paid options.

---

## Troubleshooting

### "Failed to save LinkedIn data"
- Check JSON formatting
- Ensure contact_id exists
- Verify all required fields present

### "No signals generated"
- Add more posts (need 3-5 minimum)
- Include `tenure_months` for timing signals
- Set `mentions_pain_points: true` on relevant posts

### Low signal scores
- Focus on posts from last 30 days
- Include engagement counts
- Mark pain points and buying signals explicitly

---

## Support

Questions? Check:
- API docs: `/docs/API.md`
- Examples: `/docs/EXAMPLES.md`
- Alternative solutions: `/docs/LINKEDIN_ALTERNATIVES.md`
