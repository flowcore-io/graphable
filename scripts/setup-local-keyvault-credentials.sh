#!/bin/bash

# Script to generate local development credentials for Azure Key Vault
# This creates a service principal with access to the Graphable Key Vault

set -e

# Configuration
VAULT_NAME="graphable-kv-49711d"
RESOURCE_GROUP="Usable"
SUBSCRIPTION_ID="4f94ba05-20f1-47c1-9011-b3f11c31a014"
SERVICE_PRINCIPAL_NAME="graphable-dev-sp"
KEYVAULT_SCOPE="/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RESOURCE_GROUP}/providers/Microsoft.KeyVault/vaults/${VAULT_NAME}"

echo "🔐 Setting up local Azure Key Vault credentials for Graphable"
echo ""

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    echo "❌ Azure CLI is not installed. Please install it first:"
    echo "   https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
    exit 1
fi

# Check if logged in
if ! az account show &> /dev/null; then
    echo "❌ Not logged in to Azure. Please run: az login"
    exit 1
fi

# Set subscription
echo "📋 Setting subscription..."
az account set --subscription "$SUBSCRIPTION_ID"
CURRENT_SUB=$(az account show --query id -o tsv)
if [ "$CURRENT_SUB" != "$SUBSCRIPTION_ID" ]; then
    echo "❌ Failed to set subscription"
    exit 1
fi
echo "✅ Subscription set to Flowcore"

# Check if service principal already exists
echo ""
echo "🔍 Checking for existing service principal..."
SP_APP_ID=$(az ad sp list --display-name "$SERVICE_PRINCIPAL_NAME" --query "[0].appId" -o tsv 2>/dev/null || echo "")

if [ -z "$SP_APP_ID" ] || [ "$SP_APP_ID" == "null" ]; then
    echo "📝 Creating new service principal: $SERVICE_PRINCIPAL_NAME"
    SP_OUTPUT=$(az ad sp create-for-rbac --name "$SERVICE_PRINCIPAL_NAME" --skip-assignment --output json)
    SP_APP_ID=$(echo "$SP_OUTPUT" | jq -r '.appId')
    SP_PASSWORD=$(echo "$SP_OUTPUT" | jq -r '.password')
    SP_TENANT=$(echo "$SP_OUTPUT" | jq -r '.tenant')
    
    echo "✅ Service principal created"
    echo "   App ID: $SP_APP_ID"
else
    echo "✅ Service principal already exists: $SP_APP_ID"
    
    # Check if we need to create/reset password
    echo "🔑 Resetting service principal password..."
    SP_OUTPUT=$(az ad sp credential reset --id "$SP_APP_ID" --output json)
    SP_PASSWORD=$(echo "$SP_OUTPUT" | jq -r '.password')
    SP_TENANT=$(az account show --query tenantId -o tsv)
    
    echo "✅ Password reset"
fi

# Get service principal object ID
SP_OBJECT_ID=$(az ad sp show --id "$SP_APP_ID" --query id -o tsv)

# Grant Key Vault Secrets Officer role (needed to set secrets)
echo ""
echo "🔐 Granting Key Vault access..."
EXISTING_ROLE=$(az role assignment list \
    --assignee "$SP_OBJECT_ID" \
    --scope "$KEYVAULT_SCOPE" \
    --query "[?roleDefinitionName=='Key Vault Secrets Officer'].id" -o tsv 2>/dev/null || echo "")

if [ -z "$EXISTING_ROLE" ]; then
    az role assignment create \
        --role "Key Vault Secrets Officer" \
        --assignee "$SP_OBJECT_ID" \
        --scope "$KEYVAULT_SCOPE" \
        --output none
    
    echo "✅ Key Vault Secrets Officer role granted (can read and write secrets)"
else
    echo "✅ Key Vault Secrets Officer role already granted"
fi

# Get Key Vault URL
VAULT_URL=$(az keyvault show --name "$VAULT_NAME" --resource-group "$RESOURCE_GROUP" --query properties.vaultUri -o tsv)

# Output credentials
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Setup complete! Add these to your .env file:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "# Azure Key Vault Configuration (Local Development)"
echo "AZURE_KEY_VAULT_URL=$VAULT_URL"
echo "AZURE_CLIENT_ID=$SP_APP_ID"
echo "AZURE_CLIENT_SECRET=$SP_PASSWORD"
echo "AZURE_TENANT_ID=$SP_TENANT"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "💡 Tip: You can test access with:"
echo "   az keyvault secret set --vault-name $VAULT_NAME --name test-secret --value test-value"
echo ""
