#!/bin/bash
# Run new migrations on Render Postgres database

set -e

# Get the Render service ID
SERVICE_ID="srv-ctb9m1jt01uo73de52a0"
API_TOKEN="rnd_ZOqli1NyMPjjdUmsIoNXcBEd8vhm"

echo "🔄 Triggering deployment to run migrations..."

# Trigger a manual deploy via Render API
curl -X POST "https://api.render.com/v1/services/${SERVICE_ID}/deploys" \
  -H "Authorization: Bearer ${API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"clearCache":"do_not_clear"}'

echo ""
echo "✅ Deployment triggered! Migrations will run automatically on startup."
echo "📊 Check deployment status at: https://dashboard.render.com/web/${SERVICE_ID}"
