/**
 * LinkedIn Data Extractor - Content Script
 * Runs on LinkedIn pages and extracts profile/post data
 */

// Listen for extraction requests from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractLinkedInData') {
    try {
      const data = extractLinkedInData();
      sendResponse({ success: true, data });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }
  return true; // Keep channel open for async response
});

/**
 * Main extraction function
 */
function extractLinkedInData() {
  const url = window.location.href;

  // Check if we're on a profile page
  if (!url.includes('/in/')) {
    throw new Error('Please navigate to a LinkedIn profile page');
  }

  const data = {
    profile: extractProfile(),
    posts: extractPosts()
  };

  return data;
}

/**
 * Extract profile data
 */
function extractProfile() {
  const profile = {
    linkedin_url: window.location.href.split('?')[0], // Remove query params
    headline: null,
    location: null,
    connections_count: null,
    followers_count: null,
    tenure_months: null,
    previous_companies: [],
    skills: [],
    certifications: [],
    education: null,
    summary: null
  };

  // Extract headline
  const headlineEl = document.querySelector('.text-body-medium.break-words') ||
                     document.querySelector('.pv-text-details__left-panel h1 + div');
  if (headlineEl) {
    profile.headline = headlineEl.textContent.trim();
  }

  // Extract location
  const locationEl = document.querySelector('.text-body-small.inline.t-black--light.break-words') ||
                     document.querySelector('.pv-text-details__left-panel .text-body-small');
  if (locationEl) {
    profile.location = locationEl.textContent.trim();
  }

  // Extract connections count
  const connectionsText = document.body.innerText;
  const connectionsMatch = connectionsText.match(/(\d[\d,]*)\s*connections?/i);
  if (connectionsMatch) {
    profile.connections_count = parseInt(connectionsMatch[1].replace(/,/g, ''));
  }

  // Try to find followers (usually shown on some profiles)
  const followersMatch = connectionsText.match(/(\d[\d,]*)\s*followers?/i);
  if (followersMatch) {
    profile.followers_count = parseInt(followersMatch[1].replace(/,/g, ''));
  }

  // Extract experience and calculate tenure
  const experienceSection = document.querySelector('#experience');
  if (experienceSection) {
    const currentJobs = Array.from(experienceSection.querySelectorAll('li')).slice(0, 3);

    currentJobs.forEach(job => {
      const text = job.textContent;

      // Look for "Present" to find current role
      if (text.includes('Present') || text.includes('present')) {
        const dateMatch = text.match(/(\w+\s+\d{4})\s*[-–]\s*Present/i);
        if (dateMatch) {
          const startDate = new Date(dateMatch[1]);
          const now = new Date();
          const months = (now.getFullYear() - startDate.getFullYear()) * 12 +
                        (now.getMonth() - startDate.getMonth());
          profile.tenure_months = months;
        }
      }

      // Extract company names
      const companyMatch = text.match(/at\s+([A-Za-z0-9\s&,.-]+?)(?:\n|·|$)/);
      if (companyMatch && !profile.previous_companies.includes(companyMatch[1].trim())) {
        profile.previous_companies.push(companyMatch[1].trim());
      }
    });
  }

  // Extract skills
  const skillsSection = document.querySelector('#skills');
  if (skillsSection) {
    const skillElements = skillsSection.querySelectorAll('.pvs-entity__path-node');
    skillElements.forEach(skill => {
      const skillName = skill.textContent.trim();
      if (skillName && skillName.length > 2 && profile.skills.length < 15) {
        profile.skills.push(skillName);
      }
    });
  }

  // Extract about/summary
  const aboutSection = document.querySelector('#about');
  if (aboutSection) {
    const aboutText = aboutSection.parentElement.querySelector('.inline-show-more-text');
    if (aboutText) {
      profile.summary = aboutText.textContent.trim().substring(0, 1000);
    }
  }

  // Extract education
  const educationSection = document.querySelector('#education');
  if (educationSection) {
    const eduElements = educationSection.parentElement.querySelectorAll('.pvs-entity');
    if (eduElements.length > 0) {
      const eduText = eduElements[0].textContent;
      const schoolMatch = eduText.match(/([A-Za-z\s,.-]+University[A-Za-z\s,.-]*)/i);
      const degreeMatch = eduText.match(/(Bachelor|Master|MBA|PhD|B\.S\.|M\.S\.|B\.A\.|M\.A\.)[^·\n]*/i);

      profile.education = {
        school: schoolMatch ? schoolMatch[1].trim() : null,
        degree: degreeMatch ? degreeMatch[0].trim() : null
      };
    }
  }

  return profile;
}

/**
 * Extract recent posts
 */
function extractPosts() {
  const posts = [];

  // Try to find posts in the activity section
  // Note: This works best if you're on the /recent-activity/ page
  const postElements = document.querySelectorAll('.feed-shared-update-v2') ||
                       document.querySelectorAll('[data-urn*="activity"]');

  postElements.forEach((postEl, index) => {
    if (index >= 10) return; // Limit to 10 posts

    try {
      const post = {
        url: null,
        date: null,
        content: null,
        likes: 0,
        comments: 0,
        shares: 0,
        type: 'post'
      };

      // Extract post content
      const contentEl = postEl.querySelector('.feed-shared-text') ||
                       postEl.querySelector('.break-words');
      if (contentEl) {
        post.content = contentEl.textContent.trim();
      }

      // Extract date
      const dateEl = postEl.querySelector('.feed-shared-actor__sub-description') ||
                    postEl.querySelector('time');
      if (dateEl) {
        const dateText = dateEl.textContent.trim();
        post.date = parseLinkedInDate(dateText);
      }

      // Extract engagement counts
      const socialBar = postEl.querySelector('.social-details-social-counts');
      if (socialBar) {
        const text = socialBar.textContent;

        // Likes
        const likesMatch = text.match(/(\d[\d,]*)\s*(?:reactions?|likes?)/i);
        if (likesMatch) {
          post.likes = parseInt(likesMatch[1].replace(/,/g, ''));
        }

        // Comments
        const commentsMatch = text.match(/(\d[\d,]*)\s*comments?/i);
        if (commentsMatch) {
          post.comments = parseInt(commentsMatch[1].replace(/,/g, ''));
        }

        // Shares/reposts
        const sharesMatch = text.match(/(\d[\d,]*)\s*(?:reposts?|shares?)/i);
        if (sharesMatch) {
          post.shares = parseInt(sharesMatch[1].replace(/,/g, ''));
        }
      }

      // Try to extract post URL
      const linkEl = postEl.querySelector('a[href*="/posts/"]') ||
                    postEl.querySelector('a[href*="activity"]');
      if (linkEl) {
        post.url = linkEl.href.split('?')[0];
      }

      // Only add post if we have content
      if (post.content && post.content.length > 10) {
        posts.push(post);
      }

    } catch (error) {
      console.error('Error extracting post:', error);
    }
  });

  return posts;
}

/**
 * Parse LinkedIn date format to ISO date
 */
function parseLinkedInDate(dateText) {
  const now = new Date();

  // Handle relative dates
  if (dateText.includes('hour') || dateText.includes('hr')) {
    return now.toISOString();
  }

  if (dateText.includes('day') || dateText.includes('d')) {
    const daysMatch = dateText.match(/(\d+)/);
    const days = daysMatch ? parseInt(daysMatch[1]) : 1;
    const date = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));
    return date.toISOString();
  }

  if (dateText.includes('week') || dateText.includes('wk')) {
    const weeksMatch = dateText.match(/(\d+)/);
    const weeks = weeksMatch ? parseInt(weeksMatch[1]) : 1;
    const date = new Date(now.getTime() - (weeks * 7 * 24 * 60 * 60 * 1000));
    return date.toISOString();
  }

  if (dateText.includes('month') || dateText.includes('mo')) {
    const monthsMatch = dateText.match(/(\d+)/);
    const months = monthsMatch ? parseInt(monthsMatch[1]) : 1;
    const date = new Date(now);
    date.setMonth(date.getMonth() - months);
    return date.toISOString();
  }

  // Try to parse absolute dates
  try {
    return new Date(dateText).toISOString();
  } catch {
    return now.toISOString();
  }
}

// Auto-extract when profile loads (for development)
console.log('GTM Contact Intelligence - LinkedIn Extractor loaded');
