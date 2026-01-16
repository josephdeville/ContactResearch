#!/bin/bash
# Send GTM Contact Intelligence to Clay via Webhook

# Your Clay webhook URL
CLAY_WEBHOOK_URL=https://api.clay.com/v3/sources/webhook/pull-in-data-from-a-webhook-fa59bcce-da9c-40f0-9e7d-d680d84f95f7
# API base URL
API_URL="http://localhost:3000"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║   GTM Contact Intelligence → Clay Integration             ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Check if contact ID is provided
if [ -z "$1" ]; then
  echo -e "${RED}Usage:${NC}"
  echo "  ./send-to-clay.sh <contact_id>              # Send single contact"
  echo "  ./send-to-clay.sh preview <contact_id>      # Preview without sending"
  echo "  ./send-to-clay.sh batch 1,2,3               # Send multiple contacts"
  echo ""
  echo -e "${BLUE}Examples:${NC}"
  echo "  ./send-to-clay.sh 1                         # Send JC Haydon to Clay"
  echo "  ./send-to-clay.sh preview 1                 # Preview JC Haydon's data"
  echo "  ./send-to-clay.sh batch 1,2,3               # Send contacts 1, 2, and 3"
  exit 1
fi

# Preview mode
if [ "$1" = "preview" ]; then
  CONTACT_ID=$2
  if [ -z "$CONTACT_ID" ]; then
    echo -e "${RED}Error: Contact ID required for preview${NC}"
    exit 1
  fi

  echo -e "${BLUE}Previewing data for Contact ID: ${CONTACT_ID}${NC}"
  echo ""

  curl -s "${API_URL}/api/clay/preview/${CONTACT_ID}" | jq .
  exit 0
fi

# Batch mode
if [ "$1" = "batch" ]; then
  if [ -z "$2" ]; then
    echo -e "${RED}Error: Contact IDs required (comma-separated)${NC}"
    echo "Example: ./send-to-clay.sh batch 1,2,3"
    exit 1
  fi

  # Convert comma-separated list to JSON array
  IFS=',' read -ra CONTACT_IDS <<< "$2"
  CONTACT_IDS_JSON=$(printf '%s\n' "${CONTACT_IDS[@]}" | jq -R . | jq -s .)

  echo -e "${BLUE}Sending ${#CONTACT_IDS[@]} contacts to Clay...${NC}"
  echo ""

  RESPONSE=$(curl -s -X POST "${API_URL}/api/clay/send-batch" \
    -H "Content-Type: application/json" \
    -d "{
      \"contactIds\": ${CONTACT_IDS_JSON},
      \"webhookUrl\": \"${CLAY_WEBHOOK_URL}\"
    }")

  # Check if successful
  if echo "$RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Batch send successful!${NC}"
    echo ""
    echo "$RESPONSE" | jq '{
      total,
      successful,
      failed,
      results: .results[] | {contactId, success, error}
    }'
  else
    echo -e "${RED}✗ Batch send failed${NC}"
    echo "$RESPONSE" | jq .
    exit 1
  fi

  exit 0
fi

# Single contact mode
CONTACT_ID=$1

echo -e "${BLUE}Sending Contact ID ${CONTACT_ID} to Clay...${NC}"
echo ""

# Send to Clay
RESPONSE=$(curl -s -X POST "${API_URL}/api/clay/send/${CONTACT_ID}" \
  -H "Content-Type: application/json" \
  -d "{\"webhookUrl\": \"${CLAY_WEBHOOK_URL}\"}")

# Check if successful
if echo "$RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
  echo -e "${GREEN}✓ Successfully sent to Clay!${NC}"
  echo ""
  echo "$RESPONSE" | jq '{
    message,
    status,
    sent_fields
  }'

  echo ""
  echo -e "${BLUE}Data sent to Clay includes:${NC}"
  echo "$RESPONSE" | jq -r '.sent_fields[]' | sed 's/^/  - /'
else
  echo -e "${RED}✗ Failed to send to Clay${NC}"
  echo "$RESPONSE" | jq .
  exit 1
fi

echo ""
echo -e "${GREEN}Check your Clay table for the enriched data!${NC}"
