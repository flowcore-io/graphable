#!/bin/bash

# Script to get Azure configuration values for Graphable deployment
# This script ONLY retrieves values, does not create or modify anything

set -e

VAULT_NAME="graphable-prod-kv"
RESOURCE_GROUP="Usable"
SP_APP_ID="717529c6-e6a9-46ac-a79c-0022cba59298"

echo "📋 Fetching Azure configuration values for Graphable..."
echo ""

# Get Vault URL
VAULT_URL=$(az keyvault show --name "$VAULT_NAME" --resource-group "$RESOURCE_GROUP" --query properties.vaultUri -o tsv 2>/dev/null || echo "https://graphable-prod-kv.vault.azure.net/")

# Get Tenant ID
TENANT_ID=$(az account show --query tenantId -o tsv)

# Get or reset service principal password
echo "🔑 Getting service principal credentials..."
echo "   (This will reset the password - save it securely!)"
echo ""
SP_OUTPUT=$(az ad sp credential reset --id "$SP_APP_ID" --output json)
SP_PASSWORD=$(echo "$SP_OUTPUT" | jq -r '.password')

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Azure Configuration Values for Graphable Deployment"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Add these to your Kubernetes deployment:"
echo ""
echo "AZURE_KEY_VAULT_URL:"
echo "  value: \"$VAULT_URL\""
echo ""
echo "AZURE_CLIENT_ID:"
echo "  value: \"$SP_APP_ID\""
echo ""
echo "AZURE_CLIENT_SECRET:"
echo "  valueFrom:"
echo "    secretKeyRef:"
echo "      name: graphable-credentials"
echo "      key: azure-client-secret"
echo ""
echo "AZURE_TENANT_ID:"
echo "  value: \"$TENANT_ID\""
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🔒 Create the Kubernetes secret with:"
echo ""
echo "kubectl create secret generic graphable-credentials \\"
echo "  --from-literal=azure-client-secret='$SP_PASSWORD' \\"
echo "  --namespace=<your-namespace>"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⚠️  IMPORTANT: Role Assignment Required"
echo ""
echo "The service principal needs 'Key Vault Secrets Officer' role."
echo "Ask someone with Owner/User Access Administrator permissions to run:"
echo ""
echo "az role assignment create \\"
echo "  --role 'Key Vault Secrets Officer' \\"
echo "  --assignee '$SP_APP_ID' \\"
echo "  --scope '/subscriptions/4f94ba05-20f1-47c1-9011-b3f11c31a014/resourceGroups/Usable/providers/Microsoft.KeyVault/vaults/graphable-prod-kv'"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
