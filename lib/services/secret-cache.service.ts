/**
 * In-memory secret cache with TTL (Time-To-Live)
 * Caches secrets fetched from Azure Key Vault to reduce API calls
 *
 * SECURITY: Secrets are cached in memory only (never persisted to disk or database)
 * Cache entries expire after TTL to limit exposure window
 */

interface CachedSecret {
  value: string
  expiresAt: number // Unix timestamp in milliseconds
}

/**
 * In-memory cache for secrets
 * Key: JSON stringified SecretReference (for consistent key generation)
 * Value: Cached secret with expiration timestamp
 */
class SecretCache {
  private cache: Map<string, CachedSecret> = new Map()
  private readonly defaultTtlMs: number

  constructor(defaultTtlMs: number = 5 * 60 * 1000) {
    // Default TTL: 5 minutes
    this.defaultTtlMs = defaultTtlMs
  }

  /**
   * Generate cache key from secret reference
   */
  private getCacheKey(secretRef: { provider: string; vaultUrl: string; secretName: string; version?: string }): string {
    // Use JSON stringification for consistent key generation
    return JSON.stringify({
      provider: secretRef.provider,
      vaultUrl: secretRef.vaultUrl,
      secretName: secretRef.secretName,
      version: secretRef.version || "latest",
    })
  }

  /**
   * Get cached secret if it exists and hasn't expired
   */
  get(secretRef: { provider: string; vaultUrl: string; secretName: string; version?: string }): string | null {
    const key = this.getCacheKey(secretRef)
    const cached = this.cache.get(key)

    if (!cached) {
      return null
    }

    // Check if expired
    if (Date.now() >= cached.expiresAt) {
      // Remove expired entry
      this.cache.delete(key)
      return null
    }

    return cached.value
  }

  /**
   * Store secret in cache with TTL
   */
  set(
    secretRef: { provider: string; vaultUrl: string; secretName: string; version?: string },
    value: string,
    ttlMs?: number
  ): void {
    const key = this.getCacheKey(secretRef)
    const expiresAt = Date.now() + (ttlMs || this.defaultTtlMs)

    this.cache.set(key, {
      value,
      expiresAt,
    })
  }

  /**
   * Remove secret from cache
   */
  delete(secretRef: { provider: string; vaultUrl: string; secretName: string; version?: string }): void {
    const key = this.getCacheKey(secretRef)
    this.cache.delete(key)
  }

  /**
   * Clear all expired entries from cache
   */
  cleanup(): void {
    const now = Date.now()
    for (const [key, cached] of this.cache.entries()) {
      if (now >= cached.expiresAt) {
        this.cache.delete(key)
      }
    }
  }

  /**
   * Clear all entries from cache
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; entries: number } {
    // Clean up expired entries first
    this.cleanup()
    return {
      size: this.cache.size,
      entries: this.cache.size,
    }
  }
}

/**
 * Global secret cache instance (singleton)
 * Persists across requests in the same Node.js process
 */
let secretCacheInstance: SecretCache | null = null

/**
 * Get the global secret cache instance
 */
export function getSecretCache(): SecretCache {
  if (!secretCacheInstance) {
    // Default TTL: 5 minutes (300000 ms)
    // Can be configured via environment variable if needed
    const ttlMs = process.env.SECRET_CACHE_TTL_MS ? parseInt(process.env.SECRET_CACHE_TTL_MS, 10) : 5 * 60 * 1000
    secretCacheInstance = new SecretCache(ttlMs)
  }
  return secretCacheInstance
}
