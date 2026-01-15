# ContactResearch
GTM Contact Intelligence System
Production-ready contact intelligence system that performs deep research on sales prospects using unique data sources. Built with a LinkedIn-first approach to uncover competitive advantages that competitors miss.

🎯 Overview
This system aggregates intelligence from multiple sources to provide actionable GTM playbooks for B2B SaaS sales teams:

LinkedIn Activity (PRIMARY SOURCE): Profile analysis, post content, engagement patterns, job transitions
GitHub Activity: Technical buyer influence, expertise areas, contribution patterns
Speaking Engagements: Podcast appearances, conference talks, thought leadership
Job Postings: Company initiatives, tech stack signals, hiring urgency
Tech Stack Intelligence: Current tools, displacement opportunities
The system scores signals, identifies "wedges" (conversation starters), and generates personalized GTM playbooks.

🚀 Quick Start
Prerequisites
Node.js 18+
PostgreSQL 14+
Firecrawl API key
GitHub Personal Access Token (optional but recommended)
Installation
# Clone the repository
cd gtm-contact-intel

# Install dependencies
npm install

# Copy environment template
cp config/.env.example config/.env

# Edit .env with your configuration
nano config/.env

# Setup database
createdb gtm_intel
psql -U postgres -d gtm_intel -f src/db/schema.sql

# Start server
npm start
First API Call
# Start a research job
curl -X POST http://localhost:3000/api/research \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "John Smith",
    "linkedin_url": "https://linkedin.com/in/johnsmith",
    "email": "john@company.com",
    "current_company": "Acme Corp",
    "current_title": "VP of Sales",
    "company_domain": "acme.com"
  }'

# Response:
{
  "job_id": 1,
  "contact_id": 1,
  "status": "pending",
  "estimated_time": "3-5 minutes"
}

# Check job status
curl http://localhost:3000/api/research/1

# Get full intelligence dossier
curl http://localhost:3000/api/contacts/1
📊 Key Features
LinkedIn Intelligence (Highest Priority)
Profile Analysis: Headline, location, connections, followers, tenure
Post Content Analysis: Topics, sentiment, pain points, buying signals
Engagement Patterns: Posting frequency, engagement rates, influential connections
Job Transition Signals: Recent role changes, tenure phase detection
Influence Scoring: Network size, content quality, engagement rates
Intelligence Signals
Signals are scored on 3 dimensions:

Relevance Score (0-1): How relevant to your GTM motion
Urgency Score (0-1): Time-sensitivity of the signal
Wedge Potential (0-1): Likelihood of opening a conversation
LinkedIn signals automatically receive a +0.3 relevance boost.

Wedge Detection
The system identifies conversation starters based on:

Ultra-High Priority (score > 0.9): Recent pain point posts, buying signal posts
High Priority (score 0.8-0.9): New job timing, high engagement posts
Medium Priority (score 0.5-0.8): Active posting, technical alignment
GTM Playbooks
Each playbook includes:

Primary wedge (conversation starter)
Supporting evidence from all intelligence sources
Personalization hooks
Timing rationale
Recommended contact channels
Sample outreach message
Competitive context
📚 Documentation
API Reference - Complete API documentation
Deployment Guide - Production deployment instructions
Examples - Usage examples and workflows
🏗️ Architecture
gtm-contact-intel/
├── src/
│   ├── api/              # Express server and routes
│   ├── scrapers/         # Data collection (LinkedIn, GitHub, etc.)
│   ├── processors/       # Intelligence processing (scoring, wedges, playbooks)
│   ├── exporters/        # Clay and CSV formatters
│   └── db/               # Database client and queries
├── config/               # Configuration management
├── docs/                 # Documentation
└── tests/                # Test suite
🔧 Configuration
Key environment variables:

# API Keys
FIRECRAWL_API_KEY=your_key          # Required
GITHUB_TOKEN=your_token             # Optional but recommended

# Rate Limiting (CRITICAL for LinkedIn)
LINKEDIN_SCRAPE_DELAY_MS=6000       # 10 requests/minute max
LINKEDIN_MAX_REQUESTS_PER_MIN=10    # Enforce strict limits

# Intelligence Configuration
LINKEDIN_POST_LOOKBACK_DAYS=30      # How far back to analyze posts
LINKEDIN_RELEVANCE_BOOST=0.3        # Priority boost for LinkedIn signals
📤 Export Formats
Clay Format (JSON)
GET /api/export/clay/:contactId
Perfect for enriching Clay tables with LinkedIn-priority fields.

CSV Export
# Full export
GET /api/export/csv?contact_ids=1,2,3

# LinkedIn-only
GET /api/export/csv?contact_ids=1,2,3&format=linkedin

# Playbook summary
GET /api/export/csv?contact_ids=1,2,3&format=playbook

# High-priority only
GET /api/export/csv?contact_ids=1,2,3&format=high_priority
⚠️ Important Notes
LinkedIn Scraping Best Practices
Rate Limiting: The system enforces strict 10 requests/minute limit
Circuit Breaker: Automatically pauses on repeated failures
Respect ToS: Only scrapes public profile data
Error Handling: Graceful degradation if LinkedIn blocks scraping
Data Privacy
Only stores publicly available information
No private messages or restricted content
Respects robots.txt and terms of service
Secure database storage with encryption recommended
🔍 Example Use Cases
1. High-Intent Prospect Identification
Find prospects who recently posted about pain points:

# Get contacts with recent pain point mentions
curl http://localhost:3000/api/signals/1 | jq '.signals[] | select(.signal_category == "buying_signal")'
2. New Job Transition Outreach
Target contacts 6-12 months into new roles:

# Get playbook for optimal timing outreach
curl http://localhost:3000/api/playbook/1 | jq '.playbook.timing_rationale'
3. Technical Buyer Identification
Find prospects with GitHub + LinkedIn technical discussions:

# Check for technical buyer signals
curl http://localhost:3000/api/contacts/1 | jq '.github_activity, .linkedin_activity.recent_posts[] | select(.topics_detected[] | contains("API"))'
🧪 Testing
# Run test suite
npm test

# Test API endpoints
npm run test:api

# Test LinkedIn scraping (respects rate limits)
npm run test:linkedin
🤝 Contributing
This is a production system. Contributions should:

Maintain LinkedIn-first priority
Respect rate limiting
Include comprehensive tests
Follow existing code patterns
📝 License
MIT License - See LICENSE file for details

🆘 Support
Issues: GitHub Issues
Documentation: See /docs folder
Email: support@yourcompany.com
🎯 Roadmap
 Real-time LinkedIn monitoring
 Slack/Teams integration for alerts
 CRM enrichment (Salesforce, HubSpot)
 AI-powered outreach message generation
 Multi-language support
 Enhanced competitive intelligence
