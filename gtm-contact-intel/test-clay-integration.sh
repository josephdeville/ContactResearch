#!/bin/bash
# Test Clay Integration

echo "=== Testing Clay Integration ==="
echo ""

# Start server if not running
if ! curl -s http://localhost:3000/health > /dev/null 2>&1; then
  echo "Starting API server..."
  cd /home/user/ContactResearch/gtm-contact-intel
  npm start > /tmp/api-server.log 2>&1 &
  sleep 3
fi

echo "1. Previewing JC Haydon's data for Clay:"
echo ""
curl -s http://localhost:3000/api/clay/preview/1 | jq '{
  email,
  full_name,
  company_name,
  linkedin_headline,
  linkedin_connections,
  linkedin_influence_score,
  primary_wedge,
  wedge_score,
  recommended_channel,
  conversation_starter,
  recent_pain_point: (.recent_pain_point // "" | .[0:100]),
  signal_count,
  field_count
}'

echo ""
echo ""
echo "2. To send to Clay, update your webhook URL in send-to-clay.sh"
echo "   Then run: ./send-to-clay.sh 1"
echo ""
echo "3. Your Clay webhook format:"
echo "   https://api.clay.com/v3/sources/webhook/pull-in-data-from-a-webhook-YOUR-ID"
