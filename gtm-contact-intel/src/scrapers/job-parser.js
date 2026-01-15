const firecrawl = require('./firecrawl-client');
const { companyQueries, signalQueries } = require('../db/queries');
const config = require('../../config/config');

/**
 * Job Posting Parser
 * Scrapes and analyzes company job postings for GTM intelligence signals
 */
class JobParser {
  constructor() {
    this.gtmKeywords = config.gtmTopics;
    this.gtmDepartments = ['Sales', 'Marketing', 'Revenue Operations', 'Sales Operations',
                           'Customer Success', 'Business Development', 'GTM'];
    this.urgencyIndicators = ['immediate', 'urgent', 'ASAP', 'rapid growth',
                              'fast-paced', 'quickly', 'scaling', 'expanding rapidly'];
  }

  /**
   * Research company job postings
   * @param {number} contactId - Database contact ID
   * @param {string} companyDomain - Company domain
   * @param {string} companyName - Company name
   * @returns {Promise<Object>} Job posting intelligence
   */
  async researchCompany(contactId, companyDomain, companyName) {
    console.log(`Starting job posting research for company ${companyDomain}`);

    try {
      // Construct careers page URLs to try
      const careerUrls = this.constructCareerUrls(companyDomain, companyName);

      let jobPostings = [];

      // Try each career URL
      for (const url of careerUrls) {
        try {
          const scrapedJobs = await this.scrapeCareerPage(url);
          if (scrapedJobs.length > 0) {
            jobPostings = scrapedJobs;
            break; // Found jobs, stop trying
          }
        } catch (error) {
          console.log(`Failed to scrape ${url}, trying next URL...`);
          continue;
        }
      }

      if (jobPostings.length === 0) {
        console.log(`No job postings found for ${companyDomain}`);
        return {
          success: false,
          error: 'No job postings found',
          analyzed: 0
        };
      }

      // Analyze job postings
      const analyzedJobs = jobPostings.map(job => this.analyzeJobPosting(job, companyDomain));

      // Filter for GTM-relevant jobs
      const gtmRelevantJobs = analyzedJobs.filter(job =>
        this.gtmDepartments.some(dept =>
          job.department?.toLowerCase().includes(dept.toLowerCase()) ||
          job.job_title?.toLowerCase().includes(dept.toLowerCase())
        )
      );

      // Save job postings to database
      for (const job of gtmRelevantJobs) {
        await companyQueries.saveJobPosting(job);
      }

      // Create intelligence signals
      if (gtmRelevantJobs.length > 0) {
        await this.createIntelligenceSignals(contactId, companyDomain, gtmRelevantJobs);
      }

      console.log(`Analyzed ${gtmRelevantJobs.length} GTM-relevant job postings for ${companyDomain}`);

      return {
        success: true,
        totalJobs: jobPostings.length,
        gtmRelevantJobs: gtmRelevantJobs.length,
        analyzed: gtmRelevantJobs.length
      };

    } catch (error) {
      console.error(`Job posting research failed for ${companyDomain}:`, error.message);
      return {
        success: false,
        error: error.message,
        analyzed: 0
      };
    }
  }

  /**
   * Construct possible career page URLs
   */
  constructCareerUrls(domain, companyName) {
    const baseDomain = domain.replace('www.', '');

    return [
      `https://${baseDomain}/careers`,
      `https://${baseDomain}/jobs`,
      `https://careers.${baseDomain}`,
      `https://jobs.${baseDomain}`,
      `https://${baseDomain}/about/careers`,
      `https://${baseDomain}/company/careers`,
      `https://boards.greenhouse.io/${companyName.toLowerCase().replace(/\s+/g, '')}`,
      `https://${companyName.toLowerCase().replace(/\s+/g, '')}.lever.co`,
    ];
  }

  /**
   * Scrape career page for job postings
   */
  async scrapeCareerPage(url) {
    try {
      console.log(`Scraping career page: ${url}`);

      const result = await firecrawl.scrapeGeneral(url, {
        onlyMainContent: true,
        waitFor: 3000
      });

      if (!result.success) {
        return [];
      }

      // Parse job postings from scraped content
      const jobs = this.parseJobsFromContent(result.markdown, url);

      return jobs;

    } catch (error) {
      console.error(`Career page scraping error for ${url}:`, error.message);
      return [];
    }
  }

  /**
   * Parse job postings from scraped content
   */
  parseJobsFromContent(markdown, baseUrl) {
    const jobs = [];

    // This is a simplified parser
    // Real implementation would parse structured job board HTML

    // Look for job title patterns
    const lines = markdown.split('\n');
    let currentJob = null;

    lines.forEach((line, index) => {
      // Detect job titles (usually in headings or links)
      if (this.looksLikeJobTitle(line)) {
        if (currentJob) {
          jobs.push(currentJob);
        }

        currentJob = {
          job_title: line.replace(/^[#\-*\s]+/, '').trim(),
          job_url: `${baseUrl}#job-${jobs.length}`,
          posted_date: new Date(),
          raw_content: ''
        };
      } else if (currentJob) {
        // Accumulate job description
        currentJob.raw_content += line + '\n';
      }
    });

    // Add last job
    if (currentJob) {
      jobs.push(currentJob);
    }

    return jobs.slice(0, 50); // Limit to 50 jobs
  }

  /**
   * Check if a line looks like a job title
   */
  looksLikeJobTitle(line) {
    const trimmed = line.trim();

    // Job titles usually contain these keywords
    const jobKeywords = ['manager', 'director', 'engineer', 'developer', 'analyst',
                        'specialist', 'coordinator', 'representative', 'lead',
                        'senior', 'junior', 'associate', 'executive', 'officer', 'head'];

    const hasJobKeyword = jobKeywords.some(keyword =>
      trimmed.toLowerCase().includes(keyword)
    );

    // Job titles are usually short (under 100 chars) and don't contain full sentences
    const isShort = trimmed.length < 100;
    const notFullSentence = !trimmed.includes('. ');

    return hasJobKeyword && isShort && notFullSentence;
  }

  /**
   * Analyze a job posting
   */
  analyzeJobPosting(job, companyDomain) {
    const content = `${job.job_title} ${job.raw_content}`.toLowerCase();

    // Determine department
    const department = this.detectDepartment(job.job_title, job.raw_content);

    // Determine seniority level
    const seniority = this.detectSeniority(job.job_title);

    // Extract initiative signals
    const initiativeSignals = this.extractInitiativeSignals(content);

    // Extract tech stack mentions
    const techStackMentions = this.extractTechStack(content);

    // Detect urgency indicators
    const urgencyIndicators = this.detectUrgency(content);

    // Generate requirements summary
    const requirementsSummary = this.summarizeRequirements(job.raw_content);

    return {
      company_domain: companyDomain,
      job_title: job.job_title,
      job_url: job.job_url,
      posted_date: job.posted_date,
      department,
      seniority_level: seniority,
      initiative_signals: initiativeSignals,
      tech_stack_mentions: techStackMentions,
      urgency_indicators: urgencyIndicators,
      requirements_summary: requirementsSummary,
      raw_job_data: {
        raw_content: job.raw_content.substring(0, 2000),
        scrapedAt: new Date().toISOString()
      }
    };
  }

  /**
   * Detect department from job title and description
   */
  detectDepartment(title, description) {
    const text = `${title} ${description}`.toLowerCase();

    if (text.includes('sales') && text.includes('operation')) return 'Sales Operations';
    if (text.includes('revenue') && text.includes('operation')) return 'Revenue Operations';
    if (text.includes('sales')) return 'Sales';
    if (text.includes('marketing')) return 'Marketing';
    if (text.includes('customer success')) return 'Customer Success';
    if (text.includes('business development')) return 'Business Development';

    return 'Other';
  }

  /**
   * Detect seniority level
   */
  detectSeniority(title) {
    const lower = title.toLowerCase();

    if (lower.includes('chief') || lower.includes('cto') || lower.includes('ceo')) return 'C-Level';
    if (lower.includes('vp') || lower.includes('vice president')) return 'VP';
    if (lower.includes('director')) return 'Director';
    if (lower.includes('manager') || lower.includes('lead')) return 'Manager';
    if (lower.includes('senior') || lower.includes('sr')) return 'Senior IC';
    if (lower.includes('junior') || lower.includes('jr')) return 'Junior IC';

    return 'IC';
  }

  /**
   * Extract initiative signals
   */
  extractInitiativeSignals(content) {
    const signals = [];

    const initiativeKeywords = [
      'new team', 'building a team', 'expanding team', 'scaling',
      'rapid growth', 'launching', 'new product', 'transformation',
      'digital transformation', 'modernizing', 'upgrading'
    ];

    initiativeKeywords.forEach(keyword => {
      if (content.includes(keyword.toLowerCase())) {
        signals.push(keyword);
      }
    });

    return signals;
  }

  /**
   * Extract tech stack mentions
   */
  extractTechStack(content) {
    const tools = [];

    this.gtmKeywords.tools.forEach(tool => {
      if (content.includes(tool.toLowerCase())) {
        tools.push(tool);
      }
    });

    return tools;
  }

  /**
   * Detect urgency indicators
   */
  detectUrgency(content) {
    const indicators = [];

    this.urgencyIndicators.forEach(indicator => {
      if (content.includes(indicator.toLowerCase())) {
        indicators.push(indicator);
      }
    });

    return indicators;
  }

  /**
   * Summarize requirements
   */
  summarizeRequirements(description) {
    // Extract key requirements (simplified)
    const lines = description.split('\n');
    const requirementLines = lines
      .filter(line => {
        const trimmed = line.trim();
        return (
          trimmed.match(/^[-•*]\s/) || // Bullet points
          trimmed.toLowerCase().includes('require') ||
          trimmed.toLowerCase().includes('must have')
        );
      })
      .slice(0, 5); // Top 5 requirements

    return requirementLines.join('\n');
  }

  /**
   * Create intelligence signals from job postings
   */
  async createIntelligenceSignals(contactId, companyDomain, jobs) {
    const signals = [];

    // Signal 1: High volume of GTM hiring
    if (jobs.length >= 3) {
      signals.push({
        signal_type: 'company_hiring',
        signal_category: 'timing_trigger',
        description: `Company is hiring ${jobs.length} GTM roles: ${jobs.map(j => j.job_title).slice(0, 3).join(', ')}. Indicates growth and potential budget for new tools.`,
        relevance_score: 0.85,
        urgency_score: 0.80,
        wedge_potential: 0.75,
        raw_data: {
          jobCount: jobs.length,
          titles: jobs.map(j => j.job_title)
        }
      });
    }

    // Signal 2: Senior hiring (budget authority)
    const seniorHires = jobs.filter(j =>
      ['VP', 'Director', 'C-Level'].includes(j.seniority_level)
    );

    if (seniorHires.length > 0) {
      signals.push({
        signal_type: 'company_hiring',
        signal_category: 'timing_trigger',
        description: `Hiring senior GTM roles: ${seniorHires.map(j => j.job_title).join(', ')}. New leaders often bring budget for new tools.`,
        relevance_score: 0.90,
        urgency_score: 0.85,
        wedge_potential: 0.85,
        raw_data: { seniorHires: seniorHires.map(j => j.job_title) }
      });
    }

    // Signal 3: Initiative signals (transformation, scaling)
    const jobsWithInitiatives = jobs.filter(j => j.initiative_signals.length > 0);

    if (jobsWithInitiatives.length > 0) {
      const allInitiatives = [...new Set(jobsWithInitiatives.flatMap(j => j.initiative_signals))];

      signals.push({
        signal_type: 'company_initiatives',
        signal_category: 'buying_signal',
        description: `Company initiatives detected in job postings: ${allInitiatives.join(', ')}. Indicates active transformation and tool evaluation.`,
        relevance_score: 0.88,
        urgency_score: 0.82,
        wedge_potential: 0.80,
        raw_data: { initiatives: allInitiatives }
      });
    }

    // Signal 4: Current tech stack (competitive displacement opportunities)
    const jobsWithTechStack = jobs.filter(j => j.tech_stack_mentions.length > 0);

    if (jobsWithTechStack.length > 0) {
      const techStack = [...new Set(jobsWithTechStack.flatMap(j => j.tech_stack_mentions))];

      signals.push({
        signal_type: 'company_tech_stack',
        signal_category: 'competitive',
        description: `Current tech stack: ${techStack.join(', ')}. Potential displacement opportunities.`,
        relevance_score: 0.80,
        urgency_score: 0.70,
        wedge_potential: 0.75,
        raw_data: { techStack }
      });
    }

    // Signal 5: Urgency indicators
    const urgentJobs = jobs.filter(j => j.urgency_indicators.length > 0);

    if (urgentJobs.length > 0) {
      signals.push({
        signal_type: 'company_hiring',
        signal_category: 'timing_trigger',
        description: `${urgentJobs.length} jobs posted with urgency indicators: ${urgentJobs[0].urgency_indicators.join(', ')}. Company is moving fast.`,
        relevance_score: 0.85,
        urgency_score: 0.90,
        wedge_potential: 0.80,
        raw_data: { urgentJobCount: urgentJobs.length }
      });
    }

    // Save signals
    for (const signal of signals) {
      await signalQueries.createSignal(contactId, signal);
    }

    console.log(`Created ${signals.length} job posting signals for contact ${contactId}`);

    return signals;
  }
}

module.exports = new JobParser();
