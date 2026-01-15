# Quick Start Guide

Get the GTM Contact Intelligence System running in 10 minutes.

## Prerequisites Check

```bash
# Check Node.js version (need 18+)
node --version

# Check PostgreSQL
psql --version

# Check you have Git
git --version
```

If any are missing, install them first.

## Step 1: Clone and Install (2 minutes)

```bash
# Navigate to project directory
cd gtm-contact-intel

# Install dependencies
npm install

# This should complete without errors
```

## Step 2: Setup Database (2 minutes)

```bash
# Create database
createdb gtm_intel

# Run schema
psql -U postgres -d gtm_intel -f src/db/schema.sql

# Verify tables created
psql -U postgres -d gtm_intel -c "\dt"
# Should show 15+ tables
```

## Step 3: Configure Environment (2 minutes)

```bash
# Copy example config
cp config/.env.example config/.env

# Edit with your details
nano config/.env
```

**Minimum required configuration:**

```bash
# Database (if using postgres user locally, these work)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=gtm_intel
DB_USER=postgres
DB_PASSWORD=

# Get Firecrawl API key from https://firecrawl.dev
FIRECRAWL_API_KEY=fc_your_key_here

# Optional but recommended
GITHUB_TOKEN=ghp_your_token_here
```

## Step 4: Start Server (1 minute)

```bash
# Start server
npm start

# Should see:
# ╔═══════════════════════════════════════════════════════════╗
# ║   GTM Contact Intelligence System                         ║
# ║   Server running on port 3000                             ║
# ╚═══════════════════════════════════════════════════════════╝
```

## Step 5: Test API (3 minutes)

**Open a new terminal** and run:

```bash
# Health check
curl http://localhost:3000/health

# Should return: {"status":"healthy", ...}

# Run test suite
node tests/api.test.js

# Should see:
# ✅ PASSED: Health Check
# ✅ PASSED: Create Research Job
# etc.
```

## Step 6: First Research Job (5 minutes)

```bash
# Start research on a contact
curl -X POST http://localhost:3000/api/research \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "John Smith",
    "linkedin_url": "https://linkedin.com/in/johnsmith",
    "email": "john@example.com",
    "current_company": "Example Corp",
    "current_title": "VP of Sales",
    "company_domain": "example.com"
  }'

# Response:
{
  "job_id": 1,
  "contact_id": 1,
  "status": "pending",
  "estimated_time": "3-5 minutes"
}

# Wait 5 minutes, then check status
curl http://localhost:3000/api/research/1

# When status is "completed", get full intelligence
curl http://localhost:3000/api/contacts/1 | jq '.'
```

## ✅ You're Ready!

The system is now running. Next steps:

1. **Read the docs**: Check `docs/API.md` for all endpoints
2. **See examples**: Look at `docs/EXAMPLES.md` for workflows
3. **Deploy to production**: Follow `docs/DEPLOYMENT.md`

## Common Issues

### "Database connection failed"

```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Start if not running
sudo systemctl start postgresql

# Verify connection
psql -U postgres -d gtm_intel -c "SELECT 1"
```

### "FIRECRAWL_API_KEY is required"

1. Go to https://firecrawl.dev
2. Sign up and get API key
3. Add to `config/.env`: `FIRECRAWL_API_KEY=fc_your_key`
4. Restart server

### "Port 3000 already in use"

```bash
# Change port in config/.env
PORT=3001

# Or kill existing process
lsof -ti:3000 | xargs kill
```

### "Cannot find module 'express'"

```bash
# Reinstall dependencies
rm -rf node_modules
npm install
```

## Testing LinkedIn Scraping

**Important**: LinkedIn scraping is rate-limited (10 requests/minute max).

```bash
# Watch logs for rate limiting
npm start

# In another terminal, monitor
tail -f logs/*.log

# Look for:
# "LinkedIn scraping started"
# "LinkedIn circuit breaker: X failures"
```

If you see "LinkedIn blocked the request", wait 5 minutes for circuit breaker to reset.

## Next: Clay Integration

Once working locally:

1. Export test data: `curl http://localhost:3000/api/export/csv?contact_ids=1 > test.csv`
2. Import CSV to Clay
3. Set up Clay HTTP API enrichment (see `docs/EXAMPLES.md#clay-integration`)

## Support

- API Docs: `docs/API.md`
- Examples: `docs/EXAMPLES.md`
- Deployment: `docs/DEPLOYMENT.md`
- Issues: GitHub Issues

Happy researching! 🎯
