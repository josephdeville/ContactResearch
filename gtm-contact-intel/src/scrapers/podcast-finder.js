const axios = require('axios');
const { speakingQueries, signalQueries } = require('../db/queries');

/**
 * Podcast & Speaking Engagement Finder
 * Searches for podcast appearances, conference talks, and webinars
 */
class PodcastFinder {
  constructor() {
    this.searchEngines = {
      google: 'https://www.googleapis.com/customsearch/v1',
      youtube: 'https://www.googleapis.com/youtube/v3/search'
    };
  }

  /**
   * Research speaking engagements for a contact
   * @param {number} contactId - Database contact ID
   * @param {string} fullName - Contact's full name
   * @param {string} currentTitle - Current job title
   * @returns {Promise<Object>} Speaking engagement intelligence
   */
  async researchContact(contactId, fullName, currentTitle = '') {
    console.log(`Starting podcast/speaking research for contact ${contactId}`);

    try {
      const engagements = [];

      // Search strategy 1: Google search for podcast appearances
      const podcastResults = await this.searchPodcasts(fullName, currentTitle);
      engagements.push(...podcastResults);

      // Search strategy 2: YouTube search for conference talks
      const videoResults = await this.searchYouTube(fullName, currentTitle);
      engagements.push(...videoResults);

      // Search strategy 3: Search for webinar appearances
      const webinarResults = await this.searchWebinars(fullName);
      engagements.push(...webinarResults);

      // Analyze and score engagements
      const analyzedEngagements = this.analyzeEngagements(engagements);

      // Save to database
      for (const engagement of analyzedEngagements) {
        await speakingQueries.saveEngagement(contactId, engagement);
      }

      // Create intelligence signals
      if (analyzedEngagements.length > 0) {
        await this.createIntelligenceSignals(contactId, analyzedEngagements);
      }

      console.log(`Found ${analyzedEngagements.length} speaking engagements for contact ${contactId}`);

      return {
        success: true,
        engagements: analyzedEngagements,
        count: analyzedEngagements.length
      };

    } catch (error) {
      console.error(`Podcast research failed for contact ${contactId}:`, error.message);
      return {
        success: false,
        error: error.message,
        engagements: []
      };
    }
  }

  /**
   * Search for podcast appearances
   */
  async searchPodcasts(fullName, title) {
    const results = [];

    // Construct search queries
    const queries = [
      `"${fullName}" podcast`,
      `"${fullName}" interview`,
      `"${fullName}" ${title} podcast`
    ];

    // Note: This is a simplified implementation
    // Real implementation would use Google Custom Search API or podcast-specific APIs
    // For now, returning placeholder data structure

    // Simulated search results (would be replaced with actual API calls)
    const mockResults = this.generateMockPodcastResults(fullName);

    return mockResults;
  }

  /**
   * Search YouTube for conference talks and interviews
   */
  async searchYouTube(fullName, title) {
    const results = [];

    // Note: This would use YouTube Data API v3
    // Requires API key: https://developers.google.com/youtube/v3

    try {
      // Search query
      const query = `${fullName} ${title} conference OR talk OR interview`;

      // Mock implementation (would use actual YouTube API)
      const mockResults = this.generateMockYouTubeResults(fullName);

      return mockResults;

    } catch (error) {
      console.error('YouTube search error:', error.message);
      return [];
    }
  }

  /**
   * Search for webinar appearances
   */
  async searchWebinars(fullName) {
    // Search for webinar platforms: BrightTALK, ON24, etc.
    const queries = [
      `"${fullName}" webinar`,
      `"${fullName}" "virtual event"`,
      `"${fullName}" "online session"`
    ];

    // Mock implementation
    const mockResults = this.generateMockWebinarResults(fullName);

    return mockResults;
  }

  /**
   * Analyze and score speaking engagements
   */
  analyzeEngagements(engagements) {
    return engagements.map(engagement => {
      // Extract topics
      const topics = this.extractTopics(engagement.title, engagement.description || '');

      // Determine relevance score
      const relevanceScore = this.calculateRelevanceScore(topics, engagement);

      // Determine audience size
      const audienceSize = this.estimateAudienceSize(engagement);

      return {
        ...engagement,
        topics,
        relevance_score: relevanceScore,
        audience_size: audienceSize
      };
    });
  }

  /**
   * Extract topics from title and description
   */
  extractTopics(title, description) {
    const text = `${title} ${description}`.toLowerCase();
    const topics = [];

    // GTM-related topics
    const gtmKeywords = [
      'sales', 'marketing', 'revenue', 'GTM', 'go-to-market',
      'customer success', 'SaaS', 'B2B', 'growth',
      'pipeline', 'forecasting', 'operations', 'RevOps'
    ];

    gtmKeywords.forEach(keyword => {
      if (text.includes(keyword.toLowerCase())) {
        topics.push(keyword);
      }
    });

    return topics.length > 0 ? topics : ['general'];
  }

  /**
   * Calculate relevance score based on topics and recency
   */
  calculateRelevanceScore(topics, engagement) {
    let score = 0.5; // Base score

    // Topic relevance
    const gtmRelevantTopics = ['sales', 'marketing', 'revenue', 'GTM', 'RevOps'];
    const hasRelevantTopics = topics.some(t =>
      gtmRelevantTopics.some(gt => t.toLowerCase().includes(gt.toLowerCase()))
    );

    if (hasRelevantTopics) {
      score += 0.3;
    }

    // Recency bonus
    if (engagement.date) {
      const monthsSince = this.getMonthsSince(engagement.date);
      if (monthsSince < 3) score += 0.2;
      else if (monthsSince < 6) score += 0.1;
    }

    return Math.min(score, 1.0);
  }

  /**
   * Estimate audience size
   */
  estimateAudienceSize(engagement) {
    // Based on platform and engagement metrics
    if (engagement.platform === 'YouTube') {
      const views = engagement.views || 0;
      if (views > 10000) return 'large';
      if (views > 1000) return 'medium';
      return 'small';
    }

    if (engagement.type === 'conference') {
      return 'medium'; // Default for conferences
    }

    return 'unknown';
  }

  /**
   * Get months since a date
   */
  getMonthsSince(date) {
    const now = new Date();
    const past = new Date(date);
    const months = (now.getFullYear() - past.getFullYear()) * 12 +
                   (now.getMonth() - past.getMonth());
    return months;
  }

  /**
   * Create intelligence signals from speaking engagements
   */
  async createIntelligenceSignals(contactId, engagements) {
    const signals = [];

    // Signal 1: Recent podcast appearance
    const recentEngagements = engagements
      .filter(e => e.date && this.getMonthsSince(e.date) < 6)
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    if (recentEngagements.length > 0) {
      const latest = recentEngagements[0];
      signals.push({
        signal_type: 'speaking_engagement',
        signal_category: 'thought_leadership',
        description: `Recent ${latest.type} appearance: "${latest.title}" on ${latest.platform}. Active thought leader in ${latest.topics.join(', ')}.`,
        relevance_score: latest.relevance_score,
        urgency_score: 0.75,
        wedge_potential: 0.80,
        raw_data: {
          title: latest.title,
          platform: latest.platform,
          date: latest.date,
          url: latest.url
        }
      });
    }

    // Signal 2: Multiple speaking engagements (established thought leader)
    if (engagements.length >= 3) {
      signals.push({
        signal_type: 'speaking_engagement',
        signal_category: 'thought_leadership',
        description: `${engagements.length} speaking engagements found - established voice in the industry. Topics: ${[...new Set(engagements.flatMap(e => e.topics))].join(', ')}.`,
        relevance_score: 0.80,
        urgency_score: 0.65,
        wedge_potential: 0.75,
        raw_data: { count: engagements.length, topics: engagements.flatMap(e => e.topics) }
      });
    }

    // Signal 3: Large audience reach
    const largeAudienceEngagements = engagements.filter(e => e.audience_size === 'large');
    if (largeAudienceEngagements.length > 0) {
      signals.push({
        signal_type: 'speaking_engagement',
        signal_category: 'thought_leadership',
        description: `High-visibility speaking engagements with large audiences. Potential influential advocate.`,
        relevance_score: 0.85,
        urgency_score: 0.70,
        wedge_potential: 0.80,
        raw_data: { largeAudienceCount: largeAudienceEngagements.length }
      });
    }

    // Save signals
    for (const signal of signals) {
      await signalQueries.createSignal(contactId, signal);
    }

    console.log(`Created ${signals.length} speaking engagement signals for contact ${contactId}`);

    return signals;
  }

  // ===== MOCK DATA GENERATORS (Replace with actual API calls) =====

  generateMockPodcastResults(fullName) {
    // This would be replaced with actual search results
    return [
      {
        type: 'podcast',
        title: `${fullName} on Sales Leadership`,
        platform: 'Sales Hacker Podcast',
        date: new Date('2024-11-15'),
        url: 'https://example.com/podcast',
        description: 'Discussion about scaling sales operations',
        views: null
      }
    ];
  }

  generateMockYouTubeResults(fullName) {
    return [
      {
        type: 'conference',
        title: `${fullName} - Building Modern RevOps`,
        platform: 'YouTube',
        date: new Date('2024-10-01'),
        url: 'https://youtube.com/watch?v=example',
        description: 'Conference talk about revenue operations',
        views: 2500
      }
    ];
  }

  generateMockWebinarResults(fullName) {
    return [
      {
        type: 'webinar',
        title: `${fullName} on Pipeline Management`,
        platform: 'BrightTALK',
        date: new Date('2024-09-20'),
        url: 'https://brighttalk.com/example',
        description: 'Webinar about forecasting and pipeline',
        views: null
      }
    ];
  }
}

module.exports = new PodcastFinder();
