#!/bin/bash

echo "🔄 Refreshing Azure credentials..."
echo ""

# Clear the Azure CLI token cache
echo "1️⃣ Clearing Azure CLI token cache..."
rm -rf ~/.azure/accessTokens.json 2>/dev/null
rm -rf ~/.azure/azureProfile.json 2>/dev/null

echo "✅ Cache cleared"
echo ""

# Re-login to get fresh tokens
echo "2️⃣ Re-authenticating (browser will open)..."
az login --scope https://management.azure.com//.default

echo ""
echo "✅ Credentials refreshed!"
echo ""
echo "Now try your command again. If it still fails, permissions might still be propagating (can take 5-15 minutes)."
echo ""
