const {
  contactQueries,
  linkedinQueries,
  githubQueries,
  speakingQueries,
  playbookQueries
} = require('../db/queries');
const signalScorer = require('../processors/signal-scorer');

/**
 * Clay Formatter
 * Formats contact intelligence for Clay table enrichment
 * LinkedIn signals prioritized in output
 */
class ClayFormatter {
  /**
   * Format a single contact for Clay
   * @param {number} contactId - Database contact ID
   * @returns {Promise<Object>} Clay-formatted data
   */
  async formatContact(contactId) {
    try {
      // Gather all data
      const [
        contact,
        linkedinProfile,
        linkedinPosts,
        githubActivity,
        speakingEngagements,
        topSignals,
        playbook
      ] = await Promise.all([
        contactQueries.getContactById(contactId),
        linkedinQueries.getProfile(contactId),
        linkedinQueries.getRecentPosts(contactId, 5),
        githubQueries.getActivity(contactId),
        speakingQueries.getEngagements(contactId),
        signalScorer.getTopSignals(contactId, 5),
        playbookQueries.getLatestPlaybook(contactId)
      ]);

      if (!contact) {
        throw new Error('Contact not found');
      }

      // Format for Clay
      const clayData = {
        // Basic contact info
        contact_name: contact.full_name,
        contact_email: contact.email,
        company: contact.current_company,
        title: contact.current_title,
        company_domain: contact.company_domain,

        // LinkedIn fields (PRIORITY)
        linkedin_url: contact.linkedin_url,
        linkedin_headline: linkedinProfile?.profile_headline || null,
        linkedin_location: linkedinProfile?.location || null,
        linkedin_connections: linkedinProfile?.connections_count || null,
        linkedin_followers: linkedinProfile?.followers_count || null,
        linkedin_influence_score: linkedinProfile?.influence_score || null,

        // LinkedIn activity
        linkedin_recent_posts: linkedinPosts?.length || 0,
        linkedin_last_post_date: linkedinPosts?.[0]?.post_date || null,
        linkedin_last_post_url: linkedinPosts?.[0]?.post_url || null,
        linkedin_last_post_topic: linkedinPosts?.[0]?.topics_detected?.[0] || null,
        linkedin_last_post_engagement: linkedinPosts?.[0]?.engagement_count || null,
        linkedin_mentions_pain_points: linkedinPosts?.some(p => p.mentions_pain_points) || false,
        linkedin_mentions_buying_signals: linkedinPosts?.some(p => p.mentions_buying_signals) || false,

        // LinkedIn profile signals
        linkedin_tenure_months: linkedinProfile?.current_position_tenure_months || null,
        linkedin_tenure_phase: this.getTenurePhase(linkedinProfile?.current_position_tenure_months),
        linkedin_recent_job_change: (linkedinProfile?.current_position_tenure_months || 999) < 6,
        linkedin_previous_companies: linkedinProfile?.previous_companies?.slice(0, 3).join(', ') || null,
        linkedin_skills: linkedinProfile?.skills?.slice(0, 5).join(', ') || null,

        // GitHub fields
        github_username: githubActivity?.github_username || null,
        github_profile_url: githubActivity?.profile_url || null,
        github_followers: githubActivity?.followers || null,
        github_public_repos: githubActivity?.public_repos || null,
        github_activity_score: githubActivity?.activity_score || null,
        github_primary_language: githubActivity?.primary_languages?.[0]?.language || null,
        github_technical_focus: githubActivity?.technical_focus_areas?.slice(0, 3).join(', ') || null,

        // Speaking engagements
        podcast_count: speakingEngagements?.length || 0,
        latest_podcast: speakingEngagements?.[0]
          ? `${speakingEngagements[0].platform} - ${speakingEngagements[0].title}`
          : null,
        latest_podcast_date: speakingEngagements?.[0]?.date || null,
        speaking_topics: speakingEngagements?.[0]?.topics?.join(', ') || null,

        // Top signals (LinkedIn prioritized)
        top_signal_1: topSignals?.[0]?.description || null,
        top_signal_1_type: topSignals?.[0]?.signal_type || null,
        top_signal_1_score: topSignals?.[0]
          ? this.calculateDisplayScore(topSignals[0])
          : null,

        top_signal_2: topSignals?.[1]?.description || null,
        top_signal_2_type: topSignals?.[1]?.signal_type || null,
        top_signal_2_score: topSignals?.[1]
          ? this.calculateDisplayScore(topSignals[1])
          : null,

        top_signal_3: topSignals?.[2]?.description || null,
        top_signal_3_type: topSignals?.[2]?.signal_type || null,

        top_signal_4: topSignals?.[3]?.description || null,
        top_signal_4_type: topSignals?.[3]?.signal_type || null,

        top_signal_5: topSignals?.[4]?.description || null,
        top_signal_5_type: topSignals?.[4]?.signal_type || null,

        // Playbook fields
        primary_wedge: playbook?.primary_wedge || null,
        wedge_score: playbook?.wedge_score || null,
        timing_trigger: playbook?.timing_rationale || null,
        recommended_channel: this.getTopChannel(playbook?.recommended_channels),
        recommended_channel_score: this.getTopChannelScore(playbook?.recommended_channels),

        // Sample outreach (truncated for Clay)
        sample_outreach_preview: playbook?.sample_outreach
          ? playbook.sample_outreach.substring(0, 200) + '...'
          : null,

        // Metadata
        research_completed_at: contact.updated_at,
        total_signals_count: topSignals?.length || 0,

        // Convenience fields
        is_high_priority: this.isHighPriority(linkedinProfile, linkedinPosts, topSignals),
        contact_readiness_score: this.calculateContactReadiness(
          linkedinProfile,
          linkedinPosts,
          topSignals,
          playbook
        )
      };

      return clayData;

    } catch (error) {
      console.error(`Clay formatting failed for contact ${contactId}:`, error.message);
      throw error;
    }
  }

  /**
   * Format multiple contacts for Clay
   * @param {Array<number>} contactIds - Array of contact IDs
   * @returns {Promise<Array>} Array of Clay-formatted contacts
   */
  async formatMultipleContacts(contactIds) {
    const results = await Promise.allSettled(
      contactIds.map(id => this.formatContact(id))
    );

    return results
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value);
  }

  /**
   * Format all contacts with research completed
   * @param {number} limit - Max number of contacts
   * @returns {Promise<Array>} Array of Clay-formatted contacts
   */
  async formatAllContacts(limit = 100) {
    // This would query all contacts from the database
    // For now, returning empty array
    console.log('Format all contacts not yet implemented');
    return [];
  }

  // ===== HELPER METHODS =====

  getTenurePhase(months) {
    if (!months) return null;
    if (months < 3) return 'onboarding';
    if (months < 6) return 'evaluation';
    if (months < 12) return 'optimization';
    if (months < 24) return 'established';
    return 'entrenched';
  }

  calculateDisplayScore(signal) {
    const relevance = parseFloat(signal.relevance_score);
    const urgency = parseFloat(signal.urgency_score);
    const wedge = parseFloat(signal.wedge_potential);

    return Math.round((relevance * 0.4 + urgency * 0.3 + wedge * 0.3) * 100);
  }

  getTopChannel(channels) {
    if (!channels) return null;

    const entries = Object.entries(channels);
    if (entries.length === 0) return null;

    const sorted = entries.sort((a, b) => b[1] - a[1]);
    return sorted[0][0].replace('_', ' ');
  }

  getTopChannelScore(channels) {
    if (!channels) return null;

    const entries = Object.entries(channels);
    if (entries.length === 0) return null;

    const sorted = entries.sort((a, b) => b[1] - a[1]);
    return Math.round(sorted[0][1] * 100);
  }

  isHighPriority(linkedinProfile, linkedinPosts, signals) {
    // High priority if:
    // 1. Recent job change OR
    // 2. Recent pain point post OR
    // 3. Multiple high-scoring signals

    const recentJobChange = (linkedinProfile?.current_position_tenure_months || 999) < 6;
    const recentPainPoint = linkedinPosts?.some(p =>
      p.mentions_pain_points &&
      this.getDaysSince(p.post_date) < 14
    );
    const highScoringSignals = signals?.filter(s =>
      this.calculateDisplayScore(s) > 85
    ).length >= 2;

    return recentJobChange || recentPainPoint || highScoringSignals;
  }

  calculateContactReadiness(linkedinProfile, linkedinPosts, signals, playbook) {
    let score = 0;

    // LinkedIn activity (40 points)
    if (linkedinProfile) {
      if (linkedinProfile.influence_score > 0.7) score += 20;
      else if (linkedinProfile.influence_score > 0.5) score += 10;

      if (linkedinPosts && linkedinPosts.length > 5) score += 20;
      else if (linkedinPosts && linkedinPosts.length > 0) score += 10;
    }

    // Signal quality (30 points)
    if (signals && signals.length > 0) {
      const avgScore = signals.reduce((sum, s) =>
        sum + this.calculateDisplayScore(s), 0
      ) / signals.length;

      if (avgScore > 80) score += 30;
      else if (avgScore > 70) score += 20;
      else if (avgScore > 60) score += 10;
    }

    // Playbook strength (30 points)
    if (playbook) {
      if (playbook.wedge_score > 0.9) score += 30;
      else if (playbook.wedge_score > 0.8) score += 20;
      else if (playbook.wedge_score > 0.7) score += 10;
    }

    return score;
  }

  getDaysSince(date) {
    return Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
  }
}

module.exports = new ClayFormatter();
