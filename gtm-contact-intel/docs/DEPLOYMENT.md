# Deployment Guide

Complete guide for deploying the GTM Contact Intelligence System to production.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Database Setup](#database-setup)
- [Application Deployment](#application-deployment)
- [Production Configuration](#production-configuration)
- [Monitoring & Logging](#monitoring--logging)
- [Scaling](#scaling)
- [Security](#security)
- [Backup & Recovery](#backup--recovery)

---

## Prerequisites

### Required Services

1. **PostgreSQL 14+**
   - Minimum 2GB RAM allocated
   - 20GB storage for moderate usage
   - Connection pooling configured

2. **Node.js 18+**
   - LTS version recommended
   - PM2 or similar process manager

3. **API Keys**
   - Firecrawl API key (required)
   - GitHub Personal Access Token (optional but recommended)

### Recommended Infrastructure

- **Small deployment** (< 100 contacts/day): 1 server, 2GB RAM, 2 CPU cores
- **Medium deployment** (100-500 contacts/day): 2 servers, 4GB RAM, 4 CPU cores
- **Large deployment** (500+ contacts/day): 3+ servers, 8GB RAM, 8+ CPU cores

---

## Environment Setup

### 1. Server Preparation

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL 14
sudo apt install -y postgresql-14 postgresql-contrib-14

# Install PM2 (process manager)
sudo npm install -g pm2

# Install build tools
sudo apt install -y build-essential git
```

### 2. Create Application User

```bash
# Create dedicated user
sudo useradd -m -s /bin/bash gtm-intel
sudo su - gtm-intel

# Clone repository
git clone https://github.com/yourorg/gtm-contact-intel.git
cd gtm-contact-intel

# Install dependencies
npm install --production
```

### 3. Environment Configuration

```bash
# Create .env file
cp config/.env.example config/.env

# Edit configuration
nano config/.env
```

**Production .env:**

```bash
# Server
PORT=3000
NODE_ENV=production

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=gtm_intel
DB_USER=gtm_intel_user
DB_PASSWORD=your_secure_password_here

# API Keys
FIRECRAWL_API_KEY=fc_your_actual_key_here
GITHUB_TOKEN=ghp_your_token_here

# Rate Limiting (CRITICAL)
LINKEDIN_SCRAPE_DELAY_MS=6000
LINKEDIN_MAX_REQUESTS_PER_MIN=10
GITHUB_MAX_REQUESTS_PER_MIN=30
FIRECRAWL_MAX_REQUESTS_PER_MIN=50

# Intelligence
LINKEDIN_POST_LOOKBACK_DAYS=30
MAX_LINKEDIN_POSTS_PER_PROFILE=20
MIN_SIGNAL_RELEVANCE_SCORE=0.5
LINKEDIN_RELEVANCE_BOOST=0.3
TOP_SIGNALS_COUNT=5
```

---

## Database Setup

### 1. Create Database and User

```bash
# Switch to postgres user
sudo su - postgres

# Create database and user
psql <<EOF
CREATE DATABASE gtm_intel;
CREATE USER gtm_intel_user WITH ENCRYPTED PASSWORD 'your_secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE gtm_intel TO gtm_intel_user;

-- Connect to database
\c gtm_intel

-- Grant schema privileges
GRANT ALL ON SCHEMA public TO gtm_intel_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO gtm_intel_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO gtm_intel_user;

-- Set default privileges
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO gtm_intel_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO gtm_intel_user;
EOF
```

### 2. Run Schema Migration

```bash
# As gtm-intel user
cd /home/gtm-intel/gtm-contact-intel

# Run schema
psql -U gtm_intel_user -d gtm_intel -f src/db/schema.sql

# Verify tables created
psql -U gtm_intel_user -d gtm_intel -c "\dt"
```

### 3. Configure PostgreSQL for Production

Edit `/etc/postgresql/14/main/postgresql.conf`:

```conf
# Memory
shared_buffers = 512MB
effective_cache_size = 2GB
maintenance_work_mem = 128MB
work_mem = 10MB

# Connections
max_connections = 100

# Performance
random_page_cost = 1.1
effective_io_concurrency = 200

# Logging
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '
log_checkpoints = on
log_connections = on
log_disconnections = on
log_lock_waits = on
log_temp_files = 0
```

Restart PostgreSQL:

```bash
sudo systemctl restart postgresql
```

---

## Application Deployment

### 1. Using PM2 (Recommended)

```bash
# As gtm-intel user
cd /home/gtm-intel/gtm-contact-intel

# Start with PM2
pm2 start src/api/server.js --name gtm-intel \
  --instances 2 \
  --max-memory-restart 1G \
  --env production

# Save PM2 configuration
pm2 save

# Setup auto-restart on reboot
pm2 startup
# Follow the instructions printed

# View logs
pm2 logs gtm-intel

# Monitor
pm2 monit
```

**PM2 Ecosystem File** (`ecosystem.config.js`):

```javascript
module.exports = {
  apps: [{
    name: 'gtm-intel',
    script: './src/api/server.js',
    instances: 2,
    exec_mode: 'cluster',
    max_memory_restart: '1G',
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    watch: false
  }]
};
```

Start with ecosystem file:

```bash
pm2 start ecosystem.config.js --env production
```

### 2. Using Systemd

Create `/etc/systemd/system/gtm-intel.service`:

```ini
[Unit]
Description=GTM Contact Intelligence System
After=network.target postgresql.service

[Service]
Type=simple
User=gtm-intel
WorkingDirectory=/home/gtm-intel/gtm-contact-intel
ExecStart=/usr/bin/node src/api/server.js
Restart=on-failure
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=gtm-intel
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable gtm-intel
sudo systemctl start gtm-intel
sudo systemctl status gtm-intel

# View logs
sudo journalctl -u gtm-intel -f
```

---

## Production Configuration

### 1. Reverse Proxy (Nginx)

Install Nginx:

```bash
sudo apt install -y nginx
```

Create `/etc/nginx/sites-available/gtm-intel`:

```nginx
upstream gtm_intel {
    server localhost:3000;
    server localhost:3001;  # If running multiple instances
    keepalive 64;
}

server {
    listen 80;
    server_name gtm-intel.yourcompany.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name gtm-intel.yourcompany.com;

    # SSL certificates (use certbot)
    ssl_certificate /etc/letsencrypt/live/gtm-intel.yourcompany.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/gtm-intel.yourcompany.com/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Proxy settings
    location / {
        proxy_pass http://gtm_intel;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 300s;  # Research jobs can take time
    }

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req zone=api burst=20 nodelay;

    # Logging
    access_log /var/log/nginx/gtm-intel-access.log;
    error_log /var/log/nginx/gtm-intel-error.log;
}
```

Enable site:

```bash
sudo ln -s /etc/nginx/sites-available/gtm-intel /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 2. SSL Certificate (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx

sudo certbot --nginx -d gtm-intel.yourcompany.com

# Auto-renewal
sudo systemctl enable certbot.timer
```

---

## Monitoring & Logging

### 1. Application Monitoring

```bash
# PM2 monitoring
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7

# Health check endpoint
curl http://localhost:3000/health
```

### 2. Database Monitoring

```sql
-- Monitor active queries
SELECT pid, now() - query_start AS duration, query, state
FROM pg_stat_activity
WHERE state != 'idle'
ORDER BY duration DESC;

-- Monitor table sizes
SELECT schemaname, tablename,
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Monitor slow queries
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
```

### 3. Log Aggregation

Use services like:
- **Papertrail** - Simple log aggregation
- **DataDog** - Full observability
- **ELK Stack** - Self-hosted logging

### 4. Alerts

Setup alerts for:
- Server down (health check failures)
- High error rates (> 5% of requests)
- Database connection failures
- LinkedIn circuit breaker triggered
- Disk space < 20%

---

## Scaling

### Horizontal Scaling

1. **Load Balancer**: Use Nginx or HAProxy to distribute traffic
2. **Multiple App Instances**: Run on different servers
3. **Shared Database**: All instances connect to same PostgreSQL
4. **Rate Limit Coordination**: Use Redis to coordinate LinkedIn rate limits across instances

### Database Scaling

1. **Connection Pooling**: Already configured (max 20 connections)
2. **Read Replicas**: For high read loads
3. **Partitioning**: Partition `intelligence_signals` by date if table grows large

### Queue-Based Processing

For high volume, implement background job queue:

```bash
npm install bull redis
```

Configure Bull for research jobs to handle spikes.

---

## Security

### 1. Firewall

```bash
# Allow SSH, HTTP, HTTPS
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Block direct access to app port
sudo ufw deny 3000/tcp

# Enable firewall
sudo ufw enable
```

### 2. Database Security

```sql
-- Restrict database access
-- Edit /etc/postgresql/14/main/pg_hba.conf
# TYPE  DATABASE        USER            ADDRESS                 METHOD
local   all            postgres                                 peer
host    gtm_intel      gtm_intel_user  127.0.0.1/32            md5
host    gtm_intel      gtm_intel_user  ::1/128                 md5
```

### 3. Application Security

- Store `.env` securely, never commit to git
- Use secrets manager (AWS Secrets Manager, HashiCorp Vault)
- Rotate API keys regularly
- Implement API authentication (JWT, API keys)
- Enable CORS only for trusted domains
- Use helmet.js security headers (already configured)

---

## Backup & Recovery

### 1. Database Backups

```bash
# Daily backup script
#!/bin/bash
BACKUP_DIR=/backups/postgres
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

pg_dump -U gtm_intel_user gtm_intel | gzip > $BACKUP_DIR/gtm_intel_$DATE.sql.gz

# Keep only last 7 days
find $BACKUP_DIR -name "gtm_intel_*.sql.gz" -mtime +7 -delete
```

Add to crontab:

```bash
# Daily backup at 2 AM
0 2 * * * /home/gtm-intel/backup.sh
```

### 2. Application Backup

```bash
# Backup application code and config
tar -czf gtm-intel-backup-$(date +%Y%m%d).tar.gz \
  /home/gtm-intel/gtm-contact-intel \
  --exclude=node_modules \
  --exclude=logs
```

### 3. Restore Procedure

```bash
# Restore database
gunzip < backup.sql.gz | psql -U gtm_intel_user gtm_intel

# Restore application
tar -xzf gtm-intel-backup-20250115.tar.gz -C /home/gtm-intel/

# Reinstall dependencies
cd /home/gtm-intel/gtm-contact-intel
npm install --production

# Restart application
pm2 restart gtm-intel
```

---

## Troubleshooting

### Common Issues

**1. LinkedIn Circuit Breaker Triggered**
```bash
# Check Firecrawl rate limiter status
curl http://localhost:3000/api/health
# Wait 5 minutes, then check logs for reset
```

**2. Database Connection Pool Exhausted**
```sql
-- Check active connections
SELECT count(*) FROM pg_stat_activity WHERE datname = 'gtm_intel';

-- Kill idle connections
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = 'gtm_intel' AND state = 'idle' AND state_change < NOW() - INTERVAL '5 minutes';
```

**3. High Memory Usage**
```bash
# Restart PM2 instances
pm2 restart gtm-intel

# Check for memory leaks
pm2 monit
```

---

## Production Checklist

- [ ] PostgreSQL configured and backed up
- [ ] Application deployed with PM2/systemd
- [ ] Nginx reverse proxy configured
- [ ] SSL certificate installed and auto-renewal enabled
- [ ] Firewall configured
- [ ] Logging and monitoring setup
- [ ] Backup scripts configured and tested
- [ ] Restore procedure tested
- [ ] API keys secured and rotated
- [ ] Rate limits configured correctly
- [ ] Health checks monitored
- [ ] Documentation updated with server details

---

## Next Steps

1. Test complete research workflow
2. Monitor LinkedIn scraping for blocks
3. Setup alerts for critical failures
4. Document runbook for common issues
5. Train team on API usage

For questions, contact: ops@yourcompany.com
