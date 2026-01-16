/**
 * Clay Webhook Integration
 * Sends GTM contact intelligence to Clay for enrichment
 */

const axios = require('axios');
const https = require('https');
const http = require('http');
const queries = require('../db/queries');
const playbookGenerator = require('../processors/playbook-generator');

// Create custom agents that bypass the global proxy
// This allows direct connections to Clay without going through Anthropic's proxy
const httpAgentNoProxy = new http.Agent();
const httpsAgentNoProxy = new https.Agent({
  keepAlive: true
});

/**
 * Format contact data for Clay webhook
 */
async function formatForClay(contactId) {
  // Get all contact data
  const contact = await queries.contactQueries.getContactById(contactId);
  if (!contact) {
    throw new Error(`Contact ${contactId} not found`);
  }

  const linkedinProfile = await queries.linkedinQueries.getProfile(contactId);
  const linkedinPosts = await queries.linkedinQueries.getRecentPosts(contactId, 10);
  const signals = await queries.signalQueries.getSignalsByContact(contactId);
  const playbook = await playbookGenerator.generatePlaybook(contactId);

  // Get top signal
  const topSignal = signals.length > 0
    ? signals.sort((a, b) => (b.composite_score || 0) - (a.composite_score || 0))[0]
    : null;

  // Get recent post with pain points
  const painPointPost = linkedinPosts.find(p => p.mentions_pain_points);

  // Format for Clay
  return {
    // Contact basics
    email: contact.email,
    full_name: contact.full_name,
    company_name: contact.current_company,
    current_title: contact.current_title,
    linkedin_url: contact.linkedin_url,

    // LinkedIn profile data
    linkedin_headline: linkedinProfile?.profile_headline || null,
    linkedin_location: linkedinProfile?.location || null,
    linkedin_connections: linkedinProfile?.connections_count || null,
    linkedin_followers: linkedinProfile?.followers_count || null,
    linkedin_influence_score: linkedinProfile?.influence_score || null,
    linkedin_tenure_months: linkedinProfile?.current_position_tenure_months || null,
    linkedin_skills: linkedinProfile?.skills ? linkedinProfile.skills.join(', ') : null,

    // Top intelligence signal
    top_signal_type: topSignal?.signal_type || null,
    top_signal_description: topSignal?.description || null,
    top_signal_score: topSignal?.composite_score || null,
    top_signal_relevance: topSignal?.relevance_score || null,
    top_signal_urgency: topSignal?.urgency_score || null,

    // GTM playbook
    primary_wedge: playbook?.primary_wedge || null,
    wedge_score: playbook?.wedge_score || null,
    recommended_channel: playbook?.recommended_channels
      ? Object.entries(playbook.recommended_channels)
          .sort((a, b) => b[1] - a[1])[0][0].replace('_', ' ')
      : null,
    recommended_channel_confidence: playbook?.recommended_channels
      ? Math.max(...Object.values(playbook.recommended_channels))
      : null,

    // Recent LinkedIn activity
    recent_post_count: linkedinPosts.length,
    recent_post_avg_engagement: linkedinPosts.length > 0
      ? Math.round(linkedinPosts.reduce((sum, p) => sum + (p.engagement_count || 0), 0) / linkedinPosts.length)
      : null,

    // Pain point from most recent post
    recent_pain_point: painPointPost?.post_content
      ? painPointPost.post_content.substring(0, 200) + '...'
      : null,
    recent_pain_point_date: painPointPost?.post_date || null,
    recent_pain_point_engagement: painPointPost?.engagement_count || null,

    // Conversation starter
    conversation_starter: playbook?.conversation_starters?.[0] || null,

    // Timing
    timing_rationale: playbook?.timing_rationale || null,

    // Metadata
    intelligence_updated_at: new Date().toISOString(),
    signal_count: signals.length
  };
}

/**
 * Send contact data to Clay webhook
 * Uses custom HTTP agents to bypass Anthropic's global proxy
 */
async function sendToClay(contactId, webhookUrl) {
  try {
    const clayData = await formatForClay(contactId);

    // Use custom agents that bypass the global proxy configuration
    // This allows direct connection to api.clay.com
    const response = await axios.post(webhookUrl, clayData, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000, // 10 second timeout
      httpAgent: httpAgentNoProxy,
      httpsAgent: httpsAgentNoProxy,
      proxy: false // Explicitly disable proxy
    });

    return {
      success: true,
      status: response.status,
      data: response.data,
      sent_fields: Object.keys(clayData)
    };
  } catch (error) {
    console.error('Clay webhook error:', error.message);
    throw new Error(`Failed to send to Clay: ${error.message}`);
  }
}

/**
 * Batch send multiple contacts to Clay
 */
async function sendBatchToClay(contactIds, webhookUrl) {
  const results = [];

  for (const contactId of contactIds) {
    try {
      const result = await sendToClay(contactId, webhookUrl);
      results.push({
        contactId,
        success: true,
        ...result
      });

      // Rate limit: wait 500ms between requests
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      results.push({
        contactId,
        success: false,
        error: error.message
      });
    }
  }

  return {
    total: contactIds.length,
    successful: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    results
  };
}

module.exports = {
  formatForClay,
  sendToClay,
  sendBatchToClay
};
