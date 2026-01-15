# API Reference

Complete API documentation for the GTM Contact Intelligence System.

## Base URL

```
http://localhost:3000/api
```

## Authentication

Currently no authentication required. Add API key authentication in production.

---

## Research Endpoints

### POST /research

Initiate a research job for a contact. This starts background processing that scrapes LinkedIn, GitHub, podcasts, and job postings.

**Request Body:**

```json
{
  "full_name": "John Smith",
  "linkedin_url": "https://linkedin.com/in/johnsmith",
  "email": "john@company.com",
  "current_company": "Acme Corp",
  "current_title": "VP of Sales",
  "company_domain": "acme.com"
}
```

**Required Fields:**
- `full_name` (string)
- `linkedin_url` (string)

**Response (202 Accepted):**

```json
{
  "job_id": 123,
  "contact_id": 456,
  "status": "pending",
  "message": "Research job started",
  "estimated_time": "3-5 minutes"
}
```

**Example:**

```bash
curl -X POST http://localhost:3000/api/research \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "Sarah Johnson",
    "linkedin_url": "https://linkedin.com/in/sarahjohnson",
    "email": "sarah@example.com",
    "current_company": "TechCorp",
    "current_title": "Director of Revenue Operations",
    "company_domain": "techcorp.com"
  }'
```

---

### GET /research/:jobId

Check the status of a research job.

**Parameters:**
- `jobId` (path) - The job ID returned from POST /research

**Response:**

```json
{
  "job_id": 123,
  "contact_id": 456,
  "status": "completed",
  "requested_at": "2025-01-15T10:30:00Z",
  "completed_at": "2025-01-15T10:34:32Z",
  "results": {
    "linkedin": {
      "found": true,
      "posts_analyzed": 12,
      "influence_score": 0.87
    },
    "github": {
      "found": true,
      "username": "sjohnson"
    },
    "podcasts": {
      "found": true,
      "count": 3
    },
    "jobs": {
      "analyzed": 8,
      "signals": 4
    },
    "playbook_generated": true
  }
}
```

**Status Values:**
- `pending` - Job queued
- `processing` - Currently researching
- `completed` - Research finished
- `failed` - Job failed (see error_message)

---

### GET /contacts/:contactId

Get complete intelligence dossier for a contact.

**Response:**

```json
{
  "contact": {
    "id": 456,
    "full_name": "Sarah Johnson",
    "linkedin_url": "https://linkedin.com/in/sarahjohnson",
    "email": "sarah@example.com",
    "current_company": "TechCorp",
    "current_title": "Director of Revenue Operations",
    "company_domain": "techcorp.com",
    "created_at": "2025-01-15T10:30:00Z",
    "updated_at": "2025-01-15T10:34:32Z"
  },
  "linkedin_activity": {
    "profile": {
      "profile_headline": "Director of Revenue Operations | SaaS Growth",
      "location": "San Francisco, CA",
      "connections_count": 2500,
      "followers_count": 850,
      "current_position_tenure_months": 8,
      "influence_score": 0.87,
      "skills": ["Revenue Operations", "Salesforce", "Data Analysis"]
    },
    "recent_posts": [
      {
        "post_url": "https://linkedin.com/posts/...",
        "post_date": "2025-01-12T14:30:00Z",
        "post_content": "Just wrapped up Q4 forecasting...",
        "engagement_count": 45,
        "topics_detected": ["forecasting", "revenue operations"],
        "mentions_pain_points": true,
        "key_themes": ["pipeline accuracy", "manual processes"]
      }
    ],
    "influence_score": 0.87
  },
  "github_activity": {
    "github_username": "sjohnson",
    "activity_score": 0.72,
    "primary_languages": [
      { "language": "Python", "repos": 5 }
    ],
    "technical_focus_areas": ["API Development", "Data Engineering"]
  },
  "speaking_engagements": [
    {
      "type": "podcast",
      "title": "Scaling Revenue Operations",
      "platform": "SaaS Growth Podcast",
      "date": "2024-11-15"
    }
  ],
  "intelligence_signals": [
    {
      "signal_type": "linkedin_content",
      "signal_category": "buying_signal",
      "description": "Recently discussed challenges with pipeline accuracy",
      "relevance_score": 0.95,
      "urgency_score": 0.85,
      "wedge_potential": 0.95
    }
  ],
  "playbook": {
    "primary_wedge": "Recent LinkedIn post about pipeline accuracy challenges",
    "wedge_score": 0.95,
    "timing_rationale": "Posted 3 days ago with high engagement",
    "recommended_channels": {
      "linkedin_dm": 0.95,
      "email": 0.80
    },
    "sample_outreach": "Hi Sarah, saw your recent post about..."
  },
  "company_context": {
    "job_postings": [
      {
        "job_title": "Senior Sales Operations Analyst",
        "department": "Sales Operations",
        "posted_date": "2025-01-10"
      }
    ]
  }
}
```

---

## LinkedIn Endpoints

### GET /linkedin/recent-activity/:contactId

Get recent LinkedIn posts and activity analysis.

**Query Parameters:**
- `limit` (optional) - Number of posts to return (default: 20)

**Response:**

```json
{
  "contact_id": 456,
  "posts": [
    {
      "post_url": "https://linkedin.com/posts/...",
      "post_date": "2025-01-12T14:30:00Z",
      "content": "Just wrapped up Q4 forecasting. The biggest challenge...",
      "engagement": {
        "total": 45,
        "likes": 32,
        "comments": 12,
        "shares": 1
      },
      "topics": ["forecasting", "revenue operations", "pipeline"],
      "sentiment": "neutral",
      "mentions_pain_points": true,
      "mentions_buying_signals": false,
      "key_themes": ["pipeline accuracy", "manual processes"]
    }
  ],
  "activity_summary": "12 posts analyzed, avg 28 engagements per post"
}
```

---

### GET /linkedin/engagement-patterns/:contactId

Get LinkedIn engagement analysis and patterns.

**Response:**

```json
{
  "contact_id": 456,
  "patterns": {
    "posting_frequency": 12,
    "avg_engagement_per_post": 28,
    "total_engagement": 336,
    "high_engagement_posts": 3,
    "posts_with_pain_points": 2,
    "posts_with_buying_signals": 1,
    "top_topics": [
      { "topic": "revenue operations", "count": 8 },
      { "topic": "forecasting", "count": 5 }
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

---

## Intelligence Endpoints

### GET /signals/:contactId

Get all intelligence signals for a contact, scored and prioritized.

**Response:**

```json
{
  "contact_id": 456,
  "total_signals": 7,
  "signals": [
    {
      "id": 1,
      "signal_type": "linkedin_content",
      "signal_category": "buying_signal",
      "description": "Recently discussed challenges: pipeline accuracy, forecasting. Posted 3 days ago with 45 engagements.",
      "relevance_score": 0.95,
      "urgency_score": 0.95,
      "wedge_potential": 0.95,
      "composite_score": 0.95,
      "linkedin_boosted": true,
      "detected_at": "2025-01-15T10:32:15Z"
    }
  ]
}
```

**Signal Types:**
- `linkedin_activity` - LinkedIn posting/engagement patterns
- `linkedin_content` - Post content analysis
- `linkedin_profile_change` - Job changes, profile updates
- `github_activity` - GitHub contributions
- `speaking_engagement` - Podcasts, conferences
- `company_hiring` - Job posting signals
- `company_tech_stack` - Current tools detected

**Signal Categories:**
- `thought_leadership` - Active voice in industry
- `timing_trigger` - Time-sensitive opportunity
- `buying_signal` - Active evaluation/pain point
- `technical` - Technical buyer signal
- `competitive` - Competitive displacement opportunity

---

### GET /playbook/:contactId

Get GTM playbook with outreach strategy.

**Response:**

```json
{
  "contact_id": 456,
  "playbook": {
    "primary_wedge": "Recent LinkedIn post about pipeline accuracy challenges",
    "wedge_score": 0.95,
    "linkedin_context": {
      "influence_score": 0.87,
      "connections": 2500,
      "recent_posts_count": 12,
      "trigger_post": {
        "url": "https://linkedin.com/posts/...",
        "date": "2025-01-12T14:30:00Z",
        "content_summary": "Discussing Q4 forecasting challenges...",
        "engagement_level": "high",
        "topics": ["forecasting", "pipeline"]
      },
      "profile_signals": {
        "tenure": "8 months",
        "tenure_phase": "optimization"
      }
    },
    "supporting_evidence": [
      "Recently discussed challenges: pipeline accuracy (relevance: 95%)",
      "8 months into current role - past honeymoon phase",
      "Company hiring 2 Sales Ops roles (expansion signal)"
    ],
    "personalization_hooks": [
      "Previously worked at Oracle - interesting transition",
      "Based in San Francisco",
      "Recently spoke about RevOps at SaaS Growth Podcast"
    ],
    "timing_rationale": "Posted 3 days ago with high engagement - indicates active pain point. 8 months into role - past honeymoon phase but not entrenched.",
    "recommended_channels": {
      "linkedin_dm": 0.95,
      "email": 0.80,
      "phone": 0.30
    },
    "sample_outreach": "Hi Sarah,\n\nSaw your recent post about pipeline accuracy...",
    "competitive_context": "Current stack includes: Salesforce, Outreach",
    "conversation_starters": [
      "Your recent post about forecasting challenges",
      "The 45 responses to your post",
      "Your comment on [influencer]'s post"
    ]
  }
}
```

---

## Export Endpoints

### GET /export/clay/:contactId

Export contact data in Clay-compatible JSON format.

**Response:**

```json
{
  "contact_name": "Sarah Johnson",
  "contact_email": "sarah@example.com",
  "company": "TechCorp",
  "title": "Director of Revenue Operations",
  "linkedin_url": "https://linkedin.com/in/sarahjohnson",
  "linkedin_connections": 2500,
  "linkedin_followers": 850,
  "linkedin_influence_score": 0.87,
  "linkedin_recent_posts": 12,
  "linkedin_last_post_date": "2025-01-12",
  "linkedin_last_post_topic": "forecasting",
  "linkedin_mentions_pain_points": true,
  "linkedin_tenure_months": 8,
  "github_username": "sjohnson",
  "github_activity_score": 0.72,
  "podcast_count": 3,
  "top_signal_1": "Recently discussed challenges: pipeline accuracy",
  "top_signal_1_type": "linkedin_content",
  "top_signal_1_score": 95,
  "primary_wedge": "Recent LinkedIn post about pipeline accuracy challenges",
  "timing_trigger": "Posted 3 days ago with high engagement",
  "recommended_channel": "linkedin dm",
  "contact_readiness_score": 88,
  "is_high_priority": true
}
```

---

### GET /export/csv

Export multiple contacts to CSV format.

**Query Parameters:**
- `contact_ids` (required) - Comma-separated list of contact IDs
- `format` (optional) - Export format: `default`, `linkedin`, `playbook`, `high_priority`

**Formats:**

1. **default** - All columns with LinkedIn priority
2. **linkedin** - LinkedIn-only columns
3. **playbook** - Playbook summary for outreach planning
4. **high_priority** - Only high-priority contacts

**Example:**

```bash
# Full export
curl "http://localhost:3000/api/export/csv?contact_ids=1,2,3" > contacts.csv

# LinkedIn-only
curl "http://localhost:3000/api/export/csv?contact_ids=1,2,3&format=linkedin" > linkedin.csv

# Playbook summary
curl "http://localhost:3000/api/export/csv?contact_ids=1,2,3&format=playbook" > playbooks.csv
```

**Response:**
CSV file download with appropriate headers.

---

### GET /export/csv/columns

Get available CSV column definitions.

**Response:**

```json
{
  "columns": [
    { "label": "Name", "value": "contact_name" },
    { "label": "Email", "value": "contact_email" }
  ],
  "formats": [
    {
      "name": "default",
      "description": "All columns with LinkedIn priority",
      "usage": "/api/export/csv?contact_ids=1,2,3"
    }
  ]
}
```

---

### POST /export/clay/batch

Export multiple contacts to Clay format in single request.

**Request Body:**

```json
{
  "contact_ids": [1, 2, 3, 4, 5]
}
```

**Response:**

```json
{
  "count": 5,
  "contacts": [
    { /* Clay-formatted contact 1 */ },
    { /* Clay-formatted contact 2 */ }
  ]
}
```

---

## Error Responses

All endpoints return standard error responses:

```json
{
  "error": "Error type",
  "message": "Detailed error message"
}
```

**Common HTTP Status Codes:**

- `200 OK` - Success
- `400 Bad Request` - Invalid input
- `404 Not Found` - Resource not found
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error

---

## Rate Limiting

API rate limits:
- **General endpoints**: 100 requests per 15 minutes per IP
- **LinkedIn scraping**: Enforced at 10 requests per minute internally

---

## Webhooks (Future)

Webhook support planned for:
- Research job completion
- New signal detection
- High-priority prospect identification

---

## Best Practices

1. **Poll research jobs** at 30-second intervals, not continuously
2. **Batch exports** when possible to reduce API calls
3. **Cache responses** - intelligence data changes slowly
4. **Use appropriate export formats** - Clay for enrichment, CSV for analysis
5. **Monitor rate limits** - especially important for LinkedIn scraping

---

## Need Help?

- Check [Examples](EXAMPLES.md) for common workflows
- Review [Deployment Guide](DEPLOYMENT.md) for production setup
- Open an issue on GitHub for bugs or feature requests
