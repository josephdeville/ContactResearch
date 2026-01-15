const firecrawl = require('./firecrawl-client');
const { linkedinQueries, signalQueries } = require('../db/queries');
const config = require('../../config/config');
const natural = require('natural');
const cheerio = require('cheerio');

/**
 * LinkedIn Analyzer - PRIMARY INTELLIGENCE SOURCE
 * Scrapes and analyzes LinkedIn profiles, posts, and engagement patterns
 */
class LinkedInAnalyzer {
  constructor() {
    this.tokenizer = new natural.WordTokenizer();
    this.tfidf = new natural.TfIdf();
    this.gtmKeywords = config.gtmTopics;
  }

  /**
   * Main orchestration method - Research a contact's LinkedIn activity
   * @param {number} contactId - Database contact ID
   * @param {string} linkedinUrl - LinkedIn profile URL
   * @returns {Promise<Object>} Complete LinkedIn intelligence
   */
  async researchContact(contactId, linkedinUrl) {
    console.log(`Starting LinkedIn research for contact ${contactId}`);

    try {
      // Step 1: Scrape profile
      console.log('Scraping LinkedIn profile...');
      const profileData = await this.scrapeProfile(linkedinUrl);

      if (!profileData.success) {
        throw new Error('Failed to scrape LinkedIn profile');
      }

      // Step 2: Parse profile data
      const profile = await this.parseProfile(profileData);

      // Step 3: Scrape recent posts
      console.log('Scraping LinkedIn posts...');
      const postsData = await this.scrapeRecentPosts(linkedinUrl);
      const posts = await this.parseAndAnalyzePosts(postsData);

      // Step 4: Analyze engagement patterns (from posts)
      const engagementPatterns = this.analyzeEngagement(posts);

      // Step 5: Calculate influence score
      const influenceScore = this.calculateInfluenceScore(profile, posts);
      profile.influence_score = influenceScore;

      // Step 6: Save all data to database
      await this.saveProfileData(contactId, profile);
      if (posts.length > 0) {
        await linkedinQueries.savePosts(contactId, posts);
      }

      // Step 7: Generate intelligence signals
      await this.createIntelligenceSignals(contactId, profile, posts, engagementPatterns);

      console.log(`LinkedIn research completed for contact ${contactId}`);

      return {
        success: true,
        profile,
        posts,
        postsAnalyzed: posts.length,
        influenceScore,
        engagementPatterns
      };

    } catch (error) {
      console.error(`LinkedIn research failed for contact ${contactId}:`, error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Scrape LinkedIn profile
   */
  async scrapeProfile(linkedinUrl) {
    try {
      const result = await firecrawl.scrapeLinkedInProfile(linkedinUrl);
      return result;
    } catch (error) {
      console.error('Profile scraping error:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Parse scraped profile data
   */
  async parseProfile(profileData) {
    if (!profileData.success) {
      throw new Error('Cannot parse failed profile scrape');
    }

    const markdown = profileData.markdown || '';
    const $ = cheerio.load(profileData.html || '');

    // Extract profile information from markdown/HTML
    // This is a simplified parser - real implementation would be more sophisticated
    const profile = {
      linkedin_url: profileData.url,
      profile_headline: this.extractHeadline(markdown),
      location: this.extractLocation(markdown),
      connections_count: this.extractConnectionsCount(markdown),
      followers_count: this.extractFollowersCount(markdown),
      current_position_tenure_months: this.calculateTenure(markdown),
      previous_companies: this.extractPreviousCompanies(markdown),
      skills: this.extractSkills(markdown),
      certifications: this.extractCertifications(markdown),
      education: this.extractEducation(markdown),
      profile_summary: this.extractSummary(markdown),
      raw_profile_data: {
        markdown: markdown.substring(0, 5000), // Store first 5000 chars
        scrapedAt: new Date().toISOString()
      }
    };

    return profile;
  }

  /**
   * Scrape recent LinkedIn posts
   */
  async scrapeRecentPosts(linkedinUrl) {
    try {
      const result = await firecrawl.scrapeLinkedInActivity(linkedinUrl);

      // Alternative: If activity page doesn't work, try individual post URLs
      // This would require post URLs to be provided separately

      return result;
    } catch (error) {
      console.error('Posts scraping error:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Parse and analyze posts
   */
  async parseAndAnalyzePosts(postsData) {
    if (!postsData.success || !postsData.markdown) {
      return [];
    }

    const markdown = postsData.markdown;

    // Parse posts from markdown
    // This is simplified - real implementation would parse LinkedIn's HTML structure
    const posts = this.extractPostsFromMarkdown(markdown);

    // Analyze each post
    const analyzedPosts = posts.map(post => {
      const analysis = this.analyzePostContent(post.post_content);

      return {
        ...post,
        topics_detected: analysis.topics,
        sentiment: analysis.sentiment,
        key_themes: analysis.themes,
        mentions_competitors: analysis.mentionsCompetitors,
        mentions_pain_points: analysis.mentionsPainPoints,
        mentions_buying_signals: analysis.mentionsBuyingSignals,
        raw_post_data: {
          originalContent: post.post_content,
          analyzedAt: new Date().toISOString()
        }
      };
    });

    // Filter to recent posts only
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - config.scraping.linkedinPostLookbackDays);

    const recentPosts = analyzedPosts
      .filter(p => new Date(p.post_date) >= cutoffDate)
      .slice(0, config.scraping.maxLinkedinPostsPerProfile);

    return recentPosts;
  }

  /**
   * Analyze post content for topics, sentiment, and signals
   */
  analyzePostContent(content) {
    const lowerContent = content.toLowerCase();

    // Detect topics
    const topics = [];
    const allKeywords = [
      ...this.gtmKeywords.gtmKeywords,
      ...this.gtmKeywords.tools,
      ...this.gtmKeywords.initiatives
    ];

    allKeywords.forEach(keyword => {
      if (lowerContent.includes(keyword.toLowerCase())) {
        topics.push(keyword);
      }
    });

    // Extract themes using TF-IDF
    this.tfidf.addDocument(content);
    const themes = [];
    this.tfidf.listTerms(0).slice(0, 5).forEach(item => {
      if (item.term.length > 3) {
        themes.push(item.term);
      }
    });

    // Detect pain points
    const mentionsPainPoints = this.gtmKeywords.painPoints.some(keyword =>
      lowerContent.includes(keyword.toLowerCase())
    );

    // Detect buying signals
    const mentionsBuyingSignals = this.gtmKeywords.buyingSignals.some(keyword =>
      lowerContent.includes(keyword.toLowerCase())
    );

    // Detect competitor mentions (would need specific competitor list)
    const mentionsCompetitors = false; // Placeholder

    // Sentiment analysis (simplified)
    const sentiment = this.analyzeSentiment(content);

    return {
      topics: [...new Set(topics)], // Deduplicate
      themes: [...new Set(themes)],
      mentionsPainPoints,
      mentionsBuyingSignals,
      mentionsCompetitors,
      sentiment
    };
  }

  /**
   * Simple sentiment analysis
   */
  analyzeSentiment(text) {
    const positiveWords = ['excited', 'great', 'amazing', 'love', 'excellent', 'fantastic', 'successful', 'happy'];
    const negativeWords = ['frustrated', 'struggling', 'difficult', 'problem', 'broken', 'challenging', 'disappointing'];

    const lowerText = text.toLowerCase();
    const positiveCount = positiveWords.filter(word => lowerText.includes(word)).length;
    const negativeCount = negativeWords.filter(word => lowerText.includes(word)).length;

    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  /**
   * Analyze engagement patterns
   */
  analyzeEngagement(posts) {
    const totalEngagement = posts.reduce((sum, p) => sum + (p.engagement_count || 0), 0);
    const avgEngagement = posts.length > 0 ? totalEngagement / posts.length : 0;

    const postingFrequency = posts.length; // In lookback period
    const highEngagementPosts = posts.filter(p => (p.engagement_count || 0) > avgEngagement * 1.5);

    return {
      totalPosts: posts.length,
      totalEngagement,
      avgEngagementPerPost: Math.round(avgEngagement),
      highEngagementPosts: highEngagementPosts.length,
      postingFrequency: postingFrequency > 10 ? 'high' : postingFrequency > 5 ? 'medium' : 'low',
      mostEngagedTopics: this.extractTopTopics(posts)
    };
  }

  /**
   * Calculate LinkedIn influence score
   */
  calculateInfluenceScore(profile, posts) {
    // Posting frequency score (0-1)
    const postingFrequency = posts.length / 10; // 10+ posts = 1.0
    const postingScore = Math.min(postingFrequency, 1.0);

    // Engagement rate score (0-1)
    const avgEngagement = posts.length > 0
      ? posts.reduce((sum, p) => sum + (p.engagement_count || 0), 0) / posts.length
      : 0;
    const engagementScore = Math.min(avgEngagement / 50, 1.0); // 50+ avg = 1.0

    // Network size score (0-1)
    const connections = profile.connections_count || 0;
    const followers = profile.followers_count || 0;
    const networkScore = Math.min((connections + followers) / 5000, 1.0); // 5000+ = 1.0

    // Content relevance score (0-1)
    const relevantPosts = posts.filter(p =>
      p.topics_detected && p.topics_detected.length > 0
    ).length;
    const relevanceScore = posts.length > 0 ? relevantPosts / posts.length : 0;

    // Weighted influence score
    const influenceScore = (
      postingScore * 0.25 +
      engagementScore * 0.25 +
      networkScore * 0.25 +
      relevanceScore * 0.25
    );

    return Math.round(influenceScore * 100) / 100; // Round to 2 decimals
  }

  /**
   * Save profile data to database
   */
  async saveProfileData(contactId, profile) {
    return await linkedinQueries.saveProfile(contactId, profile);
  }

  /**
   * Create intelligence signals from LinkedIn data
   */
  async createIntelligenceSignals(contactId, profile, posts, engagementPatterns) {
    const signals = [];

    // Signal 1: Recent posting activity
    if (posts.length > 5) {
      signals.push({
        signal_type: 'linkedin_activity',
        signal_category: 'thought_leadership',
        description: `Highly active on LinkedIn with ${posts.length} posts in last ${config.scraping.linkedinPostLookbackDays} days. Average ${engagementPatterns.avgEngagementPerPost} engagements per post.`,
        relevance_score: Math.min(0.9, 0.6 + (posts.length * 0.03)),
        urgency_score: 0.8,
        wedge_potential: 0.9,
        raw_data: { postCount: posts.length, avgEngagement: engagementPatterns.avgEngagementPerPost }
      });
    }

    // Signal 2: Recent job change
    const tenureMonths = profile.current_position_tenure_months || 999;
    if (tenureMonths < 6) {
      signals.push({
        signal_type: 'linkedin_profile_change',
        signal_category: 'timing_trigger',
        description: `Recently joined current company (${tenureMonths} months ago) - in evaluation phase`,
        relevance_score: 0.95,
        urgency_score: 0.95,
        wedge_potential: 0.9,
        raw_data: { tenureMonths }
      });
    } else if (tenureMonths >= 6 && tenureMonths <= 12) {
      signals.push({
        signal_type: 'linkedin_profile_change',
        signal_category: 'timing_trigger',
        description: `${tenureMonths} months into current role - past honeymoon phase, likely evaluating tools`,
        relevance_score: 0.85,
        urgency_score: 0.75,
        wedge_potential: 0.85,
        raw_data: { tenureMonths }
      });
    }

    // Signal 3: Pain point mentions in posts
    const painPointPosts = posts.filter(p => p.mentions_pain_points);
    if (painPointPosts.length > 0) {
      const latestPainPost = painPointPosts[0]; // Most recent
      const daysSincePost = Math.floor(
        (Date.now() - new Date(latestPainPost.post_date)) / (1000 * 60 * 60 * 24)
      );

      signals.push({
        signal_type: 'linkedin_content',
        signal_category: 'buying_signal',
        description: `Recently discussed challenges: "${latestPainPost.key_themes.join(', ')}". Posted ${daysSincePost} days ago with ${latestPainPost.engagement_count} engagements - indicates active pain point.`,
        relevance_score: 0.95,
        urgency_score: daysSincePost < 7 ? 0.95 : daysSincePost < 14 ? 0.85 : 0.75,
        wedge_potential: 0.95,
        raw_data: {
          postUrl: latestPainPost.post_url,
          postDate: latestPainPost.post_date,
          themes: latestPainPost.key_themes,
          engagement: latestPainPost.engagement_count
        }
      });
    }

    // Signal 4: Buying signals in posts
    const buyingSignalPosts = posts.filter(p => p.mentions_buying_signals);
    if (buyingSignalPosts.length > 0) {
      const latestBuyingPost = buyingSignalPosts[0];
      signals.push({
        signal_type: 'linkedin_content',
        signal_category: 'buying_signal',
        description: `Active buying signals detected: "${latestBuyingPost.post_content.substring(0, 100)}..." - asking for recommendations or evaluating solutions`,
        relevance_score: 0.98,
        urgency_score: 0.95,
        wedge_potential: 0.98,
        raw_data: {
          postUrl: latestBuyingPost.post_url,
          postDate: latestBuyingPost.post_date
        }
      });
    }

    // Signal 5: Topic expertise
    const topTopics = this.extractTopTopics(posts);
    if (topTopics.length > 0) {
      signals.push({
        signal_type: 'linkedin_content',
        signal_category: 'thought_leadership',
        description: `Primary content themes: ${topTopics.slice(0, 5).join(', ')}. Established voice in these areas.`,
        relevance_score: 0.8,
        urgency_score: 0.6,
        wedge_potential: 0.75,
        raw_data: { topics: topTopics }
      });
    }

    // Signal 6: High engagement posts (viral content)
    const highEngagementPosts = posts
      .filter(p => (p.engagement_count || 0) > engagementPatterns.avgEngagementPerPost * 2)
      .slice(0, 3);

    if (highEngagementPosts.length > 0) {
      signals.push({
        signal_type: 'linkedin_activity',
        signal_category: 'thought_leadership',
        description: `${highEngagementPosts.length} posts with 2x average engagement - strong audience resonance on: ${highEngagementPosts.map(p => p.key_themes.slice(0, 2).join(', ')).join('; ')}`,
        relevance_score: 0.85,
        urgency_score: 0.7,
        wedge_potential: 0.8,
        raw_data: { posts: highEngagementPosts.map(p => ({ url: p.post_url, engagement: p.engagement_count })) }
      });
    }

    // Signal 7: Influence score
    if (profile.influence_score > 0.7) {
      signals.push({
        signal_type: 'linkedin_activity',
        signal_category: 'thought_leadership',
        description: `High LinkedIn influence score (${profile.influence_score}): ${profile.connections_count}+ connections, regular posting, strong engagement`,
        relevance_score: 0.8,
        urgency_score: 0.6,
        wedge_potential: 0.7,
        raw_data: {
          influenceScore: profile.influence_score,
          connections: profile.connections_count,
          followers: profile.followers_count
        }
      });
    }

    // Save all signals to database
    for (const signal of signals) {
      await signalQueries.createSignal(contactId, signal);
    }

    console.log(`Created ${signals.length} LinkedIn intelligence signals for contact ${contactId}`);

    return signals;
  }

  // ===== EXTRACTION HELPERS =====

  extractHeadline(markdown) {
    // Extract headline from markdown (simplified)
    const lines = markdown.split('\n');
    for (const line of lines) {
      if (line.includes('|') && !line.includes('###')) {
        return line.trim().substring(0, 500);
      }
    }
    return null;
  }

  extractLocation(markdown) {
    const locationMatch = markdown.match(/Location[:\s]+([^\n]+)/i);
    return locationMatch ? locationMatch[1].trim() : null;
  }

  extractConnectionsCount(markdown) {
    const match = markdown.match(/(\d+[\d,]*)\s*connections?/i);
    return match ? parseInt(match[1].replace(/,/g, '')) : null;
  }

  extractFollowersCount(markdown) {
    const match = markdown.match(/(\d+[\d,]*)\s*followers?/i);
    return match ? parseInt(match[1].replace(/,/g, '')) : null;
  }

  calculateTenure(markdown) {
    // Simplified tenure calculation
    // Would need to parse work history section more carefully
    const currentYearMatch = markdown.match(/(\d{4})\s*[-–]\s*Present/i);
    if (currentYearMatch) {
      const startYear = parseInt(currentYearMatch[1]);
      const currentYear = new Date().getFullYear();
      return (currentYear - startYear) * 12; // Rough estimate in months
    }
    return null;
  }

  extractPreviousCompanies(markdown) {
    // Simplified - would parse Experience section
    const companies = [];
    const companyMatches = markdown.match(/(?:at|@)\s+([A-Z][a-zA-Z\s&]+?)(?:\n|$)/g);
    if (companyMatches) {
      companyMatches.forEach(match => {
        const company = match.replace(/(?:at|@)\s+/, '').trim();
        if (company && !companies.includes(company)) {
          companies.push(company);
        }
      });
    }
    return companies.slice(0, 5); // Return top 5
  }

  extractSkills(markdown) {
    // Simplified - would parse Skills section
    const skills = [];
    const skillsSection = markdown.match(/Skills?([\s\S]*?)(?=\n##|\n###|$)/i);
    if (skillsSection) {
      const skillMatches = skillsSection[1].match(/[A-Z][a-zA-Z\s]+/g);
      if (skillMatches) {
        skills.push(...skillMatches.map(s => s.trim()).filter(s => s.length > 2));
      }
    }
    return skills.slice(0, 20); // Return top 20
  }

  extractCertifications(markdown) {
    const certifications = [];
    const certsSection = markdown.match(/Certifications?([\s\S]*?)(?=\n##|\n###|$)/i);
    if (certsSection) {
      const certMatches = certsSection[1].match(/[-•]\s*([^\n]+)/g);
      if (certMatches) {
        certifications.push(...certMatches.map(c => c.replace(/[-•]\s*/, '').trim()));
      }
    }
    return certifications;
  }

  extractEducation(markdown) {
    // Return as JSON
    const education = [];
    const eduSection = markdown.match(/Education([\s\S]*?)(?=\n##|\n###|$)/i);
    if (eduSection) {
      // Simplified parsing
      education.push({ raw: eduSection[1].trim().substring(0, 500) });
    }
    return education.length > 0 ? education : null;
  }

  extractSummary(markdown) {
    const summarySection = markdown.match(/(?:About|Summary)([\s\S]*?)(?=\n##|\n###|$)/i);
    return summarySection ? summarySection[1].trim().substring(0, 1000) : null;
  }

  extractPostsFromMarkdown(markdown) {
    // Simplified post extraction
    // Real implementation would parse LinkedIn's post structure
    const posts = [];

    // This is a placeholder - actual parsing would be more sophisticated
    const postPattern = /(?:Post|Activity)[\s\S]{0,500}?(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/gi;
    const matches = markdown.match(postPattern);

    if (matches) {
      matches.forEach((match, index) => {
        // Extract basic post data
        posts.push({
          post_url: `https://linkedin.com/posts/activity-${index}`, // Placeholder
          post_date: new Date(), // Would parse from match
          post_content: match.substring(0, 500),
          post_type: 'post',
          engagement_count: Math.floor(Math.random() * 100), // Would parse actual engagement
          likes_count: null,
          comments_count: null,
          shares_count: null
        });
      });
    }

    return posts;
  }

  extractTopTopics(posts) {
    const topicCounts = {};

    posts.forEach(post => {
      if (post.topics_detected) {
        post.topics_detected.forEach(topic => {
          topicCounts[topic] = (topicCounts[topic] || 0) + 1;
        });
      }
    });

    return Object.entries(topicCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([topic]) => topic)
      .slice(0, 10);
  }
}

module.exports = new LinkedInAnalyzer();
