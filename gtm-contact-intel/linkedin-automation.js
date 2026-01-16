#!/usr/bin/env node
/**
 * LinkedIn Automation CLI
 * Manage automated LinkedIn profile scraping
 */

const automation = require('./src/scrapers/linkedin-automation');
const db = require('./src/db/client');

const commands = {
  'add': addUrls,
  'run': runAutomation,
  'status': showStatus,
  'help': showHelp
};

async function addUrls(args) {
  if (args.length === 0) {
    console.error('❌ Please provide LinkedIn URLs to add');
    console.log('Usage: node linkedin-automation.js add <url1> <url2> ...');
    console.log('   or: node linkedin-automation.js add --file urls.txt');
    process.exit(1);
  }

  let urls = [];

  // Load from file if --file flag
  if (args[0] === '--file') {
    const fs = require('fs');
    const filename = args[1];
    if (!filename) {
      console.error('❌ Please specify a file');
      process.exit(1);
    }
    const content = fs.readFileSync(filename, 'utf-8');
    urls = content.split('\n')
      .map(line => line.trim())
      .filter(line => line && line.startsWith('http'));
  } else {
    urls = args;
  }

  console.log(`Adding ${urls.length} URLs to queue...`);

  const results = await automation.addToQueue(urls);

  const added = results.filter(r => !r.error).length;
  const failed = results.filter(r => r.error).length;

  console.log(`\n✓ Added: ${added}`);
  if (failed > 0) {
    console.log(`✗ Failed: ${failed}`);
  }
}

async function runAutomation(args) {
  const options = {
    maxProfiles: 10,
    headless: true,
    stopOnError: false
  };

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--max') {
      options.maxProfiles = parseInt(args[i + 1]) || 10;
      i++;
    } else if (args[i] === '--visible') {
      options.headless = false;
    } else if (args[i] === '--stop-on-error') {
      options.stopOnError = true;
    }
  }

  console.log('🚀 Starting automation with options:');
  console.log(`   Max profiles: ${options.maxProfiles}`);
  console.log(`   Mode: ${options.headless ? 'Headless' : 'Visible'}`);
  console.log(`   Stop on error: ${options.stopOnError}\n`);

  const stats = await automation.runAutomation(options);

  console.log('\n✨ Automation completed!');
  process.exit(0);
}

async function showStatus() {
  console.log('📊 Queue Status:\n');

  const stats = await automation.getQueueStats();

  if (stats.length === 0) {
    console.log('  Queue is empty');
    return;
  }

  const statusEmojis = {
    'pending': '⏳',
    'processing': '⚙️',
    'completed': '✅',
    'failed': '❌',
    'rate_limited': '⏸️'
  };

  for (const row of stats) {
    const emoji = statusEmojis[row.status] || '  ';
    console.log(`  ${emoji} ${row.status.padEnd(15)} ${row.count}`);
  }

  // Get next profiles to process
  const result = await db.query(
    `SELECT linkedin_url, priority, attempts
     FROM linkedin_scrape_queue
     WHERE status IN ('pending', 'rate_limited')
     ORDER BY priority DESC, added_at ASC
     LIMIT 5`
  );

  if (result.rows.length > 0) {
    console.log('\n📝 Next profiles to process:');
    result.rows.forEach((row, idx) => {
      console.log(`  ${idx + 1}. ${row.linkedin_url}`);
      if (row.attempts > 0) console.log(`     (attempt ${row.attempts + 1})`);
    });
  }
}

function showHelp() {
  console.log(`
LinkedIn Automation Tool

USAGE:
  node linkedin-automation.js <command> [options]

COMMANDS:
  add <urls...>              Add LinkedIn URLs to scraping queue
  add --file <filename>      Add URLs from a text file (one per line)
  run [options]              Run automation to process queue
  status                     Show queue statistics
  help                       Show this help message

RUN OPTIONS:
  --max <number>             Max profiles to process (default: 10)
  --visible                  Run browser in visible mode (default: headless)
  --stop-on-error            Stop on first error (default: continue)

EXAMPLES:
  # Add single URL
  node linkedin-automation.js add https://www.linkedin.com/in/john-doe

  # Add multiple URLs
  node linkedin-automation.js add https://linkedin.com/in/user1 https://linkedin.com/in/user2

  # Add URLs from file
  node linkedin-automation.js add --file linkedin-urls.txt

  # Run automation (process 10 profiles)
  node linkedin-automation.js run

  # Process 50 profiles in visible mode
  node linkedin-automation.js run --max 50 --visible

  # Check queue status
  node linkedin-automation.js status

RATE LIMITING:
  - 6 second delay between requests
  - Max 10 requests per minute
  - Automatic retry for rate-limited requests

NOTES:
  - LinkedIn may require you to be logged in
  - For best results, run with --visible first to login
  - Profiles are processed in order of priority (highest first)
  `);
}

// Main
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';
  const commandArgs = args.slice(1);

  const handler = commands[command];

  if (!handler) {
    console.error(`❌ Unknown command: ${command}`);
    showHelp();
    process.exit(1);
  }

  try {
    await handler(commandArgs);
    await db.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    await db.end();
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
