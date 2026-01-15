const axios = require('axios');
const config = require('../../config/config');
const { githubQueries, signalQueries } = require('../db/queries');

/**
 * GitHub Analyzer
 * Analyzes GitHub activity to identify technical influence and expertise
 */
class GitHubAnalyzer {
  constructor() {
    this.apiToken = config.apiKeys.github;
    this.baseUrl = 'https://api.github.com';
    this.headers = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'GTM-Contact-Intel'
    };

    if (this.apiToken) {
      this.headers['Authorization'] = `token ${this.apiToken}`;
    }
  }

  /**
   * Research contact's GitHub activity
   * @param {number} contactId - Database contact ID
   * @param {string} fullName - Contact's full name
   * @param {string} company - Current company
   * @returns {Promise<Object>} GitHub intelligence
   */
  async researchContact(contactId, fullName, company = null) {
    console.log(`Starting GitHub research for contact ${contactId}`);

    try {
      // Step 1: Search for GitHub username
      const username = await this.findGitHubUsername(fullName, company);

      if (!username) {
        console.log(`No GitHub profile found for ${fullName}`);
        return {
          success: false,
          error: 'GitHub profile not found'
        };
      }

      // Step 2: Fetch profile data
      const profile = await this.fetchProfile(username);

      // Step 3: Fetch repositories
      const repos = await this.fetchRepositories(username);

      // Step 4: Fetch recent activity
      const events = await this.fetchRecentEvents(username);

      // Step 5: Analyze activity
      const analysis = this.analyzeActivity(profile, repos, events);

      // Step 6: Calculate activity score
      const activityScore = this.calculateActivityScore(profile, repos, events);

      // Step 7: Save to database
      const githubData = {
        github_username: username,
        profile_url: profile.html_url,
        followers: profile.followers,
        following: profile.following,
        public_repos: profile.public_repos,
        contribution_count: events.length,
        primary_languages: analysis.languages,
        recent_repos: analysis.recentRepos,
        activity_summary: analysis.summary,
        last_commit_date: analysis.lastCommitDate,
        technical_focus_areas: analysis.focusAreas,
        activity_score: activityScore,
        raw_profile_data: profile
      };

      await githubQueries.saveActivity(contactId, githubData);

      // Step 8: Create intelligence signals
      await this.createIntelligenceSignals(contactId, githubData, analysis);

      console.log(`GitHub research completed for contact ${contactId}`);

      return {
        success: true,
        username,
        activityScore,
        analysis
      };

    } catch (error) {
      console.error(`GitHub research failed for contact ${contactId}:`, error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Search for GitHub username by name and company
   */
  async findGitHubUsername(fullName, company) {
    try {
      const query = company
        ? `${fullName} in:name,fullname ${company} in:company`
        : `${fullName} in:name,fullname`;

      const response = await axios.get(`${this.baseUrl}/search/users`, {
        headers: this.headers,
        params: { q: query, per_page: 5 }
      });

      if (response.data.total_count === 0) {
        return null;
      }

      // Return the most likely match (first result)
      return response.data.items[0].login;

    } catch (error) {
      console.error('GitHub username search error:', error.message);
      return null;
    }
  }

  /**
   * Fetch GitHub profile
   */
  async fetchProfile(username) {
    const response = await axios.get(`${this.baseUrl}/users/${username}`, {
      headers: this.headers
    });
    return response.data;
  }

  /**
   * Fetch user repositories
   */
  async fetchRepositories(username, maxRepos = 30) {
    const response = await axios.get(`${this.baseUrl}/users/${username}/repos`, {
      headers: this.headers,
      params: {
        sort: 'updated',
        per_page: maxRepos,
        type: 'owner'
      }
    });
    return response.data;
  }

  /**
   * Fetch recent events (activity)
   */
  async fetchRecentEvents(username, maxEvents = 100) {
    try {
      const response = await axios.get(`${this.baseUrl}/users/${username}/events/public`, {
        headers: this.headers,
        params: { per_page: maxEvents }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching GitHub events:', error.message);
      return [];
    }
  }

  /**
   * Analyze GitHub activity
   */
  analyzeActivity(profile, repos, events) {
    // Analyze languages
    const languages = this.extractLanguages(repos);

    // Recent repositories (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const recentRepos = repos
      .filter(r => new Date(r.updated_at) >= sixMonthsAgo)
      .slice(0, 10)
      .map(r => ({
        name: r.name,
        description: r.description,
        language: r.language,
        stars: r.stargazers_count,
        url: r.html_url,
        lastUpdated: r.updated_at
      }));

    // Find last commit date
    const pushEvents = events.filter(e => e.type === 'PushEvent');
    const lastCommitDate = pushEvents.length > 0
      ? new Date(pushEvents[0].created_at)
      : null;

    // Determine technical focus areas
    const focusAreas = this.determineFocusAreas(repos, events);

    // Generate activity summary
    const summary = this.generateActivitySummary(profile, repos, events, languages);

    return {
      languages,
      recentRepos,
      lastCommitDate,
      focusAreas,
      summary
    };
  }

  /**
   * Extract primary languages from repos
   */
  extractLanguages(repos) {
    const languageCounts = {};

    repos.forEach(repo => {
      if (repo.language) {
        languageCounts[repo.language] = (languageCounts[repo.language] || 0) + 1;
      }
    });

    const sortedLanguages = Object.entries(languageCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([lang, count]) => ({ language: lang, repos: count }));

    return sortedLanguages;
  }

  /**
   * Determine technical focus areas
   */
  determineFocusAreas(repos, events) {
    const focusAreas = [];

    // Check for API/integration work
    const hasApiWork = repos.some(r =>
      (r.name && r.name.toLowerCase().includes('api')) ||
      (r.description && r.description.toLowerCase().includes('api'))
    );
    if (hasApiWork) focusAreas.push('API Development');

    // Check for data/analytics work
    const hasDataWork = repos.some(r => {
      const text = `${r.name} ${r.description}`.toLowerCase();
      return text.includes('data') || text.includes('analytics') || text.includes('etl');
    });
    if (hasDataWork) focusAreas.push('Data Engineering');

    // Check for web development
    const webLanguages = ['JavaScript', 'TypeScript', 'HTML', 'CSS'];
    const hasWebWork = repos.some(r => webLanguages.includes(r.language));
    if (hasWebWork) focusAreas.push('Web Development');

    // Check for DevOps/Infrastructure
    const hasDevOps = repos.some(r => {
      const text = `${r.name} ${r.description}`.toLowerCase();
      return text.includes('docker') || text.includes('kubernetes') ||
             text.includes('terraform') || text.includes('ci/cd');
    });
    if (hasDevOps) focusAreas.push('DevOps');

    // Check for ML/AI
    const hasMlWork = repos.some(r => {
      const text = `${r.name} ${r.description}`.toLowerCase();
      return text.includes('machine learning') || text.includes('ml') ||
             text.includes('ai') || text.includes('neural');
    });
    if (hasMlWork) focusAreas.push('Machine Learning');

    return focusAreas.length > 0 ? focusAreas : ['General Software Development'];
  }

  /**
   * Generate natural language activity summary
   */
  generateActivitySummary(profile, repos, events, languages) {
    const recentActivity = events.filter(e => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return new Date(e.created_at) >= thirtyDaysAgo;
    }).length;

    const topLanguage = languages.length > 0 ? languages[0].language : 'various languages';

    const summary = [
      `${profile.public_repos} public repositories with ${profile.followers} followers.`,
      `Primary language: ${topLanguage}.`,
      recentActivity > 0
        ? `${recentActivity} public contributions in the last 30 days - actively coding.`
        : 'Limited recent public activity.',
      repos.length > 0 && repos[0].stargazers_count > 10
        ? `Notable projects with ${repos[0].stargazers_count}+ stars.`
        : null
    ].filter(Boolean).join(' ');

    return summary;
  }

  /**
   * Calculate GitHub activity score (0-1)
   */
  calculateActivityScore(profile, repos, events) {
    // Recent activity score (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentEvents = events.filter(e => new Date(e.created_at) >= thirtyDaysAgo);
    const activityScore = Math.min(recentEvents.length / 20, 1.0); // 20+ events = 1.0

    // Follower influence score
    const followerScore = Math.min(profile.followers / 200, 1.0); // 200+ followers = 1.0

    // Repository quality score
    const totalStars = repos.reduce((sum, r) => sum + r.stargazers_count, 0);
    const repoScore = Math.min(totalStars / 100, 1.0); // 100+ total stars = 1.0

    // Weighted score
    const score = (
      activityScore * 0.4 +
      followerScore * 0.3 +
      repoScore * 0.3
    );

    return Math.round(score * 100) / 100;
  }

  /**
   * Create intelligence signals from GitHub data
   */
  async createIntelligenceSignals(contactId, githubData, analysis) {
    const signals = [];

    // Signal 1: Recent activity
    if (analysis.lastCommitDate) {
      const daysSinceCommit = Math.floor(
        (Date.now() - analysis.lastCommitDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysSinceCommit < 7) {
        signals.push({
          signal_type: 'github_activity',
          signal_category: 'technical',
          description: `Active on GitHub - last commit ${daysSinceCommit} days ago. Technical buyer who evaluates tools hands-on.`,
          relevance_score: 0.85,
          urgency_score: 0.75,
          wedge_potential: 0.80,
          raw_data: { lastCommitDate: analysis.lastCommitDate, daysSinceCommit }
        });
      }
    }

    // Signal 2: Technical focus areas
    if (analysis.focusAreas.length > 0) {
      signals.push({
        signal_type: 'github_activity',
        signal_category: 'technical',
        description: `Technical expertise in: ${analysis.focusAreas.join(', ')}. Can discuss technical implementation details.`,
        relevance_score: 0.75,
        urgency_score: 0.6,
        wedge_potential: 0.70,
        raw_data: { focusAreas: analysis.focusAreas }
      });
    }

    // Signal 3: High influence (many followers)
    if (githubData.followers > 100) {
      signals.push({
        signal_type: 'github_activity',
        signal_category: 'technical',
        description: `${githubData.followers} GitHub followers - technical influencer. Could become advocate if product fits.`,
        relevance_score: 0.80,
        urgency_score: 0.65,
        wedge_potential: 0.75,
        raw_data: { followers: githubData.followers }
      });
    }

    // Signal 4: API development focus (if relevant to product)
    if (analysis.focusAreas.includes('API Development')) {
      signals.push({
        signal_type: 'github_activity',
        signal_category: 'technical',
        description: `Works with APIs - likely values good API documentation and developer experience. Recent API-related repositories.`,
        relevance_score: 0.85,
        urgency_score: 0.70,
        wedge_potential: 0.80,
        raw_data: { focusArea: 'API Development' }
      });
    }

    // Save signals
    for (const signal of signals) {
      await signalQueries.createSignal(contactId, signal);
    }

    console.log(`Created ${signals.length} GitHub intelligence signals for contact ${contactId}`);

    return signals;
  }
}

module.exports = new GitHubAnalyzer();
