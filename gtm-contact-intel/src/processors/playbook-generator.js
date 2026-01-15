const {
  contactQueries,
  linkedinQueries,
  githubQueries,
  speakingQueries,
  playbookQueries
} = require('../db/queries');
const signalScorer = require('./signal-scorer');
const wedgeDetector = require('./wedge-detector');

/**
 * Playbook Generator
 * Synthesizes all intelligence into actionable GTM strategies
 * LinkedIn-first approach: Uses LinkedIn posts as primary wedges
 */
class PlaybookGenerator {
  constructor() {
    // Outreach templates
    this.templates = {
      painPoint: this.generatePainPointOutreach,
      buyingSignal: this.generateBuyingSignalOutreach,
      jobChange: this.generateJobChangeOutreach,
      thoughtLeadership: this.generateThoughtLeadershipOutreach,
      technical: this.generateTechnicalOutreach,
      general: this.generateGeneralOutreach
    };
  }

  /**
   * Generate complete GTM playbook for a contact
   * @param {number} contactId - Database contact ID
   * @returns {Promise<Object>} Complete GTM playbook
   */
  async generatePlaybook(contactId) {
    console.log(`Generating GTM playbook for contact ${contactId}`);

    try {
      // Gather all intelligence
      const [contact, linkedinProfile, linkedinPosts, githubActivity, speakingEngagements, topSignals, wedges] =
        await Promise.all([
          contactQueries.getContactById(contactId),
          linkedinQueries.getProfile(contactId),
          linkedinQueries.getRecentPosts(contactId, 10),
          githubQueries.getActivity(contactId),
          speakingQueries.getEngagements(contactId),
          signalScorer.getTopSignals(contactId, 5),
          wedgeDetector.detectWedges(contactId)
        ]);

      if (!contact) {
        throw new Error('Contact not found');
      }

      // Determine primary wedge (highest scoring)
      const primaryWedge = wedges.primaryWedge;

      if (!primaryWedge) {
        console.warn(`No wedges found for contact ${contactId}`);
        return {
          success: false,
          error: 'Insufficient intelligence to generate playbook'
        };
      }

      // Build playbook
      const playbook = {
        // Primary wedge
        primary_wedge: primaryWedge.description,
        wedge_score: primaryWedge.score,

        // LinkedIn context (if available)
        linkedin_context: this.buildLinkedInContext(linkedinProfile, linkedinPosts, primaryWedge),

        // Supporting evidence
        supporting_evidence: this.buildSupportingEvidence(topSignals, wedges),

        // Personalization hooks
        personalization_hooks: this.buildPersonalizationHooks(
          contact,
          linkedinProfile,
          githubActivity,
          speakingEngagements
        ),

        // Timing rationale
        timing_rationale: this.buildTimingRationale(primaryWedge, linkedinProfile, topSignals),

        // Recommended channels
        recommended_channels: this.recommendChannels(linkedinProfile, linkedinPosts, githubActivity),

        // Sample outreach
        sample_outreach: this.generateOutreach(contact, primaryWedge, linkedinProfile, linkedinPosts),

        // Competitive context
        competitive_context: this.buildCompetitiveContext(topSignals),

        // Conversation starters
        conversation_starters: primaryWedge.conversationStarters || [],

        // Full strategy JSON
        full_strategy_json: {
          contact,
          primaryWedge,
          allWedges: wedges.wedges,
          topSignals,
          linkedinActivity: {
            profile: linkedinProfile,
            recentPosts: linkedinPosts.slice(0, 3)
          },
          githubActivity,
          speakingEngagements: speakingEngagements.slice(0, 3)
        }
      };

      // Save playbook to database
      await playbookQueries.savePlaybook(contactId, playbook);

      console.log(`Generated playbook for contact ${contactId} with primary wedge: ${primaryWedge.type}`);

      return {
        success: true,
        playbook
      };

    } catch (error) {
      console.error(`Playbook generation failed for contact ${contactId}:`, error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Build LinkedIn context section
   */
  buildLinkedInContext(profile, posts, primaryWedge) {
    if (!profile) return null;

    const context = {
      influence_score: profile.influence_score,
      connections: profile.connections_count,
      followers: profile.followers_count,
      recent_posts_count: posts.length,
      posting_frequency: this.assessPostingFrequency(posts.length)
    };

    // Add trigger post if primary wedge is LinkedIn-based
    if (primaryWedge.type.startsWith('linkedin_') && primaryWedge.details?.postUrl) {
      const triggerPost = posts.find(p => p.post_url === primaryWedge.details.postUrl);

      if (triggerPost) {
        context.trigger_post = {
          url: triggerPost.post_url,
          date: triggerPost.post_date,
          content_summary: triggerPost.post_content.substring(0, 150) + '...',
          engagement_level: this.assessEngagementLevel(
            triggerPost.engagement_count,
            posts.reduce((sum, p) => sum + (p.engagement_count || 0), 0) / posts.length
          ),
          topics: triggerPost.topics_detected
        };
      }
    }

    // Add profile signals
    if (profile.current_position_tenure_months) {
      context.profile_signals = {
        tenure: `${profile.current_position_tenure_months} months`,
        tenure_phase: this.getTenurePhase(profile.current_position_tenure_months),
        recent_change: profile.current_position_tenure_months < 6
      };
    }

    return context;
  }

  /**
   * Build supporting evidence list
   */
  buildSupportingEvidence(signals, wedges) {
    const evidence = [];

    // Add top signals as evidence
    signals.slice(0, 5).forEach(signal => {
      evidence.push(this.formatSignalAsEvidence(signal));
    });

    // Add secondary wedges as evidence
    wedges.wedges.slice(1, 4).forEach(wedge => {
      evidence.push(`${wedge.description} (${wedge.type})`);
    });

    return evidence;
  }

  /**
   * Build personalization hooks
   */
  buildPersonalizationHooks(contact, linkedinProfile, githubActivity, speakingEngagements) {
    const hooks = [];

    // LinkedIn profile hooks
    if (linkedinProfile) {
      if (linkedinProfile.previous_companies && linkedinProfile.previous_companies.length > 0) {
        hooks.push(`Previously worked at ${linkedinProfile.previous_companies[0]} - interesting transition`);
      }

      if (linkedinProfile.location) {
        hooks.push(`Based in ${linkedinProfile.location}`);
      }
    }

    // GitHub hooks
    if (githubActivity && githubActivity.github_username) {
      const topLang = githubActivity.primary_languages?.[0]?.language;
      if (topLang) {
        hooks.push(`Technical background in ${topLang} development`);
      }
    }

    // Speaking engagement hooks
    if (speakingEngagements && speakingEngagements.length > 0) {
      const latestTalk = speakingEngagements[0];
      hooks.push(`Recently spoke about ${latestTalk.topics?.[0] || 'industry topics'} at ${latestTalk.platform}`);
    }

    // Company hooks
    if (contact.current_company) {
      hooks.push(`Currently at ${contact.current_company} as ${contact.current_title || 'team member'}`);
    }

    return hooks;
  }

  /**
   * Build timing rationale
   */
  buildTimingRationale(primaryWedge, linkedinProfile, signals) {
    const rationale = [];

    // Primary wedge timing
    rationale.push(primaryWedge.timingRationale);

    // LinkedIn activity timing
    if (linkedinProfile?.current_position_tenure_months) {
      const tenure = linkedinProfile.current_position_tenure_months;
      if (tenure < 6) {
        rationale.push('In first 6 months of new role - actively evaluating tools and processes');
      } else if (tenure >= 6 && tenure <= 12) {
        rationale.push('Past honeymoon phase - has context to identify gaps and push for changes');
      }
    }

    // Signal-based timing
    const urgentSignals = signals.filter(s => parseFloat(s.urgency_score) > 0.8);
    if (urgentSignals.length > 0) {
      rationale.push(`${urgentSignals.length} high-urgency signals detected - time-sensitive opportunity`);
    }

    return rationale.join('. ');
  }

  /**
   * Recommend contact channels
   */
  recommendChannels(linkedinProfile, linkedinPosts, githubActivity) {
    const channels = {
      linkedin_dm: 0.5,
      email: 0.7,
      phone: 0.3
    };

    // Boost LinkedIn DM if active poster
    if (linkedinPosts && linkedinPosts.length >= 5) {
      channels.linkedin_dm = 0.95;
      channels.email = 0.6;
    }

    // Boost email as baseline
    channels.email = 0.8;

    // Lower phone for technical buyers
    if (githubActivity && githubActivity.activity_score > 0.6) {
      channels.phone = 0.2;
      channels.email = 0.9; // Technical buyers prefer written communication
    }

    return channels;
  }

  /**
   * Generate outreach message
   */
  generateOutreach(contact, primaryWedge, linkedinProfile, linkedinPosts) {
    // Select template based on wedge type
    let templateFn = this.templates.general;

    if (primaryWedge.type === 'linkedin_pain_point') {
      templateFn = this.templates.painPoint;
    } else if (primaryWedge.type === 'linkedin_buying_signal') {
      templateFn = this.templates.buyingSignal;
    } else if (primaryWedge.type.includes('job_change')) {
      templateFn = this.templates.jobChange;
    } else if (primaryWedge.type === 'linkedin_thought_leadership') {
      templateFn = this.templates.thoughtLeadership;
    } else if (primaryWedge.type === 'technical_buyer') {
      templateFn = this.templates.technical;
    }

    return templateFn.call(this, contact, primaryWedge, linkedinProfile, linkedinPosts);
  }

  /**
   * Build competitive context
   */
  buildCompetitiveContext(signals) {
    const techStackSignals = signals.filter(s => s.signal_type === 'company_tech_stack');

    if (techStackSignals.length === 0) {
      return 'No current tech stack information available';
    }

    const techStack = techStackSignals[0].raw_data?.techStack || [];
    return `Current stack includes: ${techStack.join(', ')}. Potential displacement opportunities.`;
  }

  // ===== OUTREACH TEMPLATES =====

  generatePainPointOutreach(contact, wedge, profile, posts) {
    const post = posts.find(p => p.post_url === wedge.details.postUrl);
    const theme = post?.key_themes?.[0] || 'this challenge';
    const engagement = post?.engagement_count || 0;

    return `Hi ${contact.full_name.split(' ')[0]},

Saw your recent post about ${theme} - the ${engagement} responses show this is hitting a nerve for a lot of folks.

We've worked with several ${contact.current_title}s at similar companies who were wrestling with the same issue. One example: [similar company] cut their [metric] by 40% after making a few changes to how they approached this.

Would you be open to a quick 15-minute call to share what worked for them? No pitch, just happy to share what we've learned.

Best,
[Your name]`;
  }

  generateBuyingSignalOutreach(contact, wedge) {
    return `Hi ${contact.full_name.split(' ')[0]},

Saw your post asking about [solution category] recommendations. Happy to share what's worked for similar companies - a few folks in your situation ended up choosing between [option A] and [option B] based on [key factor].

Would a quick call to walk through the decision framework be helpful? I can share what we've learned from helping others evaluate options.

Best,
[Your name]`;
  }

  generateJobChangeOutreach(contact, wedge, profile) {
    const months = profile?.current_position_tenure_months || 'recently';

    return `Hi ${contact.full_name.split(' ')[0]},

Congrats on the ${contact.current_title} role at ${contact.current_company}! Saw you joined about ${months} months ago.

Curious what you're prioritizing as you get settled - we've worked with several folks who came into similar roles and found [specific challenge] was the first thing they wanted to tackle.

Would love to hear what's top of mind for you. Open to a quick chat?

Best,
[Your name]`;
  }

  generateThoughtLeadershipOutreach(contact, wedge, profile, posts) {
    const topPost = posts[0];
    const topic = topPost?.key_themes?.[0] || topPost?.topics_detected?.[0] || 'your recent insights';

    return `Hi ${contact.full_name.split(' ')[0]},

Really appreciated your recent post on ${topic} - especially your point about [specific insight]. That's exactly what we're seeing across the market right now.

Would love to hear more about your experience with this. We've compiled some data from [X] companies on how they're approaching it that might be interesting to compare notes on.

Open to a quick call?

Best,
[Your name]`;
  }

  generateTechnicalOutreach(contact, wedge, profile) {
    return `Hi ${contact.full_name.split(' ')[0]},

Noticed your work in ${wedge.details.githubLanguages?.[0]?.language || 'software development'} - impressive background.

Curious how you typically evaluate technical solutions. We've built [product] specifically for technical buyers like you who care about [API quality/architecture/documentation].

Happy to do a technical deep-dive if you're interested. Can share our API docs and architecture diagrams upfront.

Best,
[Your name]`;
  }

  generateGeneralOutreach(contact, wedge) {
    return `Hi ${contact.full_name.split(' ')[0]},

I've been researching ${contact.current_company} and your work in ${contact.current_title || 'your role'}.

We've helped several companies in similar situations with [relevant challenge]. Would love to share what's worked and see if it might be relevant for you.

Open to a quick 15-minute call?

Best,
[Your name]`;
  }

  // ===== HELPER METHODS =====

  formatSignalAsEvidence(signal) {
    return `${signal.description} (relevance: ${Math.round(parseFloat(signal.relevance_score) * 100)}%)`;
  }

  assessPostingFrequency(postCount) {
    if (postCount >= 15) return 'very high';
    if (postCount >= 10) return 'high';
    if (postCount >= 5) return 'medium';
    return 'low';
  }

  assessEngagementLevel(postEngagement, avgEngagement) {
    const ratio = postEngagement / avgEngagement;
    if (ratio >= 2) return 'very high';
    if (ratio >= 1.5) return 'high';
    if (ratio >= 0.8) return 'medium';
    return 'low';
  }

  getTenurePhase(months) {
    if (months < 3) return 'onboarding';
    if (months < 6) return 'evaluation';
    if (months < 12) return 'optimization';
    if (months < 24) return 'established';
    return 'entrenched';
  }
}

module.exports = new PlaybookGenerator();
