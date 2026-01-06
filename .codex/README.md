# Gemini CLI Configuration

This directory contains configuration for Google Gemini CLI used in automated PR validation.

## Files

- `config.toml` - Gemini CLI configuration
- `pr-validation-prompt.md` - Validation prompt template
- `test-local.sh` - Local testing script
- `GEMINI_SETUP.md` - Setup guide

## Configuration Details

### Model Settings

- **Model**: `gemini-2.5-flash`  
  Ensures parity with CI workflow and local scripts to avoid discrepancies.
- **Provider**: Google AI (Vertex AI)
- **Features**: Reasoning, MCP support

### Agentic Capabilities

- **Max Iterations**: 100
- **Temperature**: 0.7 (balanced creativity/consistency)
- **Code Execution**: Disabled (read-only analysis)

### MCP Server Integration

Connected to **Usable MCP** for fetching standards:
- **URL**: `https://usable.dev/api/mcp`
- **Authentication**: Bearer token from `USABLE_API_TOKEN`
- **Purpose**: Fetch latest Next.js and Flowcore Pathways standards

Gemini CLI has native MCP support, allowing it to:
- Access Usable workspace fragments
- Search for relevant standards
- Get up-to-date documentation
- Explore knowledge graphs

## Environment Variables

Required for operation:

- `GEMINI_API_KEY` - Google AI API key for Gemini models
- `USABLE_API_TOKEN` - Usable API token for MCP access

Get your Gemini API key: https://aistudio.google.com/app/apikey

## Local Testing

See `test-local.sh` for running validation locally before pushing to CI/CD.

## Why Gemini?

- ✅ Simple API key authentication (no OAuth expiration)
- ✅ Native MCP server support
- ✅ Cost-effective (free tier available)
- ✅ Advanced reasoning capabilities
- ✅ Reliable for CI/CD automation

## How It Works

1. **PR Created**: When a PR is opened/updated targeting `main`
2. **Workflow Triggers**: `.github/workflows/pr-validation.yml` runs
3. **Gemini Executes**: Runs the validation prompt with PR context
4. **Usable Queried**: MCP server at https://usable.dev/api/mcp fetches latest standards
5. **Validation Performed**: Gemini 2.5 reviews changes against standards
6. **Report Generated**: Structured markdown report with violations
7. **Comment Posted**: Report posted as PR comment
8. **Build Status**: Fails if critical violations found

### Gemini CLI Command Syntax

**✅ Correct way (stdin redirection)**:
```bash
gemini -y -m gemini-2.5-flash < prompt.txt > output.txt
```

**❌ NOT supported**:
```bash
gemini --input prompt.txt --output output.txt          # Wrong!
cat prompt.txt | gemini --yolo -m model > output.txt  # May cause errors
```

**Why `<` instead of `cat |`?**
- More reliable with Gemini CLI flag combinations
- Avoids "Unable to process file command" errors
- Standard Unix practice

See [GEMINI_CLI_USAGE.md](./GEMINI_CLI_USAGE.md) for detailed command reference.

## Validation Categories

### ❌ Critical Violations (Build Fails)
Issues that must be fixed before merge:
- **NOT using Flowcore Pathways for data operations**
- **Direct database writes in services**
- **Missing Session Pathways for user actions**
- **Missing YAML updates** (flowcore.yml, flowcore.local.yml, flowcore.local.development.yml)
- Using React Hook Form instead of TanStack Forms
- Database foreign keys instead of DrizzleORM relations
- Direct process.env access instead of T3 env validation
- Using fetch() directly instead of TanStack Query
- Next.js 15 params pattern violations
- Hardcoded colors instead of theme variables

### ⚠️ Important Issues (Should Fix)
Issues that should be addressed:
- **Incorrect Pathways usage pattern** (Session Pathways in workers)
- **Missing event contracts**
- **Bypassing event handlers**
- Missing TypeScript strict mode
- Poor error handling patterns
- Missing Swagger documentation

### ℹ️ Suggestions (Nice to Have)
Improvements for better code quality:
- Code organization improvements
- Performance optimizations
- Better naming conventions
- Additional TypeScript type safety

## Getting Started

1. **Install Gemini CLI**:
   ```bash
   npm install -g @google/gemini-cli
   ```

2. **Get API Key**: https://aistudio.google.com/app/apikey

3. **Set Environment Variables**:
   ```bash
   export GEMINI_API_KEY="your-key"
   export USABLE_API_TOKEN="your-token"
   ```

4. **Test Locally**:
   ```bash
   chmod +x .codex/test-local.sh
   ./.codex/test-local.sh
   ```

## Documentation

- [Gemini Setup Guide](.codex/GEMINI_SETUP.md) - Detailed setup instructions
- [PR Validation](../docs/PR_VALIDATION.md) - How validation works
- [Flowcore YAML Checklist](.codex/FLOWCORE_YAML_CHECKLIST.md) - YAML update requirements

## Support

- Gemini CLI: https://github.com/google-gemini/gemini-cli
- Gemini API: https://ai.google.dev/docs
- Get API Key: https://aistudio.google.com/app/apikey
- Usable: https://usable.dev
