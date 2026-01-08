#!/bin/bash
# Local PR Validation Test Script

set -e  # Exit on error

echo "🧪 Testing PR Validation Locally with Gemini CLI"
echo "================================================="

# Check required environment variables
if [ -z "$GEMINI_SERVICE_ACCOUNT_KEY" ]; then
  echo "❌ Error: GEMINI_SERVICE_ACCOUNT_KEY not set"
  echo "   This should be a base64-encoded service account key file."
  echo ""
  echo "   To create and encode:"
  echo "     1. Create service account in Google Cloud Console"
  echo "     2. Download the JSON key file"
  echo "     3. Encode it: cat key.json | base64 > key.base64"
  echo "     4. Set env: export GEMINI_SERVICE_ACCOUNT_KEY=\$(cat key.base64)"
  echo ""
  echo "   See .codex/SERVICE_ACCOUNT_SETUP.md for detailed instructions"
  exit 1
fi

if [ -z "$USABLE_API_TOKEN" ]; then
  echo "❌ Error: USABLE_API_TOKEN not set"
  echo "   Run: export USABLE_API_TOKEN='your-token'"
  exit 1
fi

echo "✅ Environment variables set"

# Setup Gemini authentication
echo "🔑 Setting up Gemini authentication..."
echo "$GEMINI_SERVICE_ACCOUNT_KEY" | base64 -d > /tmp/gemini-service-account.json

# Verify the key file is valid JSON
if ! jq empty /tmp/gemini-service-account.json 2>/dev/null; then
  echo "❌ Invalid service account key file!"
  rm -f /tmp/gemini-service-account.json
  exit 1
fi

# Set Google Application Credentials
export GOOGLE_APPLICATION_CREDENTIALS=/tmp/gemini-service-account.json
echo "✅ Gemini service account configured"

# Check if Gemini CLI is installed
if ! command -v gemini &> /dev/null; then
  echo "❌ Error: Gemini CLI not installed"
  echo "   Run: npm install -g @google/gemini-cli"
  exit 1
fi

echo "✅ Gemini CLI installed: $(gemini --version)"

# Setup git
echo ""
echo "📝 Setting up git for validation..."
git fetch origin main 2>/dev/null || git fetch main 2>/dev/null || true

CURRENT_BRANCH=$(git branch --show-current)
echo "   Current branch: $CURRENT_BRANCH"
echo "   Base branch: main"

# Check if there are changes
DIFF_SIZE=$(git diff --name-only main 2>/dev/null | wc -l | tr -d ' ')
if [ "$DIFF_SIZE" -eq 0 ]; then
  echo "⚠️  Warning: No changes detected against main branch"
  echo "   The AI will analyze the current state"
fi

echo "✅ Git ready - AI will fetch changes via git commands"

# Prepare the prompt with context
PROMPT_CONTENT=$(cat .codex/pr-validation-prompt.md)
PR_CONTEXT="Local Test PR from branch: ${CURRENT_BRANCH}
Testing PR validation locally with agentic loop"

# Replace placeholders
PROMPT_CONTENT="${PROMPT_CONTENT//\{\{PR_CONTEXT\}\}/${PR_CONTEXT}}"
PROMPT_CONTENT="${PROMPT_CONTENT//\{\{BASE_BRANCH\}\}/main}"
PROMPT_CONTENT="${PROMPT_CONTENT//\{\{HEAD_BRANCH\}\}/${CURRENT_BRANCH}}"

# Run validation
echo ""
echo "🚀 Running Gemini validation..."
echo "   Model: gemini-2.5-flash"
echo "   Agentic workflow: Multi-step reasoning"
echo "   Remote MCP: https://usable.dev/api/mcp"
echo "   Mode: Vertex AI (service account)"
echo "   The AI will:"
echo "     - Fetch standards from Usable via MCP"
echo "     - Get PR diff using git commands"
echo "     - Read changed files"
echo "     - Validate against Flowcore standards"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Save prompt to file
echo "$PROMPT_CONTENT" > /tmp/validation-prompt.txt

# Run Gemini CLI via stdin redirection
gemini -y -m gemini-2.5-flash < /tmp/validation-prompt.txt > /tmp/validation-full-output.txt 2>&1 || true

VALIDATION_EXIT_CODE=$?

# Extract only the validation report, not the prompt
if grep -q "^# PR Validation Report" /tmp/validation-full-output.txt; then
  echo ""
  echo "📄 Extracting validation report (removing prompt)..."
  awk '/^# PR Validation Report/,0' /tmp/validation-full-output.txt > /tmp/validation-report.txt
  cat /tmp/validation-report.txt
else
  # If no clear report header, show everything (might include prompt)
  cat /tmp/validation-full-output.txt
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ $VALIDATION_EXIT_CODE -eq 0 ]; then
  echo "✅ Validation complete!"
else
  echo "⚠️  Validation completed with warnings"
fi

echo ""
echo "💡 What happened:"
echo "   - Gemini fetched standards from Usable using MCP"
echo "   - Gemini ran git commands to analyze your changes"
echo "   - Gemini read changed files for full context"
echo "   - Gemini validated against Flowcore Pathways standards"
echo ""
echo "💡 Review the output above for:"
echo "   - Critical violations (❌) - must fix"
echo "   - Important issues (⚠️) - should fix"
echo "   - Suggestions (ℹ️) - nice to have"
echo ""
echo "🌟 Powered by Google Gemini + Usable MCP"
echo ""

# Cleanup
echo "🧹 Cleaning up temporary files..."
rm -f /tmp/gemini-service-account.json
echo "✅ Temporary service account key file removed"

exit $VALIDATION_EXIT_CODE

