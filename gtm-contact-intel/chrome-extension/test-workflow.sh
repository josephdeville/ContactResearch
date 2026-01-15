#!/bin/bash
# Complete workflow for Chrome extension

echo "===== GTM Contact Intelligence - Chrome Extension Workflow ====="
echo ""

# Step 1: Start the API server
echo "Step 1: Starting API server..."
cd /home/user/ContactResearch/gtm-contact-intel
npm start &
sleep 3

# Step 2: Verify server is running
echo ""
echo "Step 2: Verifying API server..."
curl -s http://localhost:3000/health && echo " ✓ API server is running"

# Step 3: Check existing contacts
echo ""
echo "Step 3: Checking existing contacts..."
psql -U postgres -d gtm_intel -c "SELECT id, full_name, linkedin_url FROM contacts;"

echo ""
echo "===== Next Steps ====="
echo "1. Open Chrome and go to: chrome://extensions/"
echo "2. Load unpacked extension from: /home/user/ContactResearch/gtm-contact-intel/chrome-extension/"
echo "3. Navigate to: https://www.linkedin.com/in/jchaydon"
echo "4. Click GTM extension icon"
echo "5. Click 'Extract from Current Page'"
echo "6. Enter Contact ID: 1 (for JC Haydon)"
echo "7. Click 'Submit to API'"
echo ""
echo "After submission, view results:"
echo "  curl http://localhost:3000/api/contacts/1 | jq ."
echo "  curl http://localhost:3000/api/signals/1 | jq ."
echo "  curl http://localhost:3000/api/playbook/1 | jq ."
