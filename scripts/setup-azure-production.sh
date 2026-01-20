#!/bin/bash

# Script to provision Azure infrastructure for Graphable production deployment
# This creates:
# 1. Azure Key Vault (if it doesn't exist)
# 2. Service Principal for Kubernetes pods to access Key Vault
# 3. RBAC permissions for the Service Principal

set -e

# Configuration
VAULT_NAME="graphable-prod-kv"
RESOURCE_GROUP="Usable"
SUBSCRIPTION_ID="4f94ba05-20f1-47c1-9011-b3f11c31a014"
LOCATION="westeurope"  # Update this if your resource group is in a different region
SERVICE_PRINCIPAL_NAME="graphable-prod-sp"

echo "🚀 Setting up Azure infrastructure for Graphable production deployment"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Configuration:"
echo "  Subscription:     $SUBSCRIPTION_ID"
echo "  Resource Group:   $RESOURCE_GROUP"
echo "  Location:         $LOCATION"
echo "  Key Vault:        $VAULT_NAME"
echo "  Service Principal: $SERVICE_PRINCIPAL_NAME"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
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
echo "📋 Setting Azure subscription..."
az account set --subscription "$SUBSCRIPTION_ID"
CURRENT_SUB=$(az account show --query id -o tsv)
if [ "$CURRENT_SUB" != "$SUBSCRIPTION_ID" ]; then
    echo "❌ Failed to set subscription"
    exit 1
fi
echo "✅ Subscription set to Flowcore ($SUBSCRIPTION_ID)"
echo ""

# Check if resource group exists
echo "📁 Checking resource group..."
if az group show --name "$RESOURCE_GROUP" &> /dev/null; then
    echo "✅ Resource group '$RESOURCE_GROUP' exists"
    # Get the actual location of the resource group
    LOCATION=$(az group show --name "$RESOURCE_GROUP" --query location -o tsv)
    echo "   Location: $LOCATION"
else
    echo "📝 Creating resource group '$RESOURCE_GROUP' in $LOCATION..."
    az group create --name "$RESOURCE_GROUP" --location "$LOCATION" --output none
    echo "✅ Resource group created"
fi
echo ""

# Check if Key Vault exists
echo "🔐 Checking Azure Key Vault..."
if az keyvault show --name "$VAULT_NAME" --resource-group "$RESOURCE_GROUP" &> /dev/null; then
    echo "✅ Key Vault '$VAULT_NAME' already exists"
    VAULT_URL=$(az keyvault show --name "$VAULT_NAME" --resource-group "$RESOURCE_GROUP" --query properties.vaultUri -o tsv)
    echo "   Vault URL: $VAULT_URL"
else
    echo "📝 Creating Key Vault '$VAULT_NAME'..."
    az keyvault create \
        --name "$VAULT_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --location "$LOCATION" \
        --enable-rbac-authorization true \
        --output none
    
    VAULT_URL=$(az keyvault show --name "$VAULT_NAME" --resource-group "$RESOURCE_GROUP" --query properties.vaultUri -o tsv)
    echo "✅ Key Vault created"
    echo "   Vault URL: $VAULT_URL"
fi
echo ""

# Get Key Vault resource ID for RBAC
KEYVAULT_ID=$(az keyvault show --name "$VAULT_NAME" --resource-group "$RESOURCE_GROUP" --query id -o tsv)

# Check if service principal exists
echo "👤 Checking service principal..."
SP_APP_ID=$(az ad sp list --display-name "$SERVICE_PRINCIPAL_NAME" --query "[0].appId" -o tsv 2>/dev/null || echo "")

if [ -z "$SP_APP_ID" ] || [ "$SP_APP_ID" == "null" ]; then
    echo "📝 Creating service principal: $SERVICE_PRINCIPAL_NAME"
    SP_OUTPUT=$(az ad sp create-for-rbac --name "$SERVICE_PRINCIPAL_NAME" --skip-assignment --output json)
    SP_APP_ID=$(echo "$SP_OUTPUT" | jq -r '.appId')
    SP_PASSWORD=$(echo "$SP_OUTPUT" | jq -r '.password')
    SP_TENANT=$(echo "$SP_OUTPUT" | jq -r '.tenant')
    
    echo "✅ Service principal created"
    echo "   App ID: $SP_APP_ID"
else
    echo "✅ Service principal already exists: $SP_APP_ID"
    
    # Reset password to get a fresh credential
    echo "🔑 Resetting service principal password..."
    SP_OUTPUT=$(az ad sp credential reset --id "$SP_APP_ID" --output json)
    SP_PASSWORD=$(echo "$SP_OUTPUT" | jq -r '.password')
    SP_TENANT=$(az account show --query tenantId -o tsv)
    
    echo "✅ Password reset"
fi
echo ""

# Get service principal object ID
SP_OBJECT_ID=$(az ad sp show --id "$SP_APP_ID" --query id -o tsv)

# Grant Key Vault Secrets Officer role on the Key Vault
echo "🔐 Configuring Key Vault RBAC permissions..."
EXISTING_ROLE=$(az role assignment list \
    --assignee "$SP_OBJECT_ID" \
    --scope "$KEYVAULT_ID" \
    --query "[?roleDefinitionName=='Key Vault Secrets Officer'].id" -o tsv 2>/dev/null || echo "")

if [ -z "$EXISTING_ROLE" ]; then
    echo "📝 Granting 'Key Vault Secrets Officer' role..."
    az role assignment create \
        --role "Key Vault Secrets Officer" \
        --assignee "$SP_OBJECT_ID" \
        --scope "$KEYVAULT_ID" \
        --output none
    
    echo "✅ Key Vault Secrets Officer role granted"
else
    echo "✅ Key Vault Secrets Officer role already granted"
fi
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Azure infrastructure setup complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Kubernetes deployment configuration:"
echo ""
echo "Add these environment variables to your flowcore.deployment.json:"
echo ""
echo "AZURE_KEY_VAULT_URL:"
echo "  value: \"$VAULT_URL\""
echo "AZURE_CLIENT_ID:"
echo "  value: \"$SP_APP_ID\""
echo "AZURE_CLIENT_SECRET:"
echo "  valueFrom:"
echo "    secretKeyRef:"
echo "      name: graphable-credentials"
echo "      key: azure-client-secret"
echo "AZURE_TENANT_ID:"
echo "  value: \"$SP_TENANT\""
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🔒 Create the Kubernetes secret with this command:"
echo ""
echo "kubectl create secret generic graphable-credentials \\"
echo "  --from-literal=azure-client-secret='$SP_PASSWORD' \\"
echo "  --namespace=<your-namespace>"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⚠️  IMPORTANT SECURITY NOTES:"
echo "  1. Save the client secret securely - it won't be shown again"
echo "  2. The credentials above are for PRODUCTION - do not commit them to git"
echo "  3. Create the Kubernetes secret in your cluster before deploying"
echo "  4. Consider using Azure AD Workload Identity for enhanced security (see docs)"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
