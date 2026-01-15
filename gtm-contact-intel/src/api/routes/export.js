const express = require('express');
const router = express.Router();

const clayFormatter = require('../../exporters/clay-formatter');
const csvExporter = require('../../exporters/csv-exporter');

/**
 * GET /api/export/clay/:contactId
 * Export contact data in Clay-compatible format
 */
router.get('/clay/:contactId', async (req, res) => {
  try {
    const { contactId } = req.params;

    const clayData = await clayFormatter.formatContact(contactId);

    res.json(clayData);

  } catch (error) {
    console.error('Clay export error:', error);
    res.status(500).json({
      error: 'Failed to export to Clay format',
      message: error.message
    });
  }
});

/**
 * GET /api/export/csv
 * Export multiple contacts to CSV
 * Query params: contact_ids (comma-separated)
 */
router.get('/csv', async (req, res) => {
  try {
    const { contact_ids, format } = req.query;

    if (!contact_ids) {
      return res.status(400).json({
        error: 'Missing required parameter',
        required: ['contact_ids'],
        example: '/api/export/csv?contact_ids=1,2,3'
      });
    }

    const contactIds = contact_ids.split(',').map(id => parseInt(id.trim()));

    let csv;

    // Handle different export formats
    switch (format) {
      case 'linkedin':
        csv = await csvExporter.exportLinkedInOnly(contactIds);
        break;
      case 'playbook':
        csv = await csvExporter.exportPlaybookSummary(contactIds);
        break;
      case 'high_priority':
        csv = await csvExporter.exportHighPriorityContacts(contactIds);
        break;
      default:
        csv = await csvExporter.exportMultipleContacts(contactIds);
    }

    if (!csv) {
      return res.status(404).json({
        error: 'No contacts found or no data available'
      });
    }

    // Set headers for CSV download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="gtm-intel-export-${Date.now()}.csv"`);
    res.send(csv);

  } catch (error) {
    console.error('CSV export error:', error);
    res.status(500).json({
      error: 'Failed to export CSV',
      message: error.message
    });
  }
});

/**
 * GET /api/export/csv/columns
 * Get available CSV column definitions
 */
router.get('/csv/columns', (req, res) => {
  try {
    const columns = csvExporter.getAvailableColumns();

    res.json({
      columns,
      formats: [
        {
          name: 'default',
          description: 'All columns with LinkedIn priority',
          usage: '/api/export/csv?contact_ids=1,2,3'
        },
        {
          name: 'linkedin',
          description: 'LinkedIn-only columns',
          usage: '/api/export/csv?contact_ids=1,2,3&format=linkedin'
        },
        {
          name: 'playbook',
          description: 'Playbook summary for outreach planning',
          usage: '/api/export/csv?contact_ids=1,2,3&format=playbook'
        },
        {
          name: 'high_priority',
          description: 'Only high-priority contacts',
          usage: '/api/export/csv?contact_ids=1,2,3&format=high_priority'
        }
      ]
    });

  } catch (error) {
    console.error('Columns listing error:', error);
    res.status(500).json({
      error: 'Failed to list columns',
      message: error.message
    });
  }
});

/**
 * POST /api/export/clay/batch
 * Export multiple contacts to Clay format
 */
router.post('/clay/batch', async (req, res) => {
  try {
    const { contact_ids } = req.body;

    if (!contact_ids || !Array.isArray(contact_ids)) {
      return res.status(400).json({
        error: 'Invalid request',
        required: 'contact_ids array in request body'
      });
    }

    const clayDataArray = await clayFormatter.formatMultipleContacts(contact_ids);

    res.json({
      count: clayDataArray.length,
      contacts: clayDataArray
    });

  } catch (error) {
    console.error('Clay batch export error:', error);
    res.status(500).json({
      error: 'Failed to batch export to Clay',
      message: error.message
    });
  }
});

/**
 * GET /api/export/formats
 * Get available export formats and their descriptions
 */
router.get('/formats', (req, res) => {
  res.json({
    formats: [
      {
        name: 'Clay (JSON)',
        endpoint: 'GET /api/export/clay/:contactId',
        description: 'Export single contact in Clay-compatible JSON format',
        use_case: 'Clay table enrichment'
      },
      {
        name: 'Clay Batch (JSON)',
        endpoint: 'POST /api/export/clay/batch',
        description: 'Export multiple contacts in Clay-compatible JSON format',
        use_case: 'Bulk Clay enrichment'
      },
      {
        name: 'CSV (Full)',
        endpoint: 'GET /api/export/csv?contact_ids=1,2,3',
        description: 'Export multiple contacts with all fields',
        use_case: 'Manual review, spreadsheet analysis'
      },
      {
        name: 'CSV (LinkedIn)',
        endpoint: 'GET /api/export/csv?contact_ids=1,2,3&format=linkedin',
        description: 'Export with LinkedIn-only fields',
        use_case: 'LinkedIn-focused outreach planning'
      },
      {
        name: 'CSV (Playbook)',
        endpoint: 'GET /api/export/csv?contact_ids=1,2,3&format=playbook',
        description: 'Export playbook summary with outreach recommendations',
        use_case: 'Sales team outreach planning'
      },
      {
        name: 'CSV (High Priority)',
        endpoint: 'GET /api/export/csv?contact_ids=1,2,3&format=high_priority',
        description: 'Export only high-priority contacts',
        use_case: 'Prioritized outreach lists'
      }
    ]
  });
});

module.exports = router;
