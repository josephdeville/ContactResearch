#!/usr/bin/env node
/**
 * Import LinkedIn URLs from CSV
 * Supports various CSV formats with LinkedIn URL columns
 */

const fs = require('fs');
const automation = require('./src/scrapers/linkedin-automation');
const db = require('./src/db/client');

function parseCSV(content) {
  const lines = content.split('\n').filter(line => line.trim());
  if (lines.length === 0) return [];

  // Parse header
  const header = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));

  // Find LinkedIn URL column
  const linkedinColIndex = header.findIndex(col =>
    col.includes('linkedin') ||
    col.includes('url') ||
    col.includes('profile')
  );

  if (linkedinColIndex === -1) {
    console.error('❌ Could not find LinkedIn URL column');
    console.log('Available columns:', header.join(', '));
    console.log('\nPlease ensure your CSV has a column with "linkedin", "url", or "profile" in the name');
    process.exit(1);
  }

  console.log(`Found LinkedIn URLs in column: "${header[linkedinColIndex]}"`);

  // Find optional metadata columns
  const nameCol = header.findIndex(col => col.includes('name') || col.includes('full'));
  const titleCol = header.findIndex(col => col.includes('title') || col.includes('position'));
  const companyCol = header.findIndex(col => col.includes('company') || col.includes('organization'));

  // Parse rows
  const results = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Simple CSV parsing (handles basic quotes)
    const values = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
    const cleanValues = values.map(v => v.replace(/^"|"$/g, '').trim());

    const url = cleanValues[linkedinColIndex];
    if (!url || !url.includes('linkedin.com')) continue;

    // Clean URL
    const cleanUrl = url.split('?')[0].trim(); // Remove query params

    // Extract metadata
    const metadata = {};
    if (nameCol !== -1 && cleanValues[nameCol]) {
      metadata.name = cleanValues[nameCol];
    }
    if (titleCol !== -1 && cleanValues[titleCol]) {
      metadata.title = cleanValues[titleCol];
    }
    if (companyCol !== -1 && cleanValues[companyCol]) {
      metadata.company = cleanValues[companyCol];
    }

    results.push({ url: cleanUrl, metadata });
  }

  return results;
}

async function importCSV(filename, options = {}) {
  const { priority = 0, dryRun = false } = options;

  console.log(`📂 Reading CSV file: ${filename}\n`);

  // Read file
  let content;
  try {
    content = fs.readFileSync(filename, 'utf-8');
  } catch (error) {
    console.error(`❌ Failed to read file: ${error.message}`);
    process.exit(1);
  }

  // Parse CSV
  const records = parseCSV(content);

  if (records.length === 0) {
    console.error('❌ No valid LinkedIn URLs found in CSV');
    process.exit(1);
  }

  console.log(`Found ${records.length} LinkedIn URLs\n`);

  // Preview first 5
  console.log('📋 Preview (first 5 URLs):');
  records.slice(0, 5).forEach((record, idx) => {
    console.log(`  ${idx + 1}. ${record.url}`);
    if (Object.keys(record.metadata).length > 0) {
      console.log(`     ${JSON.stringify(record.metadata)}`);
    }
  });

  if (records.length > 5) {
    console.log(`  ... and ${records.length - 5} more`);
  }

  if (dryRun) {
    console.log('\n🔍 Dry run mode - not adding to queue');
    return;
  }

  console.log('\n⏳ Adding to queue...');

  // Add to queue
  let added = 0;
  let skipped = 0;
  let errors = 0;

  for (const record of records) {
    try {
      const result = await automation.addToQueue(record.url, priority, record.metadata);
      if (result[0] && result[0].status) {
        added++;
        if (added % 10 === 0) {
          process.stdout.write(`\r  Added: ${added}/${records.length}`);
        }
      }
    } catch (error) {
      if (error.message.includes('duplicate')) {
        skipped++;
      } else {
        errors++;
        console.error(`\n  Error adding ${record.url}: ${error.message}`);
      }
    }
  }

  console.log(`\n\n✅ Import complete!`);
  console.log(`  Added: ${added}`);
  if (skipped > 0) console.log(`  Skipped (duplicates): ${skipped}`);
  if (errors > 0) console.log(`  Errors: ${errors}`);

  // Show queue status
  console.log('\n📊 Queue Status:');
  const stats = await automation.getQueueStats();
  stats.forEach(row => {
    const emoji = {
      'pending': '⏳',
      'processing': '⚙️',
      'completed': '✅',
      'failed': '❌',
      'rate_limited': '⏸️'
    }[row.status] || '  ';
    console.log(`  ${emoji} ${row.status.padEnd(15)} ${row.count}`);
  });

  console.log('\n💡 Next step: Run automation to process queue');
  console.log('   node linkedin-automation.js run --max 10');
}

// CLI
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help') {
    console.log(`
Import LinkedIn URLs from CSV

USAGE:
  node import-from-csv.js <filename.csv> [options]

OPTIONS:
  --priority <number>    Set priority (default: 0)
  --dry-run             Preview without adding to queue
  --help                Show this help message

CSV FORMAT:
  Your CSV should have a column containing LinkedIn URLs.
  The column can be named: "linkedin", "url", "profile", etc.

  Optional columns for metadata:
  - Name/Full Name
  - Title/Position
  - Company/Organization

EXAMPLES:
  # Import with default priority
  node import-from-csv.js contacts.csv

  # Preview without importing
  node import-from-csv.js contacts.csv --dry-run

  # Import with high priority
  node import-from-csv.js vip-contacts.csv --priority 100

EXAMPLE CSV FORMAT:
  Name,Title,Company,LinkedIn URL
  John Doe,VP Sales,Acme Corp,https://linkedin.com/in/johndoe
  Jane Smith,CRO,TechCo,https://linkedin.com/in/janesmith
    `);
    process.exit(0);
  }

  const filename = args[0];
  const options = {
    priority: 0,
    dryRun: false
  };

  // Parse options
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--priority') {
      options.priority = parseInt(args[i + 1]) || 0;
      i++;
    } else if (args[i] === '--dry-run') {
      options.dryRun = true;
    }
  }

  try {
    await importCSV(filename, options);
    await db.end();
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    await db.end();
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { importCSV };
