-- GTM Contact Intelligence Database Schema
-- PostgreSQL 14+
-- Focus: LinkedIn-first intelligence gathering

-- Drop tables if they exist (for clean reinstall)
DROP TABLE IF EXISTS gtm_playbooks CASCADE;
DROP TABLE IF EXISTS research_jobs CASCADE;
DROP TABLE IF EXISTS intelligence_signals CASCADE;
DROP TABLE IF EXISTS company_tech_stack CASCADE;
DROP TABLE IF EXISTS job_postings CASCADE;
DROP TABLE IF EXISTS speaking_engagements CASCADE;
DROP TABLE IF EXISTS github_activity CASCADE;
DROP TABLE IF EXISTS linkedin_profile_changes CASCADE;
DROP TABLE IF EXISTS linkedin_engagement CASCADE;
DROP TABLE IF EXISTS linkedin_posts CASCADE;
DROP TABLE IF EXISTS linkedin_activity CASCADE;
DROP TABLE IF EXISTS contacts CASCADE;

-- Core contact tracking
CREATE TABLE contacts (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    linkedin_url TEXT UNIQUE,
    email VARCHAR(255),
    current_company VARCHAR(255),
    current_title VARCHAR(255),
    company_domain VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- LinkedIn intelligence (PRIMARY INTELLIGENCE SOURCE)
CREATE TABLE linkedin_activity (
    id SERIAL PRIMARY KEY,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
    linkedin_url TEXT NOT NULL,
    profile_headline VARCHAR(500),
    location VARCHAR(255),
    connections_count INTEGER,
    followers_count INTEGER,
    current_position_tenure_months INTEGER,
    previous_companies TEXT[],
    skills TEXT[],
    certifications TEXT[],
    education JSONB,
    profile_summary TEXT,
    influence_score DECIMAL(3,2),
    raw_profile_data JSONB,
    profile_scraped_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(contact_id)
);

-- LinkedIn posts and engagement
CREATE TABLE linkedin_posts (
    id SERIAL PRIMARY KEY,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
    post_url TEXT UNIQUE,
    post_date TIMESTAMP,
    post_content TEXT,
    post_type VARCHAR(50), -- 'article', 'post', 'share', 'poll'
    engagement_count INTEGER,
    likes_count INTEGER,
    comments_count INTEGER,
    shares_count INTEGER,
    topics_detected TEXT[],
    sentiment VARCHAR(20), -- 'positive', 'neutral', 'negative'
    key_themes TEXT[],
    mentions_competitors BOOLEAN DEFAULT FALSE,
    mentions_pain_points BOOLEAN DEFAULT FALSE,
    mentions_buying_signals BOOLEAN DEFAULT FALSE,
    raw_post_data JSONB,
    scraped_at TIMESTAMP DEFAULT NOW()
);

-- LinkedIn engagement patterns
CREATE TABLE linkedin_engagement (
    id SERIAL PRIMARY KEY,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
    engagement_type VARCHAR(50), -- 'liked', 'commented', 'shared', 'mentioned'
    target_profile VARCHAR(255), -- Who they engaged with
    target_company VARCHAR(255),
    content_topic TEXT[],
    engagement_date TIMESTAMP,
    scraped_at TIMESTAMP DEFAULT NOW()
);

-- LinkedIn profile changes (job transitions, title updates)
CREATE TABLE linkedin_profile_changes (
    id SERIAL PRIMARY KEY,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
    change_type VARCHAR(50), -- 'job_change', 'title_update', 'company_update', 'location_change'
    old_value TEXT,
    new_value TEXT,
    detected_date TIMESTAMP DEFAULT NOW(),
    confidence_score DECIMAL(3,2)
);

-- GitHub intelligence
CREATE TABLE github_activity (
    id SERIAL PRIMARY KEY,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
    github_username VARCHAR(255),
    profile_url TEXT,
    followers INTEGER,
    following INTEGER,
    public_repos INTEGER,
    contribution_count INTEGER,
    primary_languages JSONB,
    recent_repos JSONB,
    activity_summary TEXT,
    last_commit_date TIMESTAMP,
    technical_focus_areas TEXT[],
    activity_score DECIMAL(3,2),
    raw_profile_data JSONB,
    scraped_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(contact_id)
);

-- Podcast & speaking engagements
CREATE TABLE speaking_engagements (
    id SERIAL PRIMARY KEY,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
    type VARCHAR(50), -- 'podcast', 'conference', 'webinar', 'interview'
    title TEXT NOT NULL,
    url TEXT,
    platform VARCHAR(255),
    date DATE,
    topics TEXT[],
    key_quotes TEXT[],
    audience_size VARCHAR(50), -- 'small', 'medium', 'large', 'unknown'
    relevance_score DECIMAL(3,2),
    scraped_at TIMESTAMP DEFAULT NOW()
);

-- Job posting intelligence
CREATE TABLE job_postings (
    id SERIAL PRIMARY KEY,
    company_domain VARCHAR(255) NOT NULL,
    job_title VARCHAR(255),
    job_url TEXT,
    posted_date DATE,
    department VARCHAR(100), -- 'Sales', 'RevOps', 'Marketing', etc.
    seniority_level VARCHAR(50), -- 'IC', 'Manager', 'Director', 'VP', 'C-Level'
    initiative_signals TEXT[],
    tech_stack_mentions TEXT[],
    urgency_indicators TEXT[],
    requirements_summary TEXT,
    raw_job_data JSONB,
    scraped_at TIMESTAMP DEFAULT NOW()
);

-- Company tech stack
CREATE TABLE company_tech_stack (
    id SERIAL PRIMARY KEY,
    company_domain VARCHAR(255) NOT NULL,
    category VARCHAR(100), -- 'CRM', 'Marketing Automation', 'Sales Engagement', etc.
    tool_name VARCHAR(255),
    confidence_score DECIMAL(3,2),
    detected_date DATE,
    source VARCHAR(100), -- 'job_posting', 'linkedin_post', 'github', 'builtwith'
    is_current BOOLEAN DEFAULT TRUE,
    metadata JSONB
);

-- Intelligence signals (aggregated insights)
CREATE TABLE intelligence_signals (
    id SERIAL PRIMARY KEY,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
    signal_type VARCHAR(50), -- 'linkedin_activity', 'linkedin_content', 'github_activity', etc.
    signal_category VARCHAR(50), -- 'thought_leadership', 'timing_trigger', 'buying_signal', 'technical'
    description TEXT,
    relevance_score DECIMAL(3,2),
    urgency_score DECIMAL(3,2),
    wedge_potential DECIMAL(3,2),
    raw_data JSONB,
    detected_at TIMESTAMP DEFAULT NOW()
);

-- GTM playbooks (generated strategies)
CREATE TABLE gtm_playbooks (
    id SERIAL PRIMARY KEY,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
    generated_at TIMESTAMP DEFAULT NOW(),
    primary_wedge TEXT,
    wedge_score DECIMAL(3,2),
    supporting_evidence TEXT[],
    personalization_hooks TEXT[],
    timing_rationale TEXT,
    recommended_channels JSONB,
    sample_outreach TEXT,
    competitive_context TEXT,
    conversation_starters TEXT[],
    full_strategy_json JSONB
);

-- Research job queue
CREATE TABLE research_jobs (
    id SERIAL PRIMARY KEY,
    contact_id INTEGER REFERENCES contacts(id),
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    requested_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    error_message TEXT,
    results_summary JSONB
);

-- Performance indexes
CREATE INDEX idx_contacts_company ON contacts(company_domain);
CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_contacts_linkedin ON contacts(linkedin_url);

CREATE INDEX idx_linkedin_contact ON linkedin_activity(contact_id);
CREATE INDEX idx_linkedin_scraped ON linkedin_activity(profile_scraped_at DESC);

CREATE INDEX idx_linkedin_posts_contact ON linkedin_posts(contact_id);
CREATE INDEX idx_linkedin_posts_date ON linkedin_posts(post_date DESC);
CREATE INDEX idx_linkedin_posts_pain ON linkedin_posts(mentions_pain_points) WHERE mentions_pain_points = TRUE;
CREATE INDEX idx_linkedin_posts_buying ON linkedin_posts(mentions_buying_signals) WHERE mentions_buying_signals = TRUE;

CREATE INDEX idx_linkedin_engagement_contact ON linkedin_engagement(contact_id);
CREATE INDEX idx_linkedin_engagement_date ON linkedin_engagement(engagement_date DESC);

CREATE INDEX idx_linkedin_changes_contact ON linkedin_profile_changes(contact_id);
CREATE INDEX idx_linkedin_changes_date ON linkedin_profile_changes(detected_date DESC);

CREATE INDEX idx_github_contact ON github_activity(contact_id);
CREATE INDEX idx_github_username ON github_activity(github_username);

CREATE INDEX idx_speaking_contact ON speaking_engagements(contact_id);
CREATE INDEX idx_speaking_date ON speaking_engagements(date DESC);

CREATE INDEX idx_jobs_company ON job_postings(company_domain);
CREATE INDEX idx_jobs_date ON job_postings(posted_date DESC);
CREATE INDEX idx_jobs_department ON job_postings(department);

CREATE INDEX idx_tech_company ON company_tech_stack(company_domain);
CREATE INDEX idx_tech_current ON company_tech_stack(is_current) WHERE is_current = TRUE;

CREATE INDEX idx_signals_contact ON intelligence_signals(contact_id);
CREATE INDEX idx_signals_score ON intelligence_signals(relevance_score DESC, urgency_score DESC, wedge_potential DESC);
CREATE INDEX idx_signals_type ON intelligence_signals(signal_type);
CREATE INDEX idx_signals_category ON intelligence_signals(signal_category);

CREATE INDEX idx_playbooks_contact ON gtm_playbooks(contact_id);
CREATE INDEX idx_playbooks_date ON gtm_playbooks(generated_at DESC);

CREATE INDEX idx_research_status ON research_jobs(status);
CREATE INDEX idx_research_contact ON research_jobs(contact_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to contacts table
CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE linkedin_activity IS 'Primary intelligence source - LinkedIn profile data';
COMMENT ON TABLE linkedin_posts IS 'LinkedIn post content and engagement metrics - HIGHEST PRIORITY for wedge detection';
COMMENT ON TABLE intelligence_signals IS 'Aggregated intelligence signals with scoring - LinkedIn signals get priority boost';
COMMENT ON TABLE gtm_playbooks IS 'Generated GTM strategies - LinkedIn posts used as primary wedges';

-- Grant permissions (adjust as needed for your user)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_app_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO your_app_user;
