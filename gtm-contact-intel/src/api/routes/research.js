const express = require('express');
const router = express.Router();

const {
  contactQueries,
  linkedinQueries,
  githubQueries,
  speakingQueries,
  researchJobQueries,
  companyQueries
} = require('../../db/queries');

const linkedinAnalyzer = require('../../scrapers/linkedin-analyzer');
const githubAnalyzer = require('../../scrapers/github-analyzer');
const podcastFinder = require('../../scrapers/podcast-finder');
const jobParser = require('../../scrapers/job-parser');
const playbookGenerator = require('../../processors/playbook-generator');
const signalScorer = require('../../processors/signal-scorer');

/**
 * POST /api/research
 * Initiate research job for a contact
 */
router.post('/', async (req, res) => {
  try {
    const {
      full_name,
      linkedin_url,
      email,
      current_company,
      current_title,
      company_domain
    } = req.body;

    // Validate required fields
    if (!full_name || !linkedin_url) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['full_name', 'linkedin_url']
      });
    }

    // Create or update contact
    const contact = await contactQueries.upsertContact({
      full_name,
      linkedin_url,
      email,
      current_company,
      current_title,
      company_domain
    });

    // Create research job
    const job = await researchJobQueries.createJob(contact.id);

    // Start research in background
    performResearch(contact.id, job.id, {
      full_name,
      linkedin_url,
      current_company,
      current_title,
      company_domain
    }).catch(err => {
      console.error('Background research error:', err);
    });

    res.json({
      job_id: job.id,
      contact_id: contact.id,
      status: 'pending',
      message: 'Research job started',
      estimated_time: '3-5 minutes'
    });

  } catch (error) {
    console.error('Research initiation error:', error);
    res.status(500).json({
      error: 'Failed to initiate research',
      message: error.message
    });
  }
});

/**
 * GET /api/research/:jobId
 * Check research job status
 */
router.get('/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;

    const job = await researchJobQueries.getJob(jobId);

    if (!job) {
      return res.status(404).json({
        error: 'Job not found'
      });
    }

    res.json({
      job_id: job.id,
      contact_id: job.contact_id,
      status: job.status,
      requested_at: job.requested_at,
      completed_at: job.completed_at,
      results: job.results_summary,
      error: job.error_message
    });

  } catch (error) {
    console.error('Job status check error:', error);
    res.status(500).json({
      error: 'Failed to check job status',
      message: error.message
    });
  }
});

/**
 * GET /api/contacts/:contactId
 * Get full intelligence dossier for a contact
 */
router.get('/contacts/:contactId', async (req, res) => {
  try {
    const { contactId } = req.params;

    // First get the contact to check company_domain
    const contact = await contactQueries.getContactById(contactId);

    if (!contact) {
      return res.status(404).json({
        error: 'Contact not found'
      });
    }

    // Then get all other data in parallel
    const [
      linkedinProfile,
      linkedinPosts,
      githubActivity,
      speakingEngagements,
      topSignals,
      playbook,
      jobPostings
    ] = await Promise.all([
      linkedinQueries.getProfile(contactId),
      linkedinQueries.getRecentPosts(contactId, 10),
      githubQueries.getActivity(contactId),
      speakingQueries.getEngagements(contactId),
      signalScorer.getTopSignals(contactId, 10),
      playbookGenerator.generatePlaybook(contactId).then(r => r.playbook).catch(() => null),
      contact.company_domain
        ? companyQueries.getJobPostingsByCompany(contact.company_domain)
        : Promise.resolve([])
    ]);

    res.json({
      contact,
      linkedin_activity: {
        profile: linkedinProfile,
        recent_posts: linkedinPosts,
        influence_score: linkedinProfile?.influence_score
      },
      github_activity: githubActivity,
      speaking_engagements: speakingEngagements,
      intelligence_signals: topSignals,
      playbook,
      company_context: {
        job_postings: jobPostings
      }
    });

  } catch (error) {
    console.error('Contact dossier error:', error);
    res.status(500).json({
      error: 'Failed to retrieve contact dossier',
      message: error.message
    });
  }
});

/**
 * GET /api/signals/:contactId
 * Get all intelligence signals for a contact
 */
router.get('/signals/:contactId', async (req, res) => {
  try {
    const { contactId } = req.params;

    const signals = await signalScorer.scoreAndPrioritizeSignals(contactId);

    res.json({
      contact_id: parseInt(contactId),
      total_signals: signals.length,
      signals
    });

  } catch (error) {
    console.error('Signals retrieval error:', error);
    res.status(500).json({
      error: 'Failed to retrieve signals',
      message: error.message
    });
  }
});

/**
 * GET /api/playbook/:contactId
 * Get GTM playbook for a contact
 */
router.get('/playbook/:contactId', async (req, res) => {
  try {
    const { contactId } = req.params;

    const result = await playbookGenerator.generatePlaybook(contactId);

    if (!result.success) {
      return res.status(404).json({
        error: 'Playbook generation failed',
        message: result.error
      });
    }

    res.json({
      contact_id: parseInt(contactId),
      playbook: result.playbook
    });

  } catch (error) {
    console.error('Playbook retrieval error:', error);
    res.status(500).json({
      error: 'Failed to retrieve playbook',
      message: error.message
    });
  }
});

/**
 * GET /api/linkedin/recent-activity/:contactId
 * Get recent LinkedIn posts and activity
 */
router.get('/linkedin/recent-activity/:contactId', async (req, res) => {
  try {
    const { contactId } = req.params;
    const limit = parseInt(req.query.limit) || 20;

    const posts = await linkedinQueries.getRecentPosts(contactId, limit);

    if (!posts || posts.length === 0) {
      return res.json({
        contact_id: parseInt(contactId),
        posts: [],
        activity_summary: 'No LinkedIn posts found'
      });
    }

    const totalEngagement = posts.reduce((sum, p) => sum + (p.engagement_count || 0), 0);
    const avgEngagement = Math.round(totalEngagement / posts.length);

    res.json({
      contact_id: parseInt(contactId),
      posts: posts.map(p => ({
        post_url: p.post_url,
        post_date: p.post_date,
        content: p.post_content.substring(0, 500),
        engagement: {
          total: p.engagement_count,
          likes: p.likes_count,
          comments: p.comments_count,
          shares: p.shares_count
        },
        topics: p.topics_detected,
        sentiment: p.sentiment,
        mentions_pain_points: p.mentions_pain_points,
        mentions_buying_signals: p.mentions_buying_signals,
        key_themes: p.key_themes
      })),
      activity_summary: `${posts.length} posts analyzed, avg ${avgEngagement} engagements per post`
    });

  } catch (error) {
    console.error('LinkedIn activity retrieval error:', error);
    res.status(500).json({
      error: 'Failed to retrieve LinkedIn activity',
      message: error.message
    });
  }
});

/**
 * GET /api/linkedin/engagement-patterns/:contactId
 * Get LinkedIn engagement analysis
 */
router.get('/linkedin/engagement-patterns/:contactId', async (req, res) => {
  try {
    const { contactId } = req.params;

    const [profile, posts] = await Promise.all([
      linkedinQueries.getProfile(contactId),
      linkedinQueries.getRecentPosts(contactId, 30)
    ]);

    if (!posts || posts.length === 0) {
      return res.json({
        contact_id: parseInt(contactId),
        patterns: null,
        message: 'No LinkedIn activity found'
      });
    }

    const totalEngagement = posts.reduce((sum, p) => sum + (p.engagement_count || 0), 0);
    const avgEngagement = Math.round(totalEngagement / posts.length);

    const patterns = {
      posting_frequency: posts.length,
      avg_engagement_per_post: avgEngagement,
      total_engagement: totalEngagement,
      high_engagement_posts: posts.filter(p => (p.engagement_count || 0) > avgEngagement * 1.5).length,
      posts_with_pain_points: posts.filter(p => p.mentions_pain_points).length,
      posts_with_buying_signals: posts.filter(p => p.mentions_buying_signals).length,
      top_topics: this.extractTopTopics(posts),
      sentiment_distribution: this.analyzeSentiment(posts),
      influence_level: this.assessInfluence(profile, posts)
    };

    res.json({
      contact_id: parseInt(contactId),
      patterns
    });

  } catch (error) {
    console.error('Engagement patterns error:', error);
    res.status(500).json({
      error: 'Failed to analyze engagement patterns',
      message: error.message
    });
  }
});

// ===== HELPER FUNCTIONS =====

/**
 * Perform research in background
 */
async function performResearch(contactId, jobId, contactData) {
  try {
    await researchJobQueries.updateJobStatus(jobId, 'processing');

    const results = {
      linkedin: { found: false },
      github: { found: false },
      podcasts: { found: false },
      jobs: { analyzed: 0 }
    };

    // 1. LinkedIn research (PRIORITY)
    try {
      const linkedinResult = await linkedinAnalyzer.researchContact(
        contactId,
        contactData.linkedin_url
      );
      results.linkedin = {
        found: linkedinResult.success,
        posts_analyzed: linkedinResult.postsAnalyzed || 0,
        influence_score: linkedinResult.influenceScore || 0
      };
    } catch (error) {
      console.error('LinkedIn research error:', error.message);
    }

    // 2. GitHub research
    try {
      const githubResult = await githubAnalyzer.researchContact(
        contactId,
        contactData.full_name,
        contactData.current_company
      );
      results.github = {
        found: githubResult.success,
        username: githubResult.username
      };
    } catch (error) {
      console.error('GitHub research error:', error.message);
    }

    // 3. Podcast/speaking research
    try {
      const podcastResult = await podcastFinder.researchContact(
        contactId,
        contactData.full_name,
        contactData.current_title
      );
      results.podcasts = {
        found: podcastResult.success,
        count: podcastResult.count || 0
      };
    } catch (error) {
      console.error('Podcast research error:', error.message);
    }

    // 4. Job postings research
    if (contactData.company_domain) {
      try {
        const jobResult = await jobParser.researchCompany(
          contactId,
          contactData.company_domain,
          contactData.current_company
        );
        results.jobs = {
          analyzed: jobResult.analyzed || 0,
          signals: jobResult.gtmRelevantJobs || 0
        };
      } catch (error) {
        console.error('Job parsing error:', error.message);
      }
    }

    // 5. Generate playbook
    let playbookGenerated = false;
    try {
      const playbookResult = await playbookGenerator.generatePlaybook(contactId);
      playbookGenerated = playbookResult.success;
    } catch (error) {
      console.error('Playbook generation error:', error.message);
    }

    results.playbook_generated = playbookGenerated;

    // Mark job as completed
    await researchJobQueries.updateJobStatus(jobId, 'completed', null, results);

    console.log(`Research completed for contact ${contactId}`);

  } catch (error) {
    console.error('Research job error:', error);
    await researchJobQueries.updateJobStatus(jobId, 'failed', error.message);
  }
}

/**
 * Extract top topics from posts
 */
function extractTopTopics(posts) {
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
    .slice(0, 5)
    .map(([topic, count]) => ({ topic, count }));
}

/**
 * Analyze sentiment distribution
 */
function analyzeSentiment(posts) {
  const sentiments = { positive: 0, neutral: 0, negative: 0 };

  posts.forEach(post => {
    if (post.sentiment) {
      sentiments[post.sentiment]++;
    }
  });

  return sentiments;
}

/**
 * Assess influence level
 */
function assessInfluence(profile, posts) {
  if (!profile) return 'unknown';

  const avgEngagement = posts.length > 0
    ? posts.reduce((sum, p) => sum + (p.engagement_count || 0), 0) / posts.length
    : 0;

  if (profile.influence_score > 0.8 || avgEngagement > 100) return 'high';
  if (profile.influence_score > 0.6 || avgEngagement > 50) return 'medium';
  return 'low';
}

module.exports = router;
