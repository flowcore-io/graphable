# Azure Infrastructure Setup for Graphable Production

This guide covers setting up the Azure infrastructure required for Graphable to run in production.

## Overview

Graphable uses **Azure Key Vault** to securely store data source connection strings and secrets. The application needs authentication to access the Key Vault.

## Prerequisites

1. **Azure CLI** installed and logged in (`az login`)
2. **Access to Flowcore Azure subscription** (subscription ID: `4f94ba05-20f1-47c1-9011-b3f11c31a014`)
3. **jq** installed for JSON parsing (`brew install jq` on macOS)
4. **Permissions** to create resources in the `Usable` resource group

## Quick Setup (Production)

Run the automated setup script:

```bash
cd scripts
./setup-azure-production.sh
```

This script will:

1. ✅ Verify Azure CLI is installed and you're logged in
2. ✅ Set the correct Azure subscription
3. ✅ Check/create the resource group `Usable`
4. ✅ Create Azure Key Vault `graphable-kv-49711d` (if it doesn't exist)
5. ✅ Create a Service Principal `graphable-prod-sp` for authentication
6. ✅ Grant the Service Principal `Key Vault Secrets Officer` role
7. ✅ Output the configuration values you need for deployment

## What Gets Created

### 1. Azure Key Vault

- **Name**: `graphable-kv-49711d`
- **Resource Group**: `Usable`
- **Location**: `westeurope` (or your resource group's location)
- **RBAC Authorization**: Enabled (using Azure RBAC instead of access policies)

### 2. Service Principal

- **Name**: `graphable-prod-sp`
- **Purpose**: Allows Kubernetes pods to authenticate to Azure Key Vault
- **Role**: `Key Vault Secrets Officer` (can read and write secrets)

## Deployment Configuration

After running the setup script, you'll get output like this:

```yaml
AZURE_KEY_VAULT_URL:
  value: "https://graphable-kv-49711d.vault.azure.net/"
AZURE_CLIENT_ID:
  value: "<app-id-from-script>"
AZURE_CLIENT_SECRET:
  valueFrom:
    secretKeyRef:
      name: graphable-credentials
      key: azure-client-secret
AZURE_TENANT_ID:
  value: "<tenant-id-from-script>"
```

### Creating the Kubernetes Secret

Before deploying, create the Kubernetes secret with the client secret:

```bash
# The script will output the exact command with your values
kubectl create secret generic graphable-credentials \
  --from-literal=azure-client-secret='<password-from-script>' \
  --namespace=<your-namespace>
```

## Authentication Methods

### Current Approach: Service Principal

**What it is**: A service account with credentials (client ID + client secret) that the application uses to authenticate.

**Pros**:
- ✅ Simple to set up
- ✅ Works immediately
- ✅ No additional AKS configuration needed

**Cons**:
- ⚠️ Requires managing credentials (rotation, storage)
- ⚠️ Secret stored in Kubernetes (though as a K8s secret)

### Future Improvement: Azure AD Workload Identity (Recommended)

**What it is**: Federation between Kubernetes Service Accounts and Azure Managed Identities - no credentials needed.

**Pros**:
- ✅ No credentials to manage
- ✅ Azure handles identity automatically
- ✅ Better security posture
- ✅ Industry best practice for AKS

**Cons**:
- ⚠️ Requires AKS cluster configuration
- ⚠️ More complex initial setup

**To implement** (future enhancement):
1. Enable OIDC issuer on your AKS cluster
2. Create a User-Assigned Managed Identity
3. Create federated credential linking Kubernetes SA to Managed Identity
4. Update deployment to use the service account
5. Remove AZURE_CLIENT_SECRET (no longer needed)

Reference: [Azure AD Workload Identity Documentation](https://azure.github.io/azure-workload-identity/)

## How Graphable Uses Key Vault

1. **Data Source Secrets**: When users add a PostgreSQL data source with a connection string, the connection string is stored in Key Vault
2. **Secret References**: Only a reference (vault URL + secret name) is stored in the control plane database
3. **Runtime Access**: When executing queries, Graphable fetches the connection string from Key Vault using the reference
4. **Caching**: Secrets are cached in memory for 5 minutes to reduce Azure API calls

## Security Best Practices

✅ **DO**:
- Rotate service principal credentials regularly
- Use Kubernetes secrets for sensitive values
- Monitor Key Vault access logs
- Restrict Key Vault network access if possible
- Plan migration to Workload Identity

❌ **DON'T**:
- Commit credentials to git
- Use the same credentials for dev and production
- Share production credentials in chat/email
- Store secrets in plain environment variables

## Troubleshooting

### "Key Vault not found" error at runtime

Check that `AZURE_KEY_VAULT_URL` is set correctly in your deployment configuration.

### "Authorization failed" when accessing secrets

1. Verify the service principal has the `Key Vault Secrets Officer` role
2. Check that the Kubernetes secret `graphable-credentials` exists
3. Verify the client secret hasn't expired

### "DefaultAzureCredential failed" error

The application tries multiple authentication methods in order:
1. Environment variables (client ID + secret)
2. Managed Identity
3. Azure CLI

Ensure `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, and `AZURE_TENANT_ID` are set.

## Verifying the Setup

Test that everything works:

```bash
# Set environment variables from script output
export AZURE_KEY_VAULT_URL="https://graphable-kv-49711d.vault.azure.net/"
export AZURE_CLIENT_ID="<from-script>"
export AZURE_CLIENT_SECRET="<from-script>"
export AZURE_TENANT_ID="<from-script>"

# Try creating a test secret
az keyvault secret set \
  --vault-name graphable-kv-49711d \
  --name test-secret \
  --value "test-value"

# Try reading it back
az keyvault secret show \
  --vault-name graphable-kv-49711d \
  --name test-secret \
  --query value -o tsv

# Clean up
az keyvault secret delete \
  --vault-name graphable-kv-49711d \
  --name test-secret
```

## Additional Resources

- [Azure Key Vault Overview](https://docs.microsoft.com/en-us/azure/key-vault/)
- [Azure RBAC for Key Vault](https://docs.microsoft.com/en-us/azure/key-vault/general/rbac-guide)
- [Flowcore Graphable PRD](https://usable.dev/dashboard/workspaces/60c10ca2-4115-4c1a-b6d7-04ac39fd3938/fragments/29e3f893-fe75-4497-b312-26df31102e5d)
