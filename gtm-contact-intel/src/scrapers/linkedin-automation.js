/**
 * LinkedIn Profile Automation
 * Automated scraping with Puppeteer and rate limiting
 */

const puppeteer = require('puppeteer');
const db = require('../db/client');
const config = require('../../config/config');

// Rate limiting state
let lastRequestTime = 0;
const MIN_DELAY_MS = config.rateLimits.linkedin.delayMs;

/**
 * Add LinkedIn URLs to scraping queue
 */
async function addToQueue(urls, priority = 0, metadata = {}) {
  const urlArray = Array.isArray(urls) ? urls : [urls];
  const results = [];

  for (const url of urlArray) {
    try {
      const result = await db.query(
        `INSERT INTO linkedin_scrape_queue (linkedin_url, priority, metadata)
         VALUES ($1, $2, $3)
         ON CONFLICT (linkedin_url)
         DO UPDATE SET priority = GREATEST(linkedin_scrape_queue.priority, $2)
         RETURNING id, linkedin_url, status`,
        [url, priority, JSON.stringify(metadata)]
      );
      results.push(result.rows[0]);
    } catch (error) {
      console.error(`Failed to add ${url} to queue:`, error.message);
      results.push({ url, error: error.message });
    }
  }

  return results;
}

/**
 * Get next profile to scrape from queue
 */
async function getNextInQueue() {
  const result = await db.query(
    `UPDATE linkedin_scrape_queue
     SET status = 'processing', last_attempt_at = NOW(), attempts = attempts + 1
     WHERE id = (
       SELECT id FROM linkedin_scrape_queue
       WHERE status IN ('pending', 'rate_limited')
       ORDER BY priority DESC, added_at ASC
       LIMIT 1
       FOR UPDATE SKIP LOCKED
     )
     RETURNING *`
  );

  return result.rows[0] || null;
}

/**
 * Update queue item status
 */
async function updateQueueStatus(id, status, contactId = null, errorMessage = null) {
  const updates = { status };
  if (contactId) updates.contact_id = contactId;
  if (errorMessage) updates.error_message = errorMessage;
  if (status === 'completed') updates.completed_at = 'NOW()';

  const setClauses = Object.keys(updates).map((key, idx) =>
    key === 'completed_at' ? `${key} = NOW()` : `${key} = $${idx + 1}`
  );
  const values = Object.entries(updates)
    .filter(([key]) => key !== 'completed_at')
    .map(([, val]) => val);

  await db.query(
    `UPDATE linkedin_scrape_queue SET ${setClauses.join(', ')} WHERE id = $${values.length + 1}`,
    [...values, id]
  );
}

/**
 * Enforce rate limiting
 */
async function enforceRateLimit() {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < MIN_DELAY_MS) {
    const delay = MIN_DELAY_MS - timeSinceLastRequest;
    console.log(`Rate limiting: waiting ${delay}ms`);
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  lastRequestTime = Date.now();
}

/**
 * Extract LinkedIn profile data using Puppeteer
 */
async function scrapeLinkedInProfile(browser, url) {
  const page = await browser.newPage();

  try {
    // Set realistic viewport and user agent
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    console.log(`Navigating to: ${url}`);
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Wait for profile content to load
    await page.waitForSelector('h1', { timeout: 10000 });

    // Extract profile data
    const profileData = await page.evaluate(() => {
      // Helper to safely get text content
      const getText = (selector) => {
        const el = document.querySelector(selector);
        return el ? el.textContent.trim() : null;
      };

      const getAll = (selector) => {
        return Array.from(document.querySelectorAll(selector))
          .map(el => el.textContent.trim())
          .filter(text => text.length > 0);
      };

      // Extract basic info
      const name = getText('h1');
      const headline = getText('.text-body-medium');
      const location = getText('.text-body-small.inline');

      // Extract connections count
      const connectionsText = getText('span.t-bold');
      const connections = connectionsText ?
        parseInt(connectionsText.replace(/[^0-9]/g, '')) : null;

      // Extract current position
      const currentPosition = getText('.inline-show-more-text--is-collapsed');

      // Extract company from current position
      let company = null;
      const positionEl = document.querySelector('.inline-show-more-text--is-collapsed');
      if (positionEl) {
        const parts = positionEl.textContent.split(' at ');
        if (parts.length > 1) {
          company = parts[1].split('·')[0].trim();
        }
      }

      // Extract about section
      const about = getText('#about + div .inline-show-more-text');

      // Extract skills (limited to visible ones)
      const skills = getAll('.pvs-list__item--line-separated span[aria-hidden="true"]')
        .slice(0, 10);

      // Extract recent activity posts (if visible)
      const posts = Array.from(document.querySelectorAll('.feed-shared-update-v2'))
        .slice(0, 5)
        .map(post => {
          const content = post.querySelector('.feed-shared-text')?.textContent?.trim();
          const timestamp = post.querySelector('.feed-shared-actor__sub-description')?.textContent?.trim();
          const engagement = post.querySelector('.social-details-social-counts')?.textContent?.trim();
          return { content, timestamp, engagement };
        })
        .filter(post => post.content);

      return {
        name,
        headline,
        location,
        connections,
        currentPosition,
        company,
        about,
        skills,
        posts,
        profileUrl: window.location.href
      };
    });

    await page.close();
    return profileData;

  } catch (error) {
    await page.close();
    throw error;
  }
}

/**
 * Store scraped data in database
 */
async function storeProfileData(profileData, linkedinUrl) {
  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    // Insert or update contact
    const contactResult = await client.query(
      `INSERT INTO contacts (full_name, linkedin_url, current_company, current_title)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (linkedin_url)
       DO UPDATE SET
         full_name = EXCLUDED.full_name,
         current_company = EXCLUDED.current_company,
         current_title = EXCLUDED.current_title,
         updated_at = NOW()
       RETURNING id`,
      [
        profileData.name,
        linkedinUrl,
        profileData.company,
        profileData.currentPosition
      ]
    );

    const contactId = contactResult.rows[0].id;

    // Insert LinkedIn activity data
    await client.query(
      `INSERT INTO linkedin_activity (
        contact_id, linkedin_url, profile_headline, location,
        connections_count, skills, profile_summary, influence_score
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (contact_id)
      DO UPDATE SET
        profile_headline = EXCLUDED.profile_headline,
        location = EXCLUDED.location,
        connections_count = EXCLUDED.connections_count,
        skills = EXCLUDED.skills,
        profile_summary = EXCLUDED.profile_summary,
        influence_score = EXCLUDED.influence_score,
        profile_scraped_at = NOW()`,
      [
        contactId,
        linkedinUrl,
        profileData.headline,
        profileData.location,
        profileData.connections,
        profileData.skills,
        profileData.about,
        calculateInfluenceScore(profileData)
      ]
    );

    // Store posts if any were captured
    if (profileData.posts && profileData.posts.length > 0) {
      for (const post of profileData.posts) {
        if (post.content) {
          await client.query(
            `INSERT INTO linkedin_posts (
              contact_id, post_content, post_date, post_type
            )
            VALUES ($1, $2, NOW(), 'post')
            ON CONFLICT DO NOTHING`,
            [contactId, post.content]
          );
        }
      }
    }

    await client.query('COMMIT');
    return contactId;

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Calculate influence score based on profile data
 */
function calculateInfluenceScore(profileData) {
  let score = 0.5; // Base score

  // Connections boost
  if (profileData.connections) {
    if (profileData.connections > 5000) score += 0.3;
    else if (profileData.connections > 2000) score += 0.2;
    else if (profileData.connections > 500) score += 0.1;
  }

  // Profile completeness
  if (profileData.about) score += 0.1;
  if (profileData.skills && profileData.skills.length > 5) score += 0.1;

  return Math.min(score, 1.0).toFixed(2);
}

/**
 * Process one profile from the queue
 */
async function processNextProfile(browser) {
  const queueItem = await getNextInQueue();

  if (!queueItem) {
    return null;
  }

  console.log(`Processing: ${queueItem.linkedin_url} (attempt ${queueItem.attempts})`);

  try {
    // Enforce rate limiting
    await enforceRateLimit();

    // Scrape profile
    const profileData = await scrapeLinkedInProfile(browser, queueItem.linkedin_url);

    if (!profileData.name) {
      throw new Error('Failed to extract profile data - may require login');
    }

    // Store in database
    const contactId = await storeProfileData(profileData, queueItem.linkedin_url);

    // Update queue status
    await updateQueueStatus(queueItem.id, 'completed', contactId);

    console.log(`✓ Successfully processed: ${profileData.name} (Contact ID: ${contactId})`);
    return { success: true, contactId, profileData };

  } catch (error) {
    console.error(`✗ Failed to process ${queueItem.linkedin_url}:`, error.message);

    // Handle rate limiting
    if (error.message.includes('429') || error.message.includes('rate limit')) {
      await updateQueueStatus(queueItem.id, 'rate_limited', null, error.message);
      console.log('Rate limited - will retry later');
      return { success: false, rateLimited: true };
    }

    // Mark as failed after 3 attempts
    if (queueItem.attempts >= 3) {
      await updateQueueStatus(queueItem.id, 'failed', null, error.message);
    } else {
      await updateQueueStatus(queueItem.id, 'pending', null, error.message);
    }

    return { success: false, error: error.message };
  }
}

/**
 * Run automation - process queue until empty
 */
async function runAutomation(options = {}) {
  const {
    maxProfiles = 10,
    headless = true,
    stopOnError = false
  } = options;

  console.log('🤖 Starting LinkedIn automation...');
  console.log(`Rate limit: ${MIN_DELAY_MS}ms between requests`);
  console.log(`Max profiles: ${maxProfiles}`);

  const browser = await puppeteer.launch({
    headless: headless ? 'new' : false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled'
    ]
  });

  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  try {
    while (processed < maxProfiles) {
      const result = await processNextProfile(browser);

      if (!result) {
        console.log('Queue is empty');
        break;
      }

      processed++;
      if (result.success) succeeded++;
      else failed++;

      if (result.rateLimited) {
        console.log('Rate limited - stopping for now');
        break;
      }

      if (!result.success && stopOnError) {
        console.log('Stopping on error');
        break;
      }
    }

  } finally {
    await browser.close();
  }

  console.log('\n📊 Automation Summary:');
  console.log(`  Processed: ${processed}`);
  console.log(`  Succeeded: ${succeeded}`);
  console.log(`  Failed: ${failed}`);

  return { processed, succeeded, failed };
}

/**
 * Get queue statistics
 */
async function getQueueStats() {
  const result = await db.query(
    `SELECT
      status,
      COUNT(*) as count
     FROM linkedin_scrape_queue
     GROUP BY status
     ORDER BY status`
  );

  return result.rows;
}

module.exports = {
  addToQueue,
  runAutomation,
  getQueueStats,
  processNextProfile
};
