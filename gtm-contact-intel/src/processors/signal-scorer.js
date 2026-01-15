const { signalQueries } = require('../db/queries');
const config = require('../../config/config');

/**
 * Signal Scorer
 * Scores and prioritizes intelligence signals with LinkedIn priority weighting
 */
class SignalScorer {
  constructor() {
    this.linkedinBoost = config.intelligence.linkedinRelevanceBoost;
    this.minRelevance = config.intelligence.minSignalRelevanceScore;
  }

  /**
   * Score all signals for a contact and return prioritized list
   * @param {number} contactId - Database contact ID
   * @returns {Promise<Array>} Prioritized signals
   */
  async scoreAndPrioritizeSignals(contactId) {
    console.log(`Scoring signals for contact ${contactId}`);

    try {
      // Get all signals for contact
      const signals = await signalQueries.getSignalsByContact(contactId);

      if (signals.length === 0) {
        return [];
      }

      // Apply LinkedIn priority boost
      const boostedSignals = signals.map(signal => {
        const boosted = { ...signal };

        // LinkedIn signals get relevance boost
        if (this.isLinkedInSignal(signal.signal_type)) {
          boosted.relevance_score = Math.min(
            parseFloat(signal.relevance_score) + this.linkedinBoost,
            1.0
          );
          boosted.linkedin_boosted = true;
        }

        // Calculate composite score
        boosted.composite_score = this.calculateCompositeScore(
          parseFloat(boosted.relevance_score),
          parseFloat(signal.urgency_score),
          parseFloat(signal.wedge_potential)
        );

        return boosted;
      });

      // Filter by minimum relevance
      const filteredSignals = boostedSignals.filter(s =>
        parseFloat(s.relevance_score) >= this.minRelevance
      );

      // Sort by composite score
      const prioritizedSignals = filteredSignals.sort(
        (a, b) => b.composite_score - a.composite_score
      );

      console.log(`Scored ${prioritizedSignals.length} signals for contact ${contactId}`);

      return prioritizedSignals;

    } catch (error) {
      console.error(`Signal scoring failed for contact ${contactId}:`, error.message);
      return [];
    }
  }

  /**
   * Get top N signals for a contact
   * @param {number} contactId - Database contact ID
   * @param {number} count - Number of signals to return
   * @returns {Promise<Array>} Top signals
   */
  async getTopSignals(contactId, count = 5) {
    const prioritized = await this.scoreAndPrioritizeSignals(contactId);
    return prioritized.slice(0, count);
  }

  /**
   * Check if signal type is LinkedIn-related
   */
  isLinkedInSignal(signalType) {
    const linkedinTypes = [
      'linkedin_activity',
      'linkedin_content',
      'linkedin_profile_change'
    ];
    return linkedinTypes.includes(signalType);
  }

  /**
   * Calculate composite score from individual dimensions
   * Weighted formula: relevance (40%) + urgency (30%) + wedge potential (30%)
   */
  calculateCompositeScore(relevance, urgency, wedgePotential) {
    return (
      relevance * 0.4 +
      urgency * 0.3 +
      wedgePotential * 0.3
    );
  }

  /**
   * Analyze signal distribution for a contact
   * Useful for understanding intelligence coverage
   */
  async analyzeSignalDistribution(contactId) {
    const signals = await signalQueries.getSignalsByContact(contactId);

    const distribution = {
      total: signals.length,
      byType: {},
      byCategory: {},
      linkedinCount: 0,
      highPriority: 0, // composite score > 0.8
      mediumPriority: 0, // composite score 0.6-0.8
      lowPriority: 0 // composite score < 0.6
    };

    signals.forEach(signal => {
      // Count by type
      distribution.byType[signal.signal_type] =
        (distribution.byType[signal.signal_type] || 0) + 1;

      // Count by category
      distribution.byCategory[signal.signal_category] =
        (distribution.byCategory[signal.signal_category] || 0) + 1;

      // Count LinkedIn signals
      if (this.isLinkedInSignal(signal.signal_type)) {
        distribution.linkedinCount++;
      }

      // Count by priority
      const compositeScore = this.calculateCompositeScore(
        parseFloat(signal.relevance_score),
        parseFloat(signal.urgency_score),
        parseFloat(signal.wedge_potential)
      );

      if (compositeScore > 0.8) distribution.highPriority++;
      else if (compositeScore >= 0.6) distribution.mediumPriority++;
      else distribution.lowPriority++;
    });

    return distribution;
  }

  /**
   * Get signal statistics across all contacts
   * Useful for system-level analytics
   */
  async getGlobalSignalStats() {
    // This would require a database query to aggregate across all contacts
    // Implementation depends on specific analytics needs
    return {
      message: 'Global stats not yet implemented'
    };
  }

  /**
   * Recalculate scores for all signals (admin function)
   * Useful if scoring algorithm changes
   */
  async recalculateAllScores(contactId) {
    // This would update scores in the database
    // For now, scores are stored at creation time
    console.log('Score recalculation not implemented - scores are set at signal creation');
    return { success: false, message: 'Not implemented' };
  }
}

module.exports = new SignalScorer();
