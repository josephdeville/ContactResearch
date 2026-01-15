const db = require('./client');

/**
 * Contact Queries
 */
const contactQueries = {
  // Create or update contact
  async upsertContact(contactData) {
    const { full_name, linkedin_url, email, current_company, current_title, company_domain } = contactData;

    const result = await db.query(
      `INSERT INTO contacts (full_name, linkedin_url, email, current_company, current_title, company_domain)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (linkedin_url) DO UPDATE SET
         full_name = EXCLUDED.full_name,
         email = EXCLUDED.email,
         current_company = EXCLUDED.current_company,
         current_title = EXCLUDED.current_title,
         company_domain = EXCLUDED.company_domain,
         updated_at = NOW()
       RETURNING *`,
      [full_name, linkedin_url, email, current_company, current_title, company_domain]
    );

    return result.rows[0];
  },

  async getContactById(contactId) {
    const result = await db.query(
      'SELECT * FROM contacts WHERE id = $1',
      [contactId]
    );
    return result.rows[0];
  },

  async getContactByLinkedIn(linkedinUrl) {
    const result = await db.query(
      'SELECT * FROM contacts WHERE linkedin_url = $1',
      [linkedinUrl]
    );
    return result.rows[0];
  }
};

/**
 * LinkedIn Queries
 */
const linkedinQueries = {
  // Save LinkedIn profile data
  async saveProfile(contactId, profileData) {
    const {
      linkedin_url, profile_headline, location, connections_count, followers_count,
      current_position_tenure_months, previous_companies, skills, certifications,
      education, profile_summary, influence_score, raw_profile_data
    } = profileData;

    const result = await db.query(
      `INSERT INTO linkedin_activity
       (contact_id, linkedin_url, profile_headline, location, connections_count,
        followers_count, current_position_tenure_months, previous_companies, skills,
        certifications, education, profile_summary, influence_score, raw_profile_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       ON CONFLICT (contact_id) DO UPDATE SET
         linkedin_url = EXCLUDED.linkedin_url,
         profile_headline = EXCLUDED.profile_headline,
         location = EXCLUDED.location,
         connections_count = EXCLUDED.connections_count,
         followers_count = EXCLUDED.followers_count,
         current_position_tenure_months = EXCLUDED.current_position_tenure_months,
         previous_companies = EXCLUDED.previous_companies,
         skills = EXCLUDED.skills,
         certifications = EXCLUDED.certifications,
         education = EXCLUDED.education,
         profile_summary = EXCLUDED.profile_summary,
         influence_score = EXCLUDED.influence_score,
         raw_profile_data = EXCLUDED.raw_profile_data,
         profile_scraped_at = NOW()
       RETURNING *`,
      [contactId, linkedin_url, profile_headline, location, connections_count, followers_count,
       current_position_tenure_months, previous_companies, skills, certifications,
       education, profile_summary, influence_score, raw_profile_data]
    );

    return result.rows[0];
  },

  // Save LinkedIn posts
  async savePosts(contactId, posts) {
    const insertPromises = posts.map(post => {
      const {
        post_url, post_date, post_content, post_type, engagement_count,
        likes_count, comments_count, shares_count, topics_detected,
        sentiment, key_themes, mentions_competitors, mentions_pain_points,
        mentions_buying_signals, raw_post_data
      } = post;

      return db.query(
        `INSERT INTO linkedin_posts
         (contact_id, post_url, post_date, post_content, post_type, engagement_count,
          likes_count, comments_count, shares_count, topics_detected, sentiment,
          key_themes, mentions_competitors, mentions_pain_points, mentions_buying_signals,
          raw_post_data)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
         ON CONFLICT (post_url) DO UPDATE SET
           post_content = EXCLUDED.post_content,
           engagement_count = EXCLUDED.engagement_count,
           likes_count = EXCLUDED.likes_count,
           comments_count = EXCLUDED.comments_count,
           shares_count = EXCLUDED.shares_count,
           topics_detected = EXCLUDED.topics_detected,
           sentiment = EXCLUDED.sentiment,
           key_themes = EXCLUDED.key_themes,
           mentions_competitors = EXCLUDED.mentions_competitors,
           mentions_pain_points = EXCLUDED.mentions_pain_points,
           mentions_buying_signals = EXCLUDED.mentions_buying_signals,
           scraped_at = NOW()
         RETURNING *`,
        [contactId, post_url, post_date, post_content, post_type, engagement_count,
         likes_count, comments_count, shares_count, topics_detected, sentiment,
         key_themes, mentions_competitors, mentions_pain_points, mentions_buying_signals,
         raw_post_data]
      );
    });

    const results = await Promise.all(insertPromises);
    return results.map(r => r.rows[0]);
  },

  // Get recent posts
  async getRecentPosts(contactId, limit = 20) {
    const result = await db.query(
      `SELECT * FROM linkedin_posts
       WHERE contact_id = $1
       ORDER BY post_date DESC
       LIMIT $2`,
      [contactId, limit]
    );
    return result.rows;
  },

  // Get LinkedIn profile
  async getProfile(contactId) {
    const result = await db.query(
      'SELECT * FROM linkedin_activity WHERE contact_id = $1',
      [contactId]
    );
    return result.rows[0];
  }
};

/**
 * GitHub Queries
 */
const githubQueries = {
  async saveActivity(contactId, activityData) {
    const {
      github_username, profile_url, followers, following, public_repos,
      contribution_count, primary_languages, recent_repos, activity_summary,
      last_commit_date, technical_focus_areas, activity_score, raw_profile_data
    } = activityData;

    const result = await db.query(
      `INSERT INTO github_activity
       (contact_id, github_username, profile_url, followers, following, public_repos,
        contribution_count, primary_languages, recent_repos, activity_summary,
        last_commit_date, technical_focus_areas, activity_score, raw_profile_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       ON CONFLICT (contact_id) DO UPDATE SET
         github_username = EXCLUDED.github_username,
         profile_url = EXCLUDED.profile_url,
         followers = EXCLUDED.followers,
         following = EXCLUDED.following,
         public_repos = EXCLUDED.public_repos,
         contribution_count = EXCLUDED.contribution_count,
         primary_languages = EXCLUDED.primary_languages,
         recent_repos = EXCLUDED.recent_repos,
         activity_summary = EXCLUDED.activity_summary,
         last_commit_date = EXCLUDED.last_commit_date,
         technical_focus_areas = EXCLUDED.technical_focus_areas,
         activity_score = EXCLUDED.activity_score,
         raw_profile_data = EXCLUDED.raw_profile_data,
         scraped_at = NOW()
       RETURNING *`,
      [contactId, github_username, profile_url, followers, following, public_repos,
       contribution_count, primary_languages, recent_repos, activity_summary,
       last_commit_date, technical_focus_areas, activity_score, raw_profile_data]
    );

    return result.rows[0];
  },

  async getActivity(contactId) {
    const result = await db.query(
      'SELECT * FROM github_activity WHERE contact_id = $1',
      [contactId]
    );
    return result.rows[0];
  }
};

/**
 * Intelligence Signal Queries
 */
const signalQueries = {
  async createSignal(contactId, signalData) {
    const {
      signal_type, signal_category, description, relevance_score,
      urgency_score, wedge_potential, raw_data
    } = signalData;

    const result = await db.query(
      `INSERT INTO intelligence_signals
       (contact_id, signal_type, signal_category, description,
        relevance_score, urgency_score, wedge_potential, raw_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [contactId, signal_type, signal_category, description,
       relevance_score, urgency_score, wedge_potential, raw_data]
    );

    return result.rows[0];
  },

  async getSignalsByContact(contactId, limit = null) {
    const query_text = limit
      ? `SELECT * FROM intelligence_signals
         WHERE contact_id = $1
         ORDER BY relevance_score DESC, urgency_score DESC, wedge_potential DESC
         LIMIT $2`
      : `SELECT * FROM intelligence_signals
         WHERE contact_id = $1
         ORDER BY relevance_score DESC, urgency_score DESC, wedge_potential DESC`;

    const params = limit ? [contactId, limit] : [contactId];
    const result = await db.query(query_text, params);
    return result.rows;
  },

  async getTopSignals(contactId, count = 5) {
    return this.getSignalsByContact(contactId, count);
  }
};

/**
 * Playbook Queries
 */
const playbookQueries = {
  async savePlaybook(contactId, playbookData) {
    const {
      primary_wedge, wedge_score, supporting_evidence, personalization_hooks,
      timing_rationale, recommended_channels, sample_outreach, competitive_context,
      conversation_starters, full_strategy_json
    } = playbookData;

    const result = await db.query(
      `INSERT INTO gtm_playbooks
       (contact_id, primary_wedge, wedge_score, supporting_evidence, personalization_hooks,
        timing_rationale, recommended_channels, sample_outreach, competitive_context,
        conversation_starters, full_strategy_json)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [contactId, primary_wedge, wedge_score, supporting_evidence, personalization_hooks,
       timing_rationale, recommended_channels, sample_outreach, competitive_context,
       conversation_starters, full_strategy_json]
    );

    return result.rows[0];
  },

  async getLatestPlaybook(contactId) {
    const result = await db.query(
      `SELECT * FROM gtm_playbooks
       WHERE contact_id = $1
       ORDER BY generated_at DESC
       LIMIT 1`,
      [contactId]
    );
    return result.rows[0];
  }
};

/**
 * Research Job Queries
 */
const researchJobQueries = {
  async createJob(contactId) {
    const result = await db.query(
      `INSERT INTO research_jobs (contact_id, status)
       VALUES ($1, 'pending')
       RETURNING *`,
      [contactId]
    );
    return result.rows[0];
  },

  async updateJobStatus(jobId, status, error = null, results = null) {
    const result = await db.query(
      `UPDATE research_jobs
       SET status = $2::varchar,
           error_message = $3,
           results_summary = $4::jsonb,
           completed_at = CASE WHEN $2::varchar IN ('completed', 'failed') THEN NOW() ELSE completed_at END
       WHERE id = $1
       RETURNING *`,
      [jobId, status, error, results ? JSON.stringify(results) : null]
    );
    return result.rows[0];
  },

  async getJob(jobId) {
    const result = await db.query(
      'SELECT * FROM research_jobs WHERE id = $1',
      [jobId]
    );
    return result.rows[0];
  }
};

/**
 * Company Queries
 */
const companyQueries = {
  async saveJobPosting(jobData) {
    const {
      company_domain, job_title, job_url, posted_date, department,
      seniority_level, initiative_signals, tech_stack_mentions,
      urgency_indicators, requirements_summary, raw_job_data
    } = jobData;

    const result = await db.query(
      `INSERT INTO job_postings
       (company_domain, job_title, job_url, posted_date, department, seniority_level,
        initiative_signals, tech_stack_mentions, urgency_indicators, requirements_summary,
        raw_job_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [company_domain, job_title, job_url, posted_date, department, seniority_level,
       initiative_signals, tech_stack_mentions, urgency_indicators, requirements_summary,
       raw_job_data]
    );

    return result.rows[0];
  },

  async getJobPostingsByCompany(companyDomain) {
    const result = await db.query(
      `SELECT * FROM job_postings
       WHERE company_domain = $1
       ORDER BY posted_date DESC`,
      [companyDomain]
    );
    return result.rows;
  }
};

/**
 * Speaking Engagement Queries
 */
const speakingQueries = {
  async saveEngagement(contactId, engagementData) {
    const {
      type, title, url, platform, date, topics, key_quotes,
      audience_size, relevance_score
    } = engagementData;

    const result = await db.query(
      `INSERT INTO speaking_engagements
       (contact_id, type, title, url, platform, date, topics, key_quotes,
        audience_size, relevance_score)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [contactId, type, title, url, platform, date, topics, key_quotes,
       audience_size, relevance_score]
    );

    return result.rows[0];
  },

  async getEngagements(contactId) {
    const result = await db.query(
      `SELECT * FROM speaking_engagements
       WHERE contact_id = $1
       ORDER BY date DESC`,
      [contactId]
    );
    return result.rows;
  }
};

module.exports = {
  contactQueries,
  linkedinQueries,
  githubQueries,
  signalQueries,
  playbookQueries,
  researchJobQueries,
  companyQueries,
  speakingQueries
};
