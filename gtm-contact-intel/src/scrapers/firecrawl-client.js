const axios = require('axios');
const config = require('../../config/config');

/**
 * Rate Limiter Class
 * Implements token bucket algorithm for rate limiting
 */
class RateLimiter {
  constructor(maxRequests, intervalMs) {
    this.maxRequests = maxRequests;
    this.intervalMs = intervalMs;
    this.tokens = maxRequests;
    this.lastRefill = Date.now();
    this.queue = [];
  }

  async acquire() {
    this.refillTokens();

    if (this.tokens > 0) {
      this.tokens--;
      return Promise.resolve();
    }

    // Wait for next available token
    return new Promise((resolve) => {
      this.queue.push(resolve);
      this.scheduleRefill();
    });
  }

  refillTokens() {
    const now = Date.now();
    const timePassed = now - this.lastRefill;
    const tokensToAdd = Math.floor((timePassed / this.intervalMs) * this.maxRequests);

    if (tokensToAdd > 0) {
      this.tokens = Math.min(this.maxRequests, this.tokens + tokensToAdd);
      this.lastRefill = now;

      // Process queued requests
      while (this.queue.length > 0 && this.tokens > 0) {
        this.tokens--;
        const resolve = this.queue.shift();
        resolve();
      }
    }
  }

  scheduleRefill() {
    setTimeout(() => {
      this.refillTokens();
    }, this.intervalMs / this.maxRequests);
  }
}

/**
 * Firecrawl Client with Platform-Specific Rate Limiting
 */
class FirecrawlClient {
  constructor() {
    this.apiKey = config.apiKeys.firecrawl;
    this.baseUrl = 'https://api.firecrawl.dev/v1';

    // Platform-specific rate limiters
    this.linkedinLimiter = new RateLimiter(
      config.rateLimits.linkedin.maxRequestsPerMin,
      60000 // 1 minute
    );

    this.generalLimiter = new RateLimiter(
      config.rateLimits.firecrawl.maxRequestsPerMin,
      60000
    );

    // Circuit breaker state
    this.circuitBreaker = {
      linkedin: {
        failures: 0,
        lastFailure: null,
        isOpen: false,
        resetTimeout: null
      }
    };
  }

  /**
   * Check if circuit breaker is open for a platform
   */
  isCircuitOpen(platform = 'general') {
    if (platform === 'linkedin') {
      const breaker = this.circuitBreaker.linkedin;
      if (breaker.isOpen) {
        const timeSinceFailure = Date.now() - breaker.lastFailure;
        // Reset after 5 minutes
        if (timeSinceFailure > 300000) {
          console.log('LinkedIn circuit breaker reset');
          breaker.isOpen = false;
          breaker.failures = 0;
          return false;
        }
        return true;
      }
    }
    return false;
  }

  /**
   * Record failure and potentially open circuit breaker
   */
  recordFailure(platform = 'general') {
    if (platform === 'linkedin') {
      const breaker = this.circuitBreaker.linkedin;
      breaker.failures++;
      breaker.lastFailure = Date.now();

      // Open circuit after 3 consecutive failures
      if (breaker.failures >= 3) {
        console.warn('LinkedIn circuit breaker opened - pausing requests for 5 minutes');
        breaker.isOpen = true;
      }
    }
  }

  /**
   * Record success and reset failure count
   */
  recordSuccess(platform = 'general') {
    if (platform === 'linkedin') {
      this.circuitBreaker.linkedin.failures = 0;
    }
  }

  /**
   * Scrape a URL with Firecrawl
   * @param {string} url - URL to scrape
   * @param {Object} options - Scraping options
   * @param {string} platform - Platform identifier for rate limiting ('linkedin' or 'general')
   * @returns {Promise<Object>} Scraped data
   */
  async scrapeUrl(url, options = {}, platform = 'general') {
    // Check circuit breaker
    if (this.isCircuitOpen(platform)) {
      throw new Error(`${platform} circuit breaker is open - scraping paused`);
    }

    // Apply rate limiting
    const limiter = platform === 'linkedin' ? this.linkedinLimiter : this.generalLimiter;
    await limiter.acquire();

    // Additional delay for LinkedIn
    if (platform === 'linkedin') {
      await this.sleep(config.rateLimits.linkedin.delayMs);
    }

    const defaultOptions = {
      formats: ['markdown', 'html'],
      onlyMainContent: true,
      waitFor: options.waitFor || 2000,
      timeout: config.scraping.scrapeTimeoutMs,
    };

    const scrapeOptions = { ...defaultOptions, ...options };

    try {
      console.log(`Scraping ${platform} URL: ${url}`);

      const response = await axios.post(
        `${this.baseUrl}/scrape`,
        {
          url,
          ...scrapeOptions
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: config.scraping.scrapeTimeoutMs + 5000
        }
      );

      this.recordSuccess(platform);

      return {
        success: true,
        data: response.data,
        markdown: response.data.markdown || '',
        html: response.data.html || '',
        metadata: response.data.metadata || {},
        url: url
      };

    } catch (error) {
      this.recordFailure(platform);

      // Check for rate limit errors
      if (error.response?.status === 429) {
        console.error(`Rate limit hit for ${platform}: ${url}`);
        throw new Error(`Rate limit exceeded for ${platform}`);
      }

      // Check for LinkedIn blocks
      if (platform === 'linkedin' && error.response?.status === 403) {
        console.error('LinkedIn blocked the request - circuit breaker opened');
        this.circuitBreaker.linkedin.isOpen = true;
        throw new Error('LinkedIn blocked the request - scraping paused');
      }

      console.error(`Scraping error for ${url}:`, error.message);

      return {
        success: false,
        error: error.message,
        url: url
      };
    }
  }

  /**
   * Scrape LinkedIn profile
   */
  async scrapeLinkedInProfile(linkedinUrl) {
    // Normalize LinkedIn URL
    const normalizedUrl = this.normalizeLinkedInUrl(linkedinUrl);

    return await this.scrapeUrl(
      normalizedUrl,
      {
        onlyMainContent: true,
        waitFor: 3000, // Wait longer for LinkedIn dynamic content
        includeTags: ['main', 'section', 'article']
      },
      'linkedin'
    );
  }

  /**
   * Scrape LinkedIn recent activity
   */
  async scrapeLinkedInActivity(linkedinUrl) {
    const normalizedUrl = this.normalizeLinkedInUrl(linkedinUrl);
    const activityUrl = `${normalizedUrl}/recent-activity/all/`;

    return await this.scrapeUrl(
      activityUrl,
      {
        onlyMainContent: true,
        waitFor: 3000,
      },
      'linkedin'
    );
  }

  /**
   * Scrape individual LinkedIn post
   */
  async scrapeLinkedInPost(postUrl) {
    return await this.scrapeUrl(
      postUrl,
      {
        onlyMainContent: true,
        waitFor: 2000,
      },
      'linkedin'
    );
  }

  /**
   * Scrape general URL (non-LinkedIn)
   */
  async scrapeGeneral(url, options = {}) {
    return await this.scrapeUrl(url, options, 'general');
  }

  /**
   * Batch scrape with controlled concurrency
   * @param {Array<string>} urls - URLs to scrape
   * @param {string} platform - Platform identifier
   * @param {number} concurrency - Max concurrent requests
   */
  async batchScrape(urls, platform = 'general', concurrency = 3) {
    const results = [];
    const chunks = this.chunkArray(urls, concurrency);

    for (const chunk of chunks) {
      const chunkResults = await Promise.all(
        chunk.map(url => this.scrapeUrl(url, {}, platform))
      );
      results.push(...chunkResults);
    }

    return results;
  }

  /**
   * Helper: Normalize LinkedIn URL
   */
  normalizeLinkedInUrl(url) {
    // Remove trailing slashes and query parameters
    let normalized = url.replace(/\/$/, '').split('?')[0];

    // Ensure proper format
    if (!normalized.includes('linkedin.com/in/')) {
      throw new Error('Invalid LinkedIn profile URL format');
    }

    return normalized;
  }

  /**
   * Helper: Chunk array for batch processing
   */
  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Helper: Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get rate limiter status
   */
  getRateLimitStatus() {
    return {
      linkedin: {
        tokens: this.linkedinLimiter.tokens,
        maxTokens: this.linkedinLimiter.maxRequests,
        queueLength: this.linkedinLimiter.queue.length,
        circuitOpen: this.circuitBreaker.linkedin.isOpen,
        failures: this.circuitBreaker.linkedin.failures
      },
      general: {
        tokens: this.generalLimiter.tokens,
        maxTokens: this.generalLimiter.maxRequests,
        queueLength: this.generalLimiter.queue.length
      }
    };
  }
}

// Export singleton instance
module.exports = new FirecrawlClient();
