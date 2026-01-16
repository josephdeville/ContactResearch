# macOS Local Setup Guide

Complete setup instructions for running GTM Contact Intelligence on your Mac.

## Prerequisites

1. **Install Homebrew** (if not already installed):
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

2. **Install PostgreSQL**:
```bash
brew install postgresql@14
brew services start postgresql@14
```

3. **Install Node.js** (if not already installed):
```bash
brew install node
```

## Database Setup

1. **Create the database**:
```bash
createdb gtm_intelligence
```

2. **Initialize database schema**:
```bash
cd gtm-contact-intel
psql gtm_intelligence < database/schema.sql
```

3. **Load sample data** (JC Haydon's intelligence):
```bash
psql gtm_intelligence < database/sample_data.sql
```

## Application Setup

1. **Install dependencies**:
```bash
npm install
```

2. **Configure environment** (optional - defaults work fine):
```bash
# Create .env file if you need custom settings
cp .env.example .env
```

3. **Start the API server**:
```bash
npm start
# Or for development with auto-reload:
npm run dev
```

Server will start on http://localhost:3000

## Test Clay Integration

1. **Verify server is running**:
```bash
curl http://localhost:3000/health
```

2. **Preview Clay data**:
```bash
./send-to-clay.sh 1 preview
```

3. **Send to Clay webhook**:
```bash
./send-to-clay.sh 1
```

Your Clay webhook URL is already configured in `send-to-clay.sh`:
```
https://api.clay.com/v3/sources/webhook/pull-in-data-from-a-webhook-fa59bcce-da9c-40f0-9e7d-d680d84f95f7
```

## Verify in Clay

Check your Clay table - all 30 fields should populate:
- Contact info (name, email, title, company)
- LinkedIn metrics (connections, influence score)
- Recent activity and engagement patterns
- Intelligence signals with urgency scores
- GTM playbook with primary wedge
- Recommended messaging and next steps

## Common Issues

**PostgreSQL not starting:**
```bash
brew services restart postgresql@14
```

**Port 3000 already in use:**
```bash
# Find and kill process using port 3000
lsof -ti:3000 | xargs kill -9
```

**Database connection refused:**
```bash
# Check PostgreSQL is running
brew services list | grep postgres
```

## Database Credentials

Default PostgreSQL on Mac (no password needed):
- Host: localhost
- Port: 5432
- Database: gtm_intelligence
- User: your Mac username

These are automatically detected by the application.

## Next Steps

Once working locally:
1. Extract more LinkedIn profiles using Chrome extension
2. Send multiple contacts to Clay via batch export
3. Set up automated enrichment workflows in Clay
4. Build your GTM playbooks database
