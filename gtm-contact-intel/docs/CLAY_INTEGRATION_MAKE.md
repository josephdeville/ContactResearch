# Clay Integration via Make.com

Since `api.clay.com` is not on the Anthropic proxy whitelist, we use Make.com as a webhook forwarder.

## Setup Steps

### 1. Create Make.com Scenario

1. Go to https://www.make.com and sign up/login
2. Create a new Scenario
3. Add a **Webhooks** module as the trigger:
   - Choose "Custom Webhook"
   - Create a new webhook
   - Copy the webhook URL (looks like: `https://hook.us1.make.com/...`)

### 2. Add HTTP Module to Forward to Clay

1. Add an **HTTP** module after the webhook
2. Configure it:
   - **URL**: Your Clay webhook URL
     ```
     https://api.clay.com/v3/sources/webhook/pull-in-data-from-a-webhook-fa59bcce-da9c-40f0-9e7d-d680d84f95f7
     ```
   - **Method**: POST
   - **Headers**:
     - Content-Type: `application/json`
   - **Body**: Select "Raw" and map all the data from step 1
     - Or simply use: `{{1.data}}` to forward everything

3. Save and activate the scenario

### 3. Update Your Send Script

Update `send-to-clay.sh` to use the Make.com webhook URL instead:

```bash
MAKE_WEBHOOK_URL="https://hook.us1.make.com/YOUR_WEBHOOK_ID"
```

### 4. Test the Integration

```bash
./send-to-clay.sh 1
```

## How It Works

```
GTM Intelligence → Make.com Webhook → Clay Webhook
  (container)      (forwarder)         (destination)
```

1. Your container sends data to Make.com (no proxy restriction)
2. Make.com receives the data
3. Make.com immediately forwards to Clay
4. Clay receives and processes the data

## Verification

- Check Make.com execution history to see if data was received
- Check Clay table to verify data populated correctly
- All 30 fields should appear in your Clay table

## Troubleshooting

**If Make.com webhook fails:**
- Check if make.com/hook.make.com is accessible from container
- Try hook.integromat.com (old domain) if make.com fails
- Consider using Zapier as alternative

**If Clay receives empty data:**
- Check Make.com HTTP module body configuration
- Ensure you're forwarding the entire payload
- Verify Clay webhook URL is correct
