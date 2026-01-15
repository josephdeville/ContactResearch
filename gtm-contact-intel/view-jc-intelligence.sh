#!/bin/bash
# View JC Haydon Intelligence

echo "=== JC HAYDON - GTM INTELLIGENCE REPORT ==="
echo ""

# Get full playbook
echo "📊 GTM PLAYBOOK:"
curl -s http://localhost:3000/api/research/playbook/1 | jq '{
  wedge_score,
  primary_wedge,
  recommended_channel: .recommended_channels,
  conversation_starters,
  timing_rationale,
  sample_outreach
}'

echo ""
echo "=== EXPORT OPTIONS ==="
echo ""

# Clay export
echo "📤 CLAY EXPORT (flattened for enrichment):"
curl -s http://localhost:3000/api/export/clay/1 | jq '{
  full_name,
  linkedin_headline,
  linkedin_connections,
  linkedin_influence_score,
  top_signal,
  primary_wedge,
  recommended_channel,
  wedge_score
}'

echo ""
echo "=== VIEW FULL DATA ==="
echo "Full contact dossier:"
echo "  curl http://localhost:3000/api/research/contacts/1 | jq ."
echo ""
echo "All signals:"
echo "  curl http://localhost:3000/api/signals/1 | jq ."
echo ""
echo "Complete playbook:"
echo "  curl http://localhost:3000/api/research/playbook/1 | jq ."
