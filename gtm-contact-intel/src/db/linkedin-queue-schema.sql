-- LinkedIn Profile Queue for Automation
-- Tracks profiles to scrape and their status

CREATE TABLE IF NOT EXISTS linkedin_scrape_queue (
    id SERIAL PRIMARY KEY,
    linkedin_url TEXT UNIQUE NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed', 'rate_limited'
    priority INTEGER DEFAULT 0, -- Higher priority processed first
    attempts INTEGER DEFAULT 0,
    last_attempt_at TIMESTAMP,
    completed_at TIMESTAMP,
    error_message TEXT,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
    added_at TIMESTAMP DEFAULT NOW(),
    metadata JSONB -- Store any extra info like company, title for pre-filtering
);

-- Indexes for queue processing
CREATE INDEX IF NOT EXISTS idx_queue_status ON linkedin_scrape_queue(status);
CREATE INDEX IF NOT EXISTS idx_queue_priority ON linkedin_scrape_queue(priority DESC, added_at ASC);
CREATE INDEX IF NOT EXISTS idx_queue_url ON linkedin_scrape_queue(linkedin_url);

COMMENT ON TABLE linkedin_scrape_queue IS 'Queue for automated LinkedIn profile scraping with rate limiting';
