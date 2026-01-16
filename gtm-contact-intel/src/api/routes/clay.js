/**
 * Clay Integration Routes
 */

const express = require('express');
const router = express.Router();
const { sendToClay, sendBatchToClay, formatForClay } = require('../../exporters/clay-webhook');

/**
 * POST /api/clay/send/:contactId
 * Send a single contact's intelligence to Clay webhook
 */
router.post('/send/:contactId', async (req, res) => {
  try {
    const { contactId } = req.params;
    const { webhookUrl } = req.body;

    if (!webhookUrl) {
      return res.status(400).json({
        error: 'Missing webhook URL',
        message: 'Please provide webhookUrl in request body'
      });
    }

    const result = await sendToClay(parseInt(contactId), webhookUrl);

    res.json({
      success: true,
      message: `Contact ${contactId} sent to Clay successfully`,
      ...result
    });
  } catch (error) {
    console.error('Clay send error:', error);
    res.status(500).json({
      error: 'Failed to send to Clay',
      message: error.message
    });
  }
});

/**
 * POST /api/clay/send-batch
 * Send multiple contacts to Clay webhook
 */
router.post('/send-batch', async (req, res) => {
  try {
    const { contactIds, webhookUrl } = req.body;

    if (!webhookUrl) {
      return res.status(400).json({
        error: 'Missing webhook URL',
        message: 'Please provide webhookUrl in request body'
      });
    }

    if (!contactIds || !Array.isArray(contactIds)) {
      return res.status(400).json({
        error: 'Invalid contact IDs',
        message: 'Please provide contactIds as an array'
      });
    }

    const result = await sendBatchToClay(contactIds, webhookUrl);

    res.json({
      success: true,
      message: `Sent ${result.successful}/${result.total} contacts to Clay`,
      ...result
    });
  } catch (error) {
    console.error('Clay batch send error:', error);
    res.status(500).json({
      error: 'Failed to send batch to Clay',
      message: error.message
    });
  }
});

/**
 * GET /api/clay/preview/:contactId
 * Preview what data will be sent to Clay (without sending)
 */
router.get('/preview/:contactId', async (req, res) => {
  try {
    const { contactId } = req.params;
    const clayData = await formatForClay(parseInt(contactId));

    res.json({
      contact_id: parseInt(contactId),
      preview: clayData,
      field_count: Object.keys(clayData).length,
      fields: Object.keys(clayData)
    });
  } catch (error) {
    console.error('Clay preview error:', error);
    res.status(500).json({
      error: 'Failed to generate preview',
      message: error.message
    });
  }
});

module.exports = router;
