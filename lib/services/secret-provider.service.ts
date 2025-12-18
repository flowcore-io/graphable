/**
 * Secret Provider abstraction for secure secret storage
 * Supports Azure Key Vault as the primary implementation
 * Includes in-memory caching with TTL to reduce Azure Key Vault API calls
 */

import { DefaultAzureCredential } from "@azure/identity"
import { SecretClient } from "@azure/keyvault-secrets"
import { getSecretCache } from "./secret-cache.service"

/**
 * Secret reference structure stored in database
 *
 * SECURITY: This is a REFERENCE (key) to fetch the secret from Azure Key Vault, NOT the actual secret.
 * The actual secret (connection string, password, etc.) remains in Azure Key Vault and is fetched on-demand.
 * This reference is stored in the control plane database (dataSourceSecrets table) but is NEVER included in events.
 *
 * Structure:
 * - provider: Always "azure-key-vault" for MVP
 * - vaultUrl: Azure Key Vault URL (e.g., https://myvault.vault.azure.net/)
 * - secretName: Name of the secret in the vault (workspace-scoped: {workspaceId}-{name})
 * - version: Optional version identifier for the secret
 */
export interface SecretReference {
  provider: "azure-key-vault"
  vaultUrl: string
  secretName: string
  version?: string
}

/**
 * Secret Provider interface
 */
export interface SecretProvider {
  /**
   * Store a secret and return a reference
   */
  putSecret(workspaceId: string, name: string, payload: string): Promise<SecretReference>

  /**
   * Retrieve a secret using its reference
   */
  getSecret(secretRef: SecretReference): Promise<string>

  /**
   * Rotate a secret (create new version)
   */
  rotateSecret(secretRef: SecretReference, newPayload: string): Promise<SecretReference>

  /**
   * Delete a secret
   */
  deleteSecret(secretRef: SecretReference): Promise<void>
}

/**
 * Azure Key Vault implementation of SecretProvider
 */
export class AzureKeyVaultSecretProvider implements SecretProvider {
  private client: SecretClient

  constructor() {
    // Use DefaultAzureCredential which supports:
    // - Managed Identity (production)
    // - Service Principal (local dev via environment variables)
    // - Azure CLI (local dev)
    const credential = new DefaultAzureCredential()

    // Get vault URL from environment
    const vaultUrl = process.env.AZURE_KEY_VAULT_URL
    if (!vaultUrl) {
      throw new Error("AZURE_KEY_VAULT_URL environment variable is required")
    }

    this.client = new SecretClient(vaultUrl, credential)
  }

  /**
   * Store a secret with workspace-scoped naming
   * Format: {workspaceId}-{name}
   * Caches the secret after storing
   *
   * Azure Key Vault secret names can only contain alphanumeric characters and hyphens.
   * Underscores and other special characters are not allowed.
   */
  async putSecret(workspaceId: string, name: string, payload: string): Promise<SecretReference> {
    // Sanitize secret name: replace underscores and other invalid chars with hyphens
    // Azure Key Vault allows: alphanumeric (a-z, A-Z, 0-9) and hyphens (-)
    const sanitizedName = name
      .replace(/[^a-zA-Z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
    const secretName = `${workspaceId}-${sanitizedName}`

    try {
      const secret = await this.client.setSecret(secretName, payload)

      const secretRef: SecretReference = {
        provider: "azure-key-vault",
        vaultUrl: this.client.vaultUrl,
        secretName: secret.name,
        version: secret.properties.version,
      }

      // Cache the secret after storing
      const cache = getSecretCache()
      cache.set(secretRef, payload)

      return secretRef
    } catch (error) {
      console.error(`Failed to store secret ${secretName}:`, error)
      throw new Error(`Failed to store secret: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  /**
   * Retrieve a secret using its reference
   * Uses in-memory cache with TTL to reduce Azure Key Vault API calls
   */
  async getSecret(secretRef: SecretReference): Promise<string> {
    if (secretRef.provider !== "azure-key-vault") {
      throw new Error(`Unsupported secret provider: ${secretRef.provider}`)
    }

    // Check cache first
    const cache = getSecretCache()
    const cached = cache.get(secretRef)
    if (cached !== null) {
      return cached
    }

    // Cache miss - fetch from Azure Key Vault
    try {
      const secret = secretRef.version
        ? await this.client.getSecret(secretRef.secretName, { version: secretRef.version })
        : await this.client.getSecret(secretRef.secretName)

      if (!secret.value) {
        throw new Error(`Secret ${secretRef.secretName} has no value`)
      }

      // Store in cache for future requests
      cache.set(secretRef, secret.value)

      return secret.value
    } catch (error) {
      console.error(`Failed to retrieve secret ${secretRef.secretName}:`, error)
      throw new Error(`Failed to retrieve secret: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  /**
   * Rotate a secret by creating a new version
   * Invalidates cache for the old secret reference
   */
  async rotateSecret(secretRef: SecretReference, newPayload: string): Promise<SecretReference> {
    if (secretRef.provider !== "azure-key-vault") {
      throw new Error(`Unsupported secret provider: ${secretRef.provider}`)
    }

    try {
      // Create new version by setting the secret again
      const secret = await this.client.setSecret(secretRef.secretName, newPayload)

      const newSecretRef: SecretReference = {
        provider: "azure-key-vault",
        vaultUrl: secretRef.vaultUrl,
        secretName: secret.name,
        version: secret.properties.version,
      }

      // Invalidate old cache entry
      const cache = getSecretCache()
      cache.delete(secretRef)

      // Cache the new secret value
      cache.set(newSecretRef, newPayload)

      return newSecretRef
    } catch (error) {
      console.error(`Failed to rotate secret ${secretRef.secretName}:`, error)
      throw new Error(`Failed to rotate secret: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  /**
   * Delete a secret
   * Invalidates cache entry for the deleted secret
   */
  async deleteSecret(secretRef: SecretReference): Promise<void> {
    if (secretRef.provider !== "azure-key-vault") {
      throw new Error(`Unsupported secret provider: ${secretRef.provider}`)
    }

    try {
      await this.client.beginDeleteSecret(secretRef.secretName)
      // Note: beginDeleteSecret starts async deletion, actual deletion happens after retention period
      // For immediate deletion, you may need to purge, but that requires additional permissions

      // Invalidate cache entry
      const cache = getSecretCache()
      cache.delete(secretRef)
    } catch (error) {
      console.error(`Failed to delete secret ${secretRef.secretName}:`, error)
      throw new Error(`Failed to delete secret: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }
}

/**
 * Default secret provider instance
 * Uses Azure Key Vault
 */
let secretProviderInstance: SecretProvider | null = null

/**
 * Get the default secret provider instance
 */
export function getSecretProvider(): SecretProvider {
  if (!secretProviderInstance) {
    secretProviderInstance = new AzureKeyVaultSecretProvider()
  }
  return secretProviderInstance
}





