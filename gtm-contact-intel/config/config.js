require('dotenv').config({ path: require('path').join(__dirname, '.env') });

module.exports = {
  server: {
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
  },

  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'gtm_intel',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    max: 20, // Max connections in pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  },

  apiKeys: {
    firecrawl: process.env.FIRECRAWL_API_KEY,
    github: process.env.GITHUB_TOKEN,
  },

  rateLimits: {
    linkedin: {
      delayMs: parseInt(process.env.LINKEDIN_SCRAPE_DELAY_MS) || 6000,
      maxRequestsPerMin: parseInt(process.env.LINKEDIN_MAX_REQUESTS_PER_MIN) || 10,
    },
    github: {
      maxRequestsPerMin: parseInt(process.env.GITHUB_MAX_REQUESTS_PER_MIN) || 30,
    },
    firecrawl: {
      maxRequestsPerMin: parseInt(process.env.FIRECRAWL_MAX_REQUESTS_PER_MIN) || 50,
    },
  },

  scraping: {
    linkedinPostLookbackDays: parseInt(process.env.LINKEDIN_POST_LOOKBACK_DAYS) || 30,
    maxLinkedinPostsPerProfile: parseInt(process.env.MAX_LINKEDIN_POSTS_PER_PROFILE) || 20,
    scrapeTimeoutMs: parseInt(process.env.SCRAPE_TIMEOUT_MS) || 30000,
  },

  intelligence: {
    minSignalRelevanceScore: parseFloat(process.env.MIN_SIGNAL_RELEVANCE_SCORE) || 0.5,
    linkedinRelevanceBoost: parseFloat(process.env.LINKEDIN_RELEVANCE_BOOST) || 0.3,
    topSignalsCount: parseInt(process.env.TOP_SIGNALS_COUNT) || 5,
  },

  // GTM topic keywords for content analysis
  gtmTopics: {
    painPoints: [
      'struggling with', 'challenge', 'problem', 'frustrating', 'broken',
      'inefficient', 'manual process', 'wasting time', 'tech debt',
      'difficult to', 'hard to', 'impossible to'
    ],
    tools: [
      'Salesforce', 'HubSpot', 'Outreach', 'SalesLoft', 'Gong', 'Chorus',
      'ZoomInfo', 'Apollo', 'Clay', 'Zapier', 'Marketo', 'Pardot',
      'Pipedrive', 'Monday.com', 'Asana', 'Slack'
    ],
    gtmKeywords: [
      'revenue operations', 'sales ops', 'GTM', 'go-to-market',
      'sales enablement', 'pipeline', 'forecasting', 'attribution',
      'lead scoring', 'territory planning', 'quota', 'conversion rate',
      'RevOps', 'sales operations', 'marketing operations', 'customer success',
      'account-based', 'ABM', 'demand generation', 'lead generation'
    ],
    initiatives: [
      'hiring', 'scaling', 'expanding', 'new role', 'transition',
      'implementing', 'migrating', 'evaluating', 'replacing',
      'rolling out', 'launching', 'building', 'growing'
    ],
    buyingSignals: [
      'evaluating', 'looking for', 'recommendations', 'budget approved',
      'planning to', 'starting to', 'need to solve', 'anyone recommend',
      'what do you use', 'suggestions for', 'advice on'
    ]
  }
};
