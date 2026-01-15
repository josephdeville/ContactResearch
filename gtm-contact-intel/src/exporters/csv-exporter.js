const { Parser } = require('json2csv');
const clayFormatter = require('./clay-formatter');

/**
 * CSV Exporter
 * Exports contact intelligence to CSV format
 * LinkedIn signals prioritized in column order
 */
class CSVExporter {
  constructor() {
    // Define CSV columns in priority order
    this.columns = [
      // Contact basics
      { label: 'Name', value: 'contact_name' },
      { label: 'Email', value: 'contact_email' },
      { label: 'Company', value: 'company' },
      { label: 'Title', value: 'title' },

      // LinkedIn (PRIORITY COLUMNS)
      { label: 'LinkedIn URL', value: 'linkedin_url' },
      { label: 'LinkedIn Influence Score', value: 'linkedin_influence_score' },
      { label: 'LinkedIn Recent Posts', value: 'linkedin_recent_posts' },
      { label: 'LinkedIn Last Post Date', value: 'linkedin_last_post_date' },
      { label: 'LinkedIn Last Post Topic', value: 'linkedin_last_post_topic' },
      { label: 'LinkedIn Has Pain Points', value: 'linkedin_mentions_pain_points' },
      { label: 'LinkedIn Has Buying Signals', value: 'linkedin_mentions_buying_signals' },
      { label: 'LinkedIn Tenure (months)', value: 'linkedin_tenure_months' },
      { label: 'LinkedIn Tenure Phase', value: 'linkedin_tenure_phase' },
      { label: 'LinkedIn Recent Job Change', value: 'linkedin_recent_job_change' },

      // Top Signals
      { label: 'Signal 1', value: 'top_signal_1' },
      { label: 'Signal 1 Type', value: 'top_signal_1_type' },
      { label: 'Signal 1 Score', value: 'top_signal_1_score' },
      { label: 'Signal 2', value: 'top_signal_2' },
      { label: 'Signal 2 Type', value: 'top_signal_2_type' },
      { label: 'Signal 3', value: 'top_signal_3' },
      { label: 'Signal 4', value: 'top_signal_4' },
      { label: 'Signal 5', value: 'top_signal_5' },

      // Playbook
      { label: 'Primary Wedge', value: 'primary_wedge' },
      { label: 'Wedge Score', value: 'wedge_score' },
      { label: 'Timing Trigger', value: 'timing_trigger' },
      { label: 'Recommended Channel', value: 'recommended_channel' },

      // GitHub
      { label: 'GitHub Username', value: 'github_username' },
      { label: 'GitHub Activity Score', value: 'github_activity_score' },
      { label: 'GitHub Primary Language', value: 'github_primary_language' },

      // Speaking
      { label: 'Podcast Count', value: 'podcast_count' },
      { label: 'Latest Podcast', value: 'latest_podcast' },

      // Metadata
      { label: 'Contact Readiness Score', value: 'contact_readiness_score' },
      { label: 'Is High Priority', value: 'is_high_priority' },
      { label: 'Research Completed', value: 'research_completed_at' }
    ];
  }

  /**
   * Export a single contact to CSV
   * @param {number} contactId - Database contact ID
   * @returns {Promise<string>} CSV string
   */
  async exportContact(contactId) {
    try {
      const clayData = await clayFormatter.formatContact(contactId);
      const parser = new Parser({ fields: this.columns });
      const csv = parser.parse([clayData]);

      return csv;

    } catch (error) {
      console.error(`CSV export failed for contact ${contactId}:`, error.message);
      throw error;
    }
  }

  /**
   * Export multiple contacts to CSV
   * @param {Array<number>} contactIds - Array of contact IDs
   * @returns {Promise<string>} CSV string
   */
  async exportMultipleContacts(contactIds) {
    try {
      const clayDataArray = await clayFormatter.formatMultipleContacts(contactIds);

      if (clayDataArray.length === 0) {
        return '';
      }

      const parser = new Parser({ fields: this.columns });
      const csv = parser.parse(clayDataArray);

      return csv;

    } catch (error) {
      console.error('CSV export failed for multiple contacts:', error.message);
      throw error;
    }
  }

  /**
   * Export contacts with custom columns
   * @param {Array<number>} contactIds - Array of contact IDs
   * @param {Array<Object>} customColumns - Custom column definitions
   * @returns {Promise<string>} CSV string
   */
  async exportWithCustomColumns(contactIds, customColumns) {
    try {
      const clayDataArray = await clayFormatter.formatMultipleContacts(contactIds);

      if (clayDataArray.length === 0) {
        return '';
      }

      const parser = new Parser({ fields: customColumns });
      const csv = parser.parse(clayDataArray);

      return csv;

    } catch (error) {
      console.error('CSV export with custom columns failed:', error.message);
      throw error;
    }
  }

  /**
   * Export high-priority contacts only
   * @param {Array<number>} contactIds - Array of contact IDs
   * @returns {Promise<string>} CSV string
   */
  async exportHighPriorityContacts(contactIds) {
    try {
      const clayDataArray = await clayFormatter.formatMultipleContacts(contactIds);

      // Filter to high priority only
      const highPriorityContacts = clayDataArray.filter(c => c.is_high_priority);

      if (highPriorityContacts.length === 0) {
        return '';
      }

      const parser = new Parser({ fields: this.columns });
      const csv = parser.parse(highPriorityContacts);

      return csv;

    } catch (error) {
      console.error('High priority CSV export failed:', error.message);
      throw error;
    }
  }

  /**
   * Get available column definitions
   * Useful for API clients to know what columns are available
   */
  getAvailableColumns() {
    return this.columns;
  }

  /**
   * Export with LinkedIn-only columns (minimal export)
   */
  async exportLinkedInOnly(contactIds) {
    const linkedinColumns = this.columns.filter(col =>
      col.value.includes('linkedin') ||
      col.value === 'contact_name' ||
      col.value === 'contact_email' ||
      col.value === 'company' ||
      col.value === 'title'
    );

    return this.exportWithCustomColumns(contactIds, linkedinColumns);
  }

  /**
   * Export playbook summary (for outreach planning)
   */
  async exportPlaybookSummary(contactIds) {
    const playbookColumns = [
      { label: 'Name', value: 'contact_name' },
      { label: 'Company', value: 'company' },
      { label: 'Title', value: 'title' },
      { label: 'Email', value: 'contact_email' },
      { label: 'LinkedIn URL', value: 'linkedin_url' },
      { label: 'Primary Wedge', value: 'primary_wedge' },
      { label: 'Wedge Score', value: 'wedge_score' },
      { label: 'Top Signal', value: 'top_signal_1' },
      { label: 'Timing Trigger', value: 'timing_trigger' },
      { label: 'Recommended Channel', value: 'recommended_channel' },
      { label: 'Sample Outreach', value: 'sample_outreach_preview' },
      { label: 'Readiness Score', value: 'contact_readiness_score' },
      { label: 'High Priority', value: 'is_high_priority' }
    ];

    return this.exportWithCustomColumns(contactIds, playbookColumns);
  }
}

module.exports = new CSVExporter();
