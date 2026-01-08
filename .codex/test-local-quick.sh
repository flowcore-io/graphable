#!/bin/bash
# Quick local test script - 1:1 match with GitHub Actions workflow
set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 Quick PR Validation Test (Matches GitHub Actions)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Load .env file
if [ -f .env ]; then
  echo "📄 Loading .env file..."
  # Simple and reliable: source the .env file with auto-export
  set -a
  source .env
  set +a
  echo "✅ .env loaded"
else
  echo "❌ .env file not found!"
  echo "   Create .env with:"
  echo "   # Option A: base64 string (recommended for CI parity)"
  echo "   GEMINI_SERVICE_ACCOUNT_KEY=<base64-encoded-service-account-json>"
  echo "   # Option B: local file path (convenient locally)"
  echo "   # GEMINI_SERVICE_ACCOUNT_KEY=/absolute/path/to/service-account.json"
  echo "   USABLE_API_TOKEN=<your-token>"
  exit 1
fi

# Validate required env vars
if [ -z "$GEMINI_SERVICE_ACCOUNT_KEY" ]; then
  echo "❌ GEMINI_SERVICE_ACCOUNT_KEY not set in .env"
  echo ""
  echo "Add one of the following to your .env file:"
  echo "  - GEMINI_SERVICE_ACCOUNT_KEY=<base64-encoded-service-account-json>"
  echo "    Create with: cat key.json | base64"
  echo "  - or GEMINI_SERVICE_ACCOUNT_KEY=/absolute/path/to/service-account.json"
  exit 1
fi

# Support both USABLE_API_TOKEN and USABLE_API_KEY
if [ -z "$USABLE_API_TOKEN" ]; then
  if [ -n "$USABLE_API_KEY" ]; then
    export USABLE_API_TOKEN="$USABLE_API_KEY"
    echo "📝 Using USABLE_API_KEY as USABLE_API_TOKEN"
  else
    echo "❌ USABLE_API_TOKEN or USABLE_API_KEY not set in .env"
    exit 1
  fi
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 1: Setup Gemini Authentication"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Support two input modes: file path or base64 string
if [ -f "$GEMINI_SERVICE_ACCOUNT_KEY" ]; then
  echo "📁 Using service account file: $GEMINI_SERVICE_ACCOUNT_KEY"
  export GOOGLE_APPLICATION_CREDENTIALS="$GEMINI_SERVICE_ACCOUNT_KEY"
else
  echo "🔐 Decoding base64 service account into /tmp/gemini-service-account.json"
  echo "$GEMINI_SERVICE_ACCOUNT_KEY" | base64 -d > /tmp/gemini-service-account.json
  export GOOGLE_APPLICATION_CREDENTIALS=/tmp/gemini-service-account.json
fi

# Tell Gemini CLI to use Vertex AI with the service account
export GOOGLE_GENAI_USE_VERTEXAI=true

# Verify the key file is valid JSON
if ! jq empty "$GOOGLE_APPLICATION_CREDENTIALS" 2>/dev/null; then
  echo "❌ Invalid service account key (not JSON)."
  exit 1
fi

# Extract project ID from service account JSON
export GOOGLE_CLOUD_PROJECT=$(jq -r '.project_id // .quota_project_id // .project // empty' "$GOOGLE_APPLICATION_CREDENTIALS")

# Set default location (us-central1 is common for Vertex AI)
export GOOGLE_CLOUD_LOCATION="${GOOGLE_CLOUD_LOCATION:-us-central1}"

echo "✅ Gemini service account configured (Vertex AI mode)"
echo "   Project: $GOOGLE_CLOUD_PROJECT"
echo "   Location: $GOOGLE_CLOUD_LOCATION"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 2: Prepare PR Context"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Get current branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
BASE_BRANCH="main"

# Prepare context variables
export PR_TITLE="Local test: $CURRENT_BRANCH"
export PR_DESCRIPTION="Testing PR validation locally"
export BASE_BRANCH="$BASE_BRANCH"
export HEAD_BRANCH="$CURRENT_BRANCH"
export PR_NUMBER="local-test"
export PR_URL="local-test"

echo "Branch: $CURRENT_BRANCH → $BASE_BRANCH"
echo "✅ Context prepared"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 3: Run Standards Validation with Gemini"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "# Runs the same model and flags as CI to ensure parity"

# Check if Gemini CLI is installed
if ! command -v gemini &> /dev/null; then
  echo "❌ Gemini CLI not installed!"
  echo ""
  echo "Install with:"
  echo "  npm install -g @google/gemini-cli"
  echo ""
  echo "Or with yarn:"
  echo "  yarn global add @google/gemini-cli"
  exit 1
fi

# Replace placeholders in prompt
PROMPT_CONTENT=$(cat .codex/pr-validation-prompt.md)
PROMPT_CONTENT="${PROMPT_CONTENT//\{\{PR_CONTEXT\}\}/PR #${PR_NUMBER}: ${PR_TITLE}
Description: ${PR_DESCRIPTION}
URL: ${PR_URL}}"
PROMPT_CONTENT="${PROMPT_CONTENT//\{\{BASE_BRANCH\}\}/${BASE_BRANCH}}"
PROMPT_CONTENT="${PROMPT_CONTENT//\{\{HEAD_BRANCH\}\}/${HEAD_BRANCH}}"

# Save prompt to temp file
echo "$PROMPT_CONTENT" > /tmp/validation-prompt.txt
echo "✅ Prompt prepared (${#PROMPT_CONTENT} chars)"

# Run Gemini with the prompt via stdin, capture output
echo ""
echo "🚀 Running Gemini validation..."
echo "   Model: gemini-2.5-flash"
echo "   Flags: -y (auto-approve)"
echo "   Mode: Vertex AI (service account)"
echo ""

gemini -y -m gemini-2.5-flash < /tmp/validation-prompt.txt > /tmp/validation-full-output.md 2>&1 || true

# Check for critical authentication errors (ignore MCP schema errors)
if grep -qi "ApiError.*401\|ApiError.*403\|authentication failed\|unauthorized.*api" /tmp/validation-full-output.md; then
  echo "❌ Gemini authentication failed during validation!"
  echo "Please ensure GEMINI_SERVICE_ACCOUNT_KEY secret is set correctly"
  cat /tmp/validation-full-output.md
  rm -f /tmp/gemini-service-account.json
  exit 1
fi

echo "✅ Gemini execution complete"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 4: Extract Validation Report"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Extract only the AI's response (validation report), not the prompt
awk '/^# PR Validation Report/,0' /tmp/validation-full-output.md > /tmp/validation-report.md

# If the above didn't work, try alternative patterns
if [ ! -s /tmp/validation-report.md ] || [ $(wc -l < /tmp/validation-report.md) -lt 10 ]; then
  awk '/^## Summary/,0' /tmp/validation-full-output.md > /tmp/validation-report.md
fi

# If still empty, use the full output
if [ ! -s /tmp/validation-report.md ]; then
  cp /tmp/validation-full-output.md /tmp/validation-report.md
fi

echo "✅ Report extracted"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 5: Analyze Results"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if validation passed
if grep -q "Status.*FAIL" /tmp/validation-report.md; then
  VALIDATION_STATUS="failed"
  VALIDATION_PASSED="false"
  echo "❌ Validation Status: FAILED"
else
  VALIDATION_STATUS="passed"
  VALIDATION_PASSED="true"
  echo "✅ Validation Status: PASSED"
fi

# Extract critical issues count
CRITICAL_COUNT=$(grep -c "^- \[ \] \*\*" /tmp/validation-report.md 2>/dev/null || echo "0")
echo "⚠️  Critical Issues: $CRITICAL_COUNT"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 6: Cleanup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Cleanup temp file if we created it
if [ "$GOOGLE_APPLICATION_CREDENTIALS" = "/tmp/gemini-service-account.json" ]; then
  rm -f /tmp/gemini-service-account.json
  echo "🧹 Removed temporary service account file"
else
  echo "✅ No temporary files to clean up"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 VALIDATION REPORT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cat /tmp/validation-report.md

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📁 Output Files:"
echo "   Full output: /tmp/validation-full-output.md"
echo "   Report only: /tmp/validation-report.md"
echo "   Prompt: /tmp/validation-prompt.txt"
echo ""
echo "Status: $VALIDATION_STATUS"
echo "Critical Issues: $CRITICAL_COUNT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ "$VALIDATION_PASSED" = "false" ]; then
  exit 1
fi

