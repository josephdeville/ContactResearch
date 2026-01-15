/**
 * API Test Suite
 * Basic tests to validate system functionality
 *
 * Run with: node tests/api.test.js
 */

const axios = require('axios');

const BASE_URL = process.env.API_URL || 'http://localhost:3000';
const TEST_CONTACT = {
  full_name: 'Test User',
  linkedin_url: 'https://linkedin.com/in/testuser',
  email: 'test@example.com',
  current_company: 'Test Corp',
  current_title: 'Test Manager',
  company_domain: 'testcorp.com'
};

// Test results tracker
const results = {
  passed: 0,
  failed: 0,
  tests: []
};

/**
 * Test helper
 */
async function test(name, testFn) {
  try {
    console.log(`\n🧪 Testing: ${name}`);
    await testFn();
    console.log(`✅ PASSED: ${name}`);
    results.passed++;
    results.tests.push({ name, status: 'passed' });
  } catch (error) {
    console.log(`❌ FAILED: ${name}`);
    console.log(`   Error: ${error.message}`);
    results.failed++;
    results.tests.push({ name, status: 'failed', error: error.message });
  }
}

/**
 * Assertion helper
 */
function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

/**
 * Tests
 */

async function testHealthCheck() {
  const response = await axios.get(`${BASE_URL}/health`);
  assert(response.status === 200, 'Health check should return 200');
  assert(response.data.status === 'healthy', 'Status should be healthy');
  assert(response.data.uptime > 0, 'Uptime should be positive');
}

async function testCreateResearchJob() {
  const response = await axios.post(`${BASE_URL}/api/research`, TEST_CONTACT);

  assert(response.status === 200, 'Should return 200');
  assert(response.data.job_id, 'Should return job_id');
  assert(response.data.contact_id, 'Should return contact_id');
  assert(response.data.status === 'pending', 'Status should be pending');

  // Store for later tests
  global.testJobId = response.data.job_id;
  global.testContactId = response.data.contact_id;

  console.log(`   Created job ${global.testJobId} for contact ${global.testContactId}`);
}

async function testGetJobStatus() {
  assert(global.testJobId, 'Test job ID should exist');

  const response = await axios.get(`${BASE_URL}/api/research/${global.testJobId}`);

  assert(response.status === 200, 'Should return 200');
  assert(response.data.job_id === global.testJobId, 'Job ID should match');
  assert(response.data.contact_id === global.testContactId, 'Contact ID should match');
  assert(['pending', 'processing', 'completed', 'failed'].includes(response.data.status),
         'Status should be valid');

  console.log(`   Job status: ${response.data.status}`);
}

async function testGetContact() {
  assert(global.testContactId, 'Test contact ID should exist');

  const response = await axios.get(`${BASE_URL}/api/contacts/${global.testContactId}`);

  assert(response.status === 200, 'Should return 200');
  assert(response.data.contact, 'Should return contact');
  assert(response.data.contact.id === global.testContactId, 'Contact ID should match');
  assert(response.data.contact.full_name === TEST_CONTACT.full_name, 'Name should match');

  console.log(`   Contact: ${response.data.contact.full_name}`);
}

async function testGetSignals() {
  assert(global.testContactId, 'Test contact ID should exist');

  const response = await axios.get(`${BASE_URL}/api/signals/${global.testContactId}`);

  assert(response.status === 200, 'Should return 200');
  assert(Array.isArray(response.data.signals), 'Signals should be an array');
  assert(response.data.contact_id === global.testContactId, 'Contact ID should match');

  console.log(`   Signals found: ${response.data.signals.length}`);
}

async function testGetLinkedInActivity() {
  assert(global.testContactId, 'Test contact ID should exist');

  const response = await axios.get(
    `${BASE_URL}/api/linkedin/recent-activity/${global.testContactId}`
  );

  assert(response.status === 200, 'Should return 200');
  assert(Array.isArray(response.data.posts), 'Posts should be an array');
  assert(response.data.contact_id === global.testContactId, 'Contact ID should match');

  console.log(`   LinkedIn posts: ${response.data.posts.length}`);
}

async function testClayExport() {
  assert(global.testContactId, 'Test contact ID should exist');

  const response = await axios.get(`${BASE_URL}/api/export/clay/${global.testContactId}`);

  assert(response.status === 200, 'Should return 200');
  assert(response.data.contact_name, 'Should have contact_name field');
  assert(response.data.linkedin_url, 'Should have linkedin_url field');
  assert(typeof response.data.contact_readiness_score === 'number',
         'Should have contact_readiness_score');

  console.log(`   Clay export fields: ${Object.keys(response.data).length}`);
}

async function testCSVExport() {
  assert(global.testContactId, 'Test contact ID should exist');

  const response = await axios.get(
    `${BASE_URL}/api/export/csv?contact_ids=${global.testContactId}`,
    { responseType: 'text' }
  );

  assert(response.status === 200, 'Should return 200');
  assert(typeof response.data === 'string', 'Should return CSV string');
  assert(response.data.includes('Name'), 'CSV should have headers');

  const lines = response.data.split('\n');
  console.log(`   CSV rows: ${lines.length}`);
}

async function testExportFormats() {
  const response = await axios.get(`${BASE_URL}/api/export/formats`);

  assert(response.status === 200, 'Should return 200');
  assert(Array.isArray(response.data.formats), 'Formats should be an array');
  assert(response.data.formats.length > 0, 'Should have at least one format');

  console.log(`   Export formats: ${response.data.formats.length}`);
}

async function testInvalidEndpoint() {
  try {
    await axios.get(`${BASE_URL}/api/invalid`);
    throw new Error('Should have thrown 404');
  } catch (error) {
    assert(error.response?.status === 404, 'Should return 404 for invalid endpoint');
  }
}

async function testMissingRequiredFields() {
  try {
    await axios.post(`${BASE_URL}/api/research`, {
      full_name: 'Test User'
      // Missing linkedin_url
    });
    throw new Error('Should have thrown 400');
  } catch (error) {
    assert(error.response?.status === 400, 'Should return 400 for missing fields');
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('=================================================');
  console.log('GTM Contact Intelligence System - API Test Suite');
  console.log('=================================================');
  console.log(`\nTesting API at: ${BASE_URL}`);

  // Basic tests
  await test('Health Check', testHealthCheck);

  // Research workflow
  await test('Create Research Job', testCreateResearchJob);
  await test('Get Job Status', testGetJobStatus);
  await test('Get Contact', testGetContact);
  await test('Get Intelligence Signals', testGetSignals);
  await test('Get LinkedIn Activity', testGetLinkedInActivity);

  // Export tests
  await test('Clay Export Format', testClayExport);
  await test('CSV Export', testCSVExport);
  await test('Get Export Formats', testExportFormats);

  // Error handling
  await test('Invalid Endpoint (404)', testInvalidEndpoint);
  await test('Missing Required Fields (400)', testMissingRequiredFields);

  // Print summary
  console.log('\n=================================================');
  console.log('Test Summary');
  console.log('=================================================');
  console.log(`Total tests: ${results.passed + results.failed}`);
  console.log(`Passed: ${results.passed}`);
  console.log(`Failed: ${results.failed}`);

  if (results.failed > 0) {
    console.log('\nFailed tests:');
    results.tests
      .filter(t => t.status === 'failed')
      .forEach(t => console.log(`  - ${t.name}: ${t.error}`));
  }

  console.log('=================================================\n');

  // Note about research job completion
  if (global.testJobId) {
    console.log('⏱️  Note: Research job started but may not be complete.');
    console.log(`   Check status: curl ${BASE_URL}/api/research/${global.testJobId}`);
    console.log(`   Research typically takes 3-5 minutes to complete.\n`);
  }

  // Exit with appropriate code
  process.exit(results.failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
  console.error('Test suite error:', error);
  process.exit(1);
});
