# Graphable Production Deployment Checklist

## Step 1: Set Up Azure Infrastructure

Run the automated setup script to create all required Azure resources:

```bash
cd scripts
./setup-azure-production.sh
```

This will output the exact configuration values you need. **Save these values
securely!**

## Step 2: Create Kubernetes Secret

The script will output a command like this - run it in your Kubernetes cluster:

```bash
kubectl create secret generic graphable-credentials \
  --from-literal=azure-client-secret='<password-from-script>' \
  --namespace=<your-namespace>
```

**Important**: Replace `<your-namespace>` with the actual namespace where
Graphable will be deployed (likely `graphable` or similar).

## Step 3: Configure Deployment

Add these environment variables to your Helm chart values or Kubernetes
deployment manifest:

```yaml
env:
  # Azure Key Vault Configuration
  - name: AZURE_KEY_VAULT_URL
    value: "https://graphable-kv-49711d.vault.azure.net/"

  - name: AZURE_CLIENT_ID
    value: "<app-id-from-setup-script>"

  - name: AZURE_CLIENT_SECRET
    valueFrom:
      secretKeyRef:
        name: graphable-credentials
        key: azure-client-secret

  - name: AZURE_TENANT_ID
    value: "<tenant-id-from-setup-script>"
```

### Where to Add These

Based on your CI/CD setup (see `.github/workflows/build.yml`), you're using:

- **GitOps repository**: `flowcore-io/public-customer-sites-manifests`
- **Helm chart updates**: The build workflow updates the chart version
- **Argo CD**: Automatically syncs changes to AKS

You should add these environment variables in the Helm chart for Graphable in
the `flowcore-io/public-customer-sites-manifests` repository.

## Step 4: Verify Other Required Environment Variables

Ensure all these are configured in your deployment:

### Required for All Features

```yaml
- name: NODE_ENV
  value: "production"

- name: DATABASE_URL
  value: "postgresql://user:password@host:5432/graphable"

- name: NEXTAUTH_SECRET
  valueFrom:
    secretKeyRef:
      name: graphable-credentials
      key: nextauth-secret

- name: NEXTAUTH_URL
  value: "https://graphable.usable.dev"

- name: USABLE_OIDC_ISSUER
  value: "https://auth.flowcore.io/realms/memory-mesh"

- name: USABLE_CLIENT_ID
  valueFrom:
    secretKeyRef:
      name: graphable-credentials
      key: usable-client-id

- name: USABLE_CLIENT_SECRET
  valueFrom:
    secretKeyRef:
      name: graphable-credentials
      key: usable-client-secret

- name: USABLE_API_BASE_URL
  value: "https://usable.dev/api"

- name: FLOWCORE_TENANT
  value: "graphable"

- name: FLOWCORE_DATACORE
  value: "graphable"

- name: FLOWCORE_WEBHOOK_BASE_URL
  value: "https://graphable.usable.dev/api"

- name: FLOWCORE_WEBHOOK_API_KEY
  valueFrom:
    secretKeyRef:
      name: graphable-credentials
      key: flowcore-webhook-api-key

- name: FLOWCORE_TRANSFORMER_SECRET
  valueFrom:
    secretKeyRef:
      name: graphable-credentials
      key: flowcore-transformer-secret
```

## Step 5: Deploy

Once the Helm chart is updated and pushed to the manifests repository:

1. Argo CD will detect the changes
2. It will sync the new configuration to your AKS cluster
3. Graphable pods will restart with the new environment variables
4. Check pod logs to ensure everything starts correctly

### Verify Deployment

```bash
# Check pod status
kubectl get pods -n <namespace> -l app=graphable

# Check logs for any errors
kubectl logs -n <namespace> -l app=graphable --tail=100

# Verify environment variables are set
kubectl exec -n <namespace> <pod-name> -- env | grep AZURE
```

## Step 6: Test the Integration

1. Log in to Graphable at `https://graphable.usable.dev`
2. Navigate to Data Sources
3. Try adding a new PostgreSQL data source
4. Test the connection

If the connection test succeeds, your Azure Key Vault integration is working! 🎉

## Troubleshooting

### Azure Key Vault Connection Issues

**Error**: `AZURE_KEY_VAULT_URL environment variable is required`

- **Fix**: Ensure the environment variable is set in your deployment

**Error**: `DefaultAzureCredential failed`

- **Fix**: Verify all three Azure environment variables are set (CLIENT_ID,
  CLIENT_SECRET, TENANT_ID)

**Error**: `Authorization failed` when storing/retrieving secrets

- **Fix**: Run `./scripts/setup-azure-production.sh` again to verify RBAC
  permissions

### Kubernetes Secret Issues

**Error**: `Secret "graphable-credentials" not found`

- **Fix**: Create the secret using the command from Step 2

**Error**: `Key "azure-client-secret" not found in secret`

- **Fix**: Recreate the secret with the correct key name (see Step 2)

## Security Notes

✅ **Completed**:

- Azure Key Vault created with RBAC authorization
- Service Principal with least-privilege access (Key Vault Secrets Officer only)
- Credentials stored in Kubernetes secrets (not in code)
- Secrets never stored in database or events (only references)

🔐 **Best Practices**:

- Rotate the service principal password every 90 days
- Monitor Key Vault access logs
- Use separate credentials for dev/staging/production
- Plan migration to Azure AD Workload Identity (see `AZURE_SETUP.md`)

## Next Steps After Deployment

1. Monitor the first few data source creations to ensure Key Vault integration
   works
2. Set up Key Vault access logging and alerts
3. Document the rotation process for the service principal credentials
4. Consider implementing Azure AD Workload Identity for improved security (see
   `AZURE_SETUP.md`)

## Need Help?

- Full Azure setup guide: See `AZURE_SETUP.md`
- Environment variables reference: See `env.example`
- Architecture details: See the PRD in Usable workspace
- Azure setup script: `scripts/setup-azure-production.sh`
