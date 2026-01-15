const express = require('express');
const router = express.Router();
const { linkedinQueries, signalQueries } = require('../../db/queries');
const config = require('../../../config/config');

/**
 * POST /api/linkedin/manual-entry/:contactId
 * Manually add LinkedIn data for a contact
 * Use this when automated scraping fails or for immediate data entry
 */
router.post('/manual-entry/:contactId', async (req, res) => {
  try {
    const { contactId } = req.params;
    const { profile, posts } = req.body;

    if (!profile && !posts) {
      return res.status(400).json({
        error: 'Missing data',
        message: 'Provide at least profile or posts data'
      });
    }

    const results = {
      profile_saved: false,
      posts_saved: 0,
      signals_created: 0
    };

    // Save profile data if provided
    if (profile) {
      const profileData = {
        contact_id: contactId,
        linkedin_url: profile.linkedin_url || profile.url,
        profile_headline: profile.headline,
        location: profile.location,
        connections_count: profile.connections_count || profile.connections,
        followers_count: profile.followers_count || profile.followers,
        current_position_tenure_months: profile.tenure_months,
        previous_companies: profile.previous_companies || [],
        skills: profile.skills || [],
        certifications: profile.certifications || [],
        education: profile.education || null,
        profile_summary: profile.summary || profile.about,
        influence_score: profile.influence_score,
        raw_profile_data: profile
      };

      await linkedinQueries.saveProfile(contactId, profileData);
      results.profile_saved = true;

      // Create profile-based signals
      if (profile.tenure_months && profile.tenure_months < 6) {
        await signalQueries.createSignal(contactId, {
          signal_type: 'linkedin_profile_change',
          signal_category: 'timing_trigger',
          description: `Recently joined current company (${profile.tenure_months} months ago) - in evaluation phase`,
          relevance_score: 0.95,
          urgency_score: 0.95,
          wedge_potential: 0.90,
          raw_data: { tenureMonths: profile.tenure_months, source: 'manual_entry' }
        });
        results.signals_created++;
      }

      // Influence signal
      if (profile.connections_count > 500 || profile.followers_count > 500) {
        const influenceLevel = profile.connections_count > 2000 ? 'high' : 'medium';
        await signalQueries.createSignal(contactId, {
          signal_type: 'linkedin_activity',
          signal_category: 'thought_leadership',
          description: `${influenceLevel} LinkedIn influence: ${profile.connections_count} connections, ${profile.followers_count} followers`,
          relevance_score: 0.80,
          urgency_score: 0.60,
          wedge_potential: 0.70,
          raw_data: {
            connections: profile.connections_count,
            followers: profile.followers_count,
            source: 'manual_entry'
          }
        });
        results.signals_created++;
      }
    }

    // Save posts if provided
    if (posts && Array.isArray(posts) && posts.length > 0) {
      const formattedPosts = posts.map(post => ({
        contact_id: contactId,
        post_url: post.url || post.post_url || `https://linkedin.com/posts/${Date.now()}`,
        post_date: post.date || post.post_date || new Date(),
        post_content: post.content || post.text,
        post_type: post.type || 'post',
        engagement_count: post.engagement_count || (post.likes || 0) + (post.comments || 0) + (post.shares || 0),
        likes_count: post.likes || post.likes_count,
        comments_count: post.comments || post.comments_count,
        shares_count: post.shares || post.shares_count,
        topics_detected: post.topics || detectTopics(post.content || post.text),
        sentiment: post.sentiment || analyzeSentiment(post.content || post.text),
        key_themes: post.themes || post.key_themes || [],
        mentions_competitors: post.mentions_competitors || false,
        mentions_pain_points: post.mentions_pain_points || hasPainPoints(post.content || post.text),
        mentions_buying_signals: post.mentions_buying_signals || hasBuyingSignals(post.content || post.text),
        raw_post_data: post
      }));

      const savedPosts = await linkedinQueries.savePosts(contactId, formattedPosts);
      results.posts_saved = savedPosts.length;

      // Create post-based signals
      const painPointPosts = formattedPosts.filter(p => p.mentions_pain_points);
      if (painPointPosts.length > 0) {
        const latestPainPost = painPointPosts[0];
        const daysSince = Math.floor((Date.now() - new Date(latestPainPost.post_date)) / (1000 * 60 * 60 * 24));

        await signalQueries.createSignal(contactId, {
          signal_type: 'linkedin_content',
          signal_category: 'buying_signal',
          description: `Recently discussed challenges in LinkedIn post (${daysSince} days ago). Topics: ${latestPainPost.key_themes.join(', ')}`,
          relevance_score: 0.95,
          urgency_score: daysSince < 7 ? 0.95 : 0.85,
          wedge_potential: 0.95,
          raw_data: {
            postUrl: latestPainPost.post_url,
            postDate: latestPainPost.post_date,
            daysSince,
            source: 'manual_entry'
          }
        });
        results.signals_created++;
      }

      // High engagement signal
      const avgEngagement = formattedPosts.reduce((sum, p) => sum + (p.engagement_count || 0), 0) / formattedPosts.length;
      if (avgEngagement > 20) {
        await signalQueries.createSignal(contactId, {
          signal_type: 'linkedin_activity',
          signal_category: 'thought_leadership',
          description: `Active LinkedIn poster with ${formattedPosts.length} recent posts. Average ${Math.round(avgEngagement)} engagements per post.`,
          relevance_score: 0.85,
          urgency_score: 0.75,
          wedge_potential: 0.80,
          raw_data: {
            postCount: formattedPosts.length,
            avgEngagement: Math.round(avgEngagement),
            source: 'manual_entry'
          }
        });
        results.signals_created++;
      }
    }

    res.json({
      success: true,
      message: 'LinkedIn data saved successfully',
      results
    });

  } catch (error) {
    console.error('Manual LinkedIn entry error:', error);
    res.status(500).json({
      error: 'Failed to save LinkedIn data',
      message: error.message
    });
  }
});

/**
 * Helper: Detect topics in text
 */
function detectTopics(text) {
  if (!text) return [];

  const lowerText = text.toLowerCase();
  const topics = [];

  const allKeywords = [
    ...config.gtmTopics.gtmKeywords,
    ...config.gtmTopics.tools
  ];

  allKeywords.forEach(keyword => {
    if (lowerText.includes(keyword.toLowerCase())) {
      topics.push(keyword);
    }
  });

  return [...new Set(topics)].slice(0, 10);
}

/**
 * Helper: Analyze sentiment
 */
function analyzeSentiment(text) {
  if (!text) return 'neutral';

  const lowerText = text.toLowerCase();
  const positiveWords = ['excited', 'great', 'amazing', 'love', 'excellent', 'successful'];
  const negativeWords = ['frustrated', 'struggling', 'difficult', 'problem', 'broken'];

  const positiveCount = positiveWords.filter(word => lowerText.includes(word)).length;
  const negativeCount = negativeWords.filter(word => lowerText.includes(word)).length;

  if (positiveCount > negativeCount) return 'positive';
  if (negativeCount > positiveCount) return 'negative';
  return 'neutral';
}

/**
 * Helper: Check for pain points
 */
function hasPainPoints(text) {
  if (!text) return false;

  const lowerText = text.toLowerCase();
  return config.gtmTopics.painPoints.some(keyword =>
    lowerText.includes(keyword.toLowerCase())
  );
}

/**
 * Helper: Check for buying signals
 */
function hasBuyingSignals(text) {
  if (!text) return false;

  const lowerText = text.toLowerCase();
  return config.gtmTopics.buyingSignals.some(keyword =>
    lowerText.includes(keyword.toLowerCase())
  );
}

module.exports = router;
