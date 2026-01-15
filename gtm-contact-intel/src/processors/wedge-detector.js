const { linkedinQueries, githubQueries, signalQueries, companyQueries } = require('../db/queries');
const config = require('../../config/config');

/**
 * Wedge Detector
 * Identifies conversation starters and timing triggers with LinkedIn-first approach
 */
class WedgeDetector {
  constructor() {
    this.gtmKeywords = config.gtmTopics;
  }

  /**
   * Detect wedges for a contact
   * @param {number} contactId - Database contact ID
   * @returns {Promise<Object>} Detected wedges
   */
  async detectWedges(contactId) {
    console.log(`Detecting wedges for contact ${contactId}`);

    try {
      // Get all intelligence data
      const [linkedinProfile, linkedinPosts, signals, githubActivity] = await Promise.all([
        linkedinQueries.getProfile(contactId),
        linkedinQueries.getRecentPosts(contactId, 10),
        signalQueries.getSignalsByContact(contactId),
        githubQueries.getActivity(contactId)
      ]);

      const wedges = [];

      // PRIORITY 1: LinkedIn recent posts with pain points (Ultra-High Priority)
      const painPointWedges = this.detectPainPointWedges(linkedinPosts);
      wedges.push(...painPointWedges);

      // PRIORITY 2: LinkedIn recent posts with buying signals
      const buyingSignalWedges = this.detectBuyingSignalWedges(linkedinPosts);
      wedges.push(...buyingSignalWedges);

      // PRIORITY 3: LinkedIn new job timing
      const jobChangeWedges = this.detectJobChangeWedges(linkedinProfile, signals);
      wedges.push(...jobChangeWedges);

      // PRIORITY 4: LinkedIn high engagement posts (thought leadership)
      const thoughtLeadershipWedges = this.detectThoughtLeadershipWedges(linkedinPosts);
      wedges.push(...thoughtLeadershipWedges);

      // PRIORITY 5: LinkedIn + GitHub technical alignment
      const technicalWedges = this.detectTechnicalWedges(linkedinPosts, githubActivity);
      wedges.push(...technicalWedges);

      // PRIORITY 6: Company initiative signals
      const initiativeWedges = this.detectInitiativeWedges(signals);
      wedges.push(...initiativeWedges);

      // Sort wedges by score
      const sortedWedges = wedges.sort((a, b) => b.score - a.score);

      console.log(`Detected ${sortedWedges.length} wedges for contact ${contactId}`);

      return {
        wedges: sortedWedges,
        primaryWedge: sortedWedges[0] || null,
        wedgeCount: sortedWedges.length
      };

    } catch (error) {
      console.error(`Wedge detection failed for contact ${contactId}:`, error.message);
      return {
        wedges: [],
        primaryWedge: null,
        wedgeCount: 0
      };
    }
  }

  /**
   * Detect pain point wedges from LinkedIn posts
   */
  detectPainPointWedges(posts) {
    const wedges = [];

    const painPointPosts = posts.filter(p => p.mentions_pain_points);

    painPointPosts.forEach(post => {
      const daysSincePost = this.getDaysSince(post.post_date);
      const recencyBoost = daysSincePost < 7 ? 0.15 : daysSincePost < 14 ? 0.10 : 0.05;

      wedges.push({
        type: 'linkedin_pain_point',
        score: 0.95 + recencyBoost,
        description: `Recent LinkedIn post discussing pain points`,
        details: {
          postUrl: post.post_url,
          postDate: post.post_date,
          daysSince: daysSincePost,
          themes: post.key_themes,
          engagement: post.engagement_count,
          content_preview: post.post_content.substring(0, 200)
        },
        openingHook: this.generatePainPointHook(post),
        timingRationale: `Posted ${daysSincePost} days ago with ${post.engagement_count} engagements - indicates active, shared pain point`,
        conversationStarters: [
          `Saw your recent post about ${post.key_themes[0] || 'challenges'}`,
          `The ${post.engagement_count} responses to your post show this is a common issue`,
          `Your point about ${post.key_themes[0] || 'the problem'} really resonated`
        ]
      });
    });

    return wedges;
  }

  /**
   * Detect buying signal wedges
   */
  detectBuyingSignalWedges(posts) {
    const wedges = [];

    const buyingSignalPosts = posts.filter(p => p.mentions_buying_signals);

    buyingSignalPosts.forEach(post => {
      const daysSince = this.getDaysSince(post.post_date);

      wedges.push({
        type: 'linkedin_buying_signal',
        score: 0.98,
        description: `Active buying signal detected in LinkedIn post`,
        details: {
          postUrl: post.post_url,
          postDate: post.post_date,
          daysSince,
          content_preview: post.post_content.substring(0, 200)
        },
        openingHook: `Saw you're looking for ${this.extractBuyingIntent(post.post_content)} - happy to share what's worked for similar companies`,
        timingRationale: `Active evaluation happening now - posted ${daysSince} days ago`,
        conversationStarters: [
          `Saw your question about solutions for ${post.key_themes[0]}`,
          `Happy to share how similar companies approached this`,
          `Would love to share what we've learned from others in your situation`
        ]
      });
    });

    return wedges;
  }

  /**
   * Detect job change timing wedges
   */
  detectJobChangeWedges(profile, signals) {
    const wedges = [];

    if (!profile || !profile.current_position_tenure_months) {
      return wedges;
    }

    const tenureMonths = profile.current_position_tenure_months;

    // Recent job change (< 6 months)
    if (tenureMonths < 6) {
      wedges.push({
        type: 'linkedin_job_change_recent',
        score: 0.90,
        description: `Recently joined company ${tenureMonths} months ago`,
        details: {
          tenureMonths,
          phase: 'evaluation'
        },
        openingHook: `Congrats on the new role! Curious how you're approaching [relevant challenge] as you get settled`,
        timingRationale: `${tenureMonths} months in - still in evaluation phase, likely reviewing tech stack`,
        conversationStarters: [
          `Congrats on joining ${profile.current_company || 'your company'}`,
          `Curious what you're prioritizing in your first few months`,
          `How are you thinking about [relevant area] in your new role`
        ]
      });
    }
    // Optimal window (6-12 months)
    else if (tenureMonths >= 6 && tenureMonths <= 12) {
      wedges.push({
        type: 'linkedin_job_change_optimal',
        score: 0.85,
        description: `${tenureMonths} months into current role - past honeymoon phase`,
        details: {
          tenureMonths,
          phase: 'optimization'
        },
        openingHook: `${tenureMonths} months in - curious what challenges you're focusing on now`,
        timingRationale: `Past honeymoon phase but not entrenched - optimal time to evaluate new solutions`,
        conversationStarters: [
          `What's top of mind for you these days`,
          `What challenges are you tackling now that you're ${tenureMonths} months in`,
          `How's your approach to [relevant area] evolved since joining`
        ]
      });
    }

    return wedges;
  }

  /**
   * Detect thought leadership wedges
   */
  detectThoughtLeadershipWedges(posts) {
    const wedges = [];

    if (posts.length === 0) return wedges;

    // Calculate average engagement
    const avgEngagement = posts.reduce((sum, p) => sum + (p.engagement_count || 0), 0) / posts.length;

    // Find high-engagement posts (2x average)
    const highEngagementPosts = posts.filter(p =>
      (p.engagement_count || 0) > avgEngagement * 2
    );

    if (highEngagementPosts.length > 0) {
      const topPost = highEngagementPosts[0];
      const daysSince = this.getDaysSince(topPost.post_date);

      wedges.push({
        type: 'linkedin_thought_leadership',
        score: 0.85,
        description: `High-engagement LinkedIn post on relevant topic`,
        details: {
          postUrl: topPost.post_url,
          engagement: topPost.engagement_count,
          avgEngagement: Math.round(avgEngagement),
          topics: topPost.topics_detected,
          daysSince
        },
        openingHook: `Loved your recent post on ${topPost.key_themes[0] || topPost.topics_detected[0]} - especially your point about [specific insight]`,
        timingRationale: `High engagement (${topPost.engagement_count} vs ${Math.round(avgEngagement)} average) shows this topic resonates with their audience`,
        conversationStarters: [
          `Your post about ${topPost.key_themes[0] || 'this topic'} really resonated`,
          `The engagement on your recent post was impressive`,
          `Would love to hear more about your thoughts on ${topPost.topics_detected[0]}`
        ]
      });
    }

    // Active poster
    if (posts.length >= 10) {
      const topTopics = this.extractTopTopics(posts);

      wedges.push({
        type: 'linkedin_active_poster',
        score: 0.75,
        description: `Active LinkedIn poster (${posts.length} posts recently)`,
        details: {
          postCount: posts.length,
          topTopics
        },
        openingHook: `Appreciate your LinkedIn content on ${topTopics[0]} - clear you're thinking deeply about this`,
        timingRationale: `Active on LinkedIn - responsive to DMs and engaged with their network`,
        conversationStarters: [
          `Love following your LinkedIn content`,
          `Your posts on ${topTopics[0]} are always insightful`,
          `Clearly you're passionate about ${topTopics[0]}`
        ]
      });
    }

    return wedges;
  }

  /**
   * Detect technical wedges (LinkedIn + GitHub alignment)
   */
  detectTechnicalWedges(posts, githubActivity) {
    const wedges = [];

    if (!githubActivity) return wedges;

    // Check for technical discussions in LinkedIn posts
    const technicalPosts = posts.filter(p => {
      const topics = p.topics_detected || [];
      return topics.some(t =>
        ['API', 'integration', 'technical', 'developer', 'automation'].includes(t)
      );
    });

    if (technicalPosts.length > 0 && githubActivity.activity_score > 0.6) {
      wedges.push({
        type: 'technical_buyer',
        score: 0.80,
        description: `Technical buyer with LinkedIn + GitHub activity`,
        details: {
          githubActivity: githubActivity.activity_score,
          githubLanguages: githubActivity.primary_languages,
          linkedinTechnicalPosts: technicalPosts.length
        },
        openingHook: `Noticed your work in ${githubActivity.primary_languages?.[0]?.language || 'software development'} - curious how you evaluate technical solutions`,
        timingRationale: `Hands-on technical evaluator - values API docs, technical architecture`,
        conversationStarters: [
          `Saw your GitHub work in ${githubActivity.primary_languages?.[0]?.language}`,
          `How do you typically evaluate technical solutions`,
          `What matters most to you in terms of technical architecture`
        ]
      });
    }

    return wedges;
  }

  /**
   * Detect initiative wedges from company signals
   */
  detectInitiativeWedges(signals) {
    const wedges = [];

    // Find company initiative signals
    const initiativeSignals = signals.filter(s =>
      s.signal_category === 'timing_trigger' &&
      (s.signal_type === 'company_hiring' || s.signal_type === 'company_initiatives')
    );

    if (initiativeSignals.length > 0) {
      const signal = initiativeSignals[0];

      wedges.push({
        type: 'company_initiative',
        score: 0.70,
        description: `Company hiring/initiative signals detected`,
        details: {
          signal: signal.description,
          rawData: signal.raw_data
        },
        openingHook: `Noticed your company is [hiring/expanding] in [area] - curious how that ties into your priorities`,
        timingRationale: `Company expansion creates budget and urgency for new tools`,
        conversationStarters: [
          `Saw your company is expanding in [area]`,
          `How does [initiative] tie into your priorities`,
          `What's driving the [hiring/expansion]`
        ]
      });
    }

    return wedges;
  }

  // ===== HELPER METHODS =====

  getDaysSince(date) {
    return Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
  }

  generatePainPointHook(post) {
    const theme = post.key_themes[0] || 'this challenge';
    return `Saw your recent post about ${theme} - the ${post.engagement_count} responses show it's a common frustration. We've helped similar companies tackle this.`;
  }

  extractBuyingIntent(content) {
    const lowerContent = content.toLowerCase();

    if (lowerContent.includes('recommend')) return 'recommendations';
    if (lowerContent.includes('evaluat')) return 'solutions to evaluate';
    if (lowerContent.includes('looking for')) return 'a solution';
    if (lowerContent.includes('anyone use')) return 'tool recommendations';

    return 'solutions';
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
      .slice(0, 3);
  }
}

module.exports = new WedgeDetector();
