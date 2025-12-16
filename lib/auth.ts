import { env } from "@/lib/env"
import { getOrCreateUser } from "@/lib/services/user.service"
import type { DefaultSession, NextAuthOptions } from "next-auth"
import type { JWT } from "next-auth/jwt"
import KeycloakProvider from "next-auth/providers/keycloak"

/**
 * Decode JWT ID token and extract usable_user_id claim
 *
 * According to AD: Usable User ID in Keycloak Tokens for Cross-Service SSO,
 * the Usable database user ID is stored in the ID token as a custom claim
 * called `usable_user_id`.
 *
 * @param idToken - The ID token JWT string
 * @returns The Usable user ID if found, undefined otherwise
 */
function extractUsableUserId(idToken: string | undefined): string | undefined {
  if (!idToken) {
    return undefined
  }

  try {
    // JWT format: header.payload.signature
    // We only need the payload (middle part)
    const parts = idToken.split(".")
    if (parts.length !== 3) {
      console.warn("⚠️  Invalid ID token format")
      return undefined
    }

    // Decode base64url-encoded payload
    // Base64URL uses - and _ instead of + and /, and no padding
    const payload = parts[1]
    const decoded = Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8")

    const claims = JSON.parse(decoded)
    const usableUserId = claims.usable_user_id as string | undefined

    if (usableUserId) {
      console.log("✅ Extracted usable_user_id from ID token")
      return usableUserId
    } else {
      console.warn("⚠️  usable_user_id claim not found in ID token - falling back to Keycloak user ID")
      return undefined
    }
  } catch (error) {
    console.error("❌ Error decoding ID token:", error)
    return undefined
  }
}

/**
 * Refresh the access token using the refresh token
 */
async function refreshAccessToken(token: JWT): Promise<JWT> {
  try {
    const tokenEndpoint = `${env.USABLE_OIDC_ISSUER}/protocol/openid-connect/token`

    const response = await fetch(tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: env.USABLE_CLIENT_ID,
        client_secret: env.USABLE_CLIENT_SECRET,
        grant_type: "refresh_token",
        refresh_token: token.refreshToken as string,
        // Request same audience for consistency
        audience: env.USABLE_CLIENT_ID,
      }),
    })

    const refreshedTokens = await response.json()

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${refreshedTokens.error || response.statusText}`)
    }

    console.log("✅ Token refreshed successfully")

    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      accessTokenExpires: Date.now() + (refreshedTokens.expires_in ?? 3600) * 1000,
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken, // Use new refresh token if provided
      // Preserve existing ID token (refresh typically doesn't return a new one)
      // If refresh does return a new ID token, update it
      idToken: refreshedTokens.id_token ?? token.idToken,
    }
  } catch (error) {
    console.error("❌ Error refreshing access token:", error)

    return {
      ...token,
      error: "RefreshAccessTokenError",
    }
  }
}

// Extend the built-in session types
declare module "next-auth" {
  interface Session {
    user: {
      id: string // usable_user_id from token claim (required)
      accessToken?: string // Only available server-side
    } & DefaultSession["user"]
    idToken?: string // For Keycloak RP-initiated logout
  }

  interface JWT {
    id?: string // Keycloak user ID (backward compatibility)
    usableUserId?: string // Usable database user ID (preferred, required)
    accessToken?: string
    refreshToken?: string
    accessTokenExpires?: number
    idToken?: string
    error?: string
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    KeycloakProvider({
      clientId: env.USABLE_CLIENT_ID,
      clientSecret: env.USABLE_CLIENT_SECRET,
      issuer: env.USABLE_OIDC_ISSUER,
      authorization: {
        params: {
          scope: "openid email profile offline_access",
          // Request token with correct audience for MCP server
          audience: env.USABLE_CLIENT_ID,
        },
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  cookies: {
    // Use environment-specific cookie names to prevent conflicts
    // between local development and production
    sessionToken: {
      name: `${env.NODE_ENV === "production" ? "__Secure-next-auth.session-token" : "dev-next-auth.session-token"}`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: env.NODE_ENV === "production",
      },
    },
    callbackUrl: {
      name: `${env.NODE_ENV === "production" ? "__Secure-next-auth.callback-url" : "dev-next-auth.callback-url"}`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: env.NODE_ENV === "production",
      },
    },
    csrfToken: {
      name: `${env.NODE_ENV === "production" ? "__Host-next-auth.csrf-token" : "dev-next-auth.csrf-token"}`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: env.NODE_ENV === "production",
      },
    },
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  callbacks: {
    /**
     * CRITICAL: Redirect callback to handle post-authentication navigation
     * Prevents "not redirecting after authentication" issues
     */
    async redirect({ url, baseUrl }) {
      // Allows relative callback URLs
      if (url.startsWith("/")) return `${baseUrl}${url}`
      // Allows callback URLs on the same origin
      else if (new URL(url).origin === baseUrl) return url
      return baseUrl
    },
    async signIn({ user, account }) {
      // REQUIRED: Check for Usable user ID in ID token
      // Users must have their Usable user ID synced to Keycloak before they can sign in
      if (account?.id_token) {
        const usableUserId = extractUsableUserId(account.id_token)
        if (!usableUserId) {
          console.warn(`❌ User ${user.email} attempted sign-in but missing usable_user_id claim in ID token`)
          // Return false to reject sign-in - will redirect to error page
          return false
        }
        console.log(`✅ User ${user.email} has usable_user_id: ${usableUserId}`)
      } else {
        console.warn(`⚠️  User ${user.email} signed in but no ID token available`)
        // If no ID token, reject sign-in
        return false
      }

      console.log(`✅ User ${user.email} authorized to sign in`)
      return true
    },
    async jwt({ token, user, account, profile }) {
      // Initial sign in
      if (account && user) {
        token.accessToken = account.access_token
        token.refreshToken = account.refresh_token
        token.idToken = account.id_token
        // Calculate expiration time (account.expires_at is in seconds)
        const expiresAt = account.expires_at ? account.expires_at * 1000 : Date.now() + 3600 * 1000 // Default to 1 hour
        token.accessTokenExpires = expiresAt

        // Extract Usable user ID from ID token
        // This is the preferred user ID for billing events and conversations
        const usableUserId = extractUsableUserId(account.id_token)
        if (usableUserId) {
          token.usableUserId = usableUserId

          // CRITICAL: Create user record in database on first login
          // This is an exception to event-driven architecture (see fragment 98494836-ac30-4024-b87b-353bf34db603)
          try {
            await getOrCreateUser(usableUserId, {
              email: user.email || "",
              name: user.name || undefined,
              image: user.image || undefined,
            })
            console.log(`✅ User record created/verified in database for ${usableUserId}`)
          } catch (error) {
            // Don't block authentication if user creation fails
            // Log error but continue with authentication
            console.error(`⚠️  Failed to create user record for ${usableUserId}:`, error)
          }
        }

        // Store user data in token
        token.id = user.id // Keycloak user ID (kept for backward compatibility)
        token.email = user.email
        token.name = user.name
        token.image = user.image

        console.log("🔐 New tokens stored:", {
          hasAccessToken: !!token.accessToken,
          hasRefreshToken: !!token.refreshToken,
          hasUsableUserId: !!token.usableUserId,
          expiresAt: new Date(expiresAt).toISOString(),
        })

        return token
      }

      // Return previous token if the access token has not expired yet
      if (Date.now() < (token.accessTokenExpires as number)) {
        return token
      }

      // Access token has expired, check if we have a refresh token
      if (!token.refreshToken) {
        console.log("❌ No refresh token available - session migration required")
        return {
          ...token,
          error: "RefreshTokenMissing",
        }
      }

      // Access token has expired, try to refresh it
      console.log("🔄 Access token expired, attempting refresh...")
      const refreshedToken = await refreshAccessToken(token)

      // Extract Usable user ID from stored ID token if not already set
      // Token refresh typically doesn't return a new ID token, so we use the existing one
      if (refreshedToken.idToken && typeof refreshedToken.idToken === "string" && !refreshedToken.usableUserId) {
        const usableUserId = extractUsableUserId(refreshedToken.idToken)
        if (usableUserId) {
          refreshedToken.usableUserId = usableUserId
        }
      }

      return refreshedToken
    },
    async session({ session, token }) {
      // Send properties to the client
      if (token) {
        // Try to extract Usable user ID from ID token if not already set
        // This handles edge cases where token was created before this check was added
        if (!token.usableUserId && token.idToken && typeof token.idToken === "string") {
          const usableUserId = extractUsableUserId(token.idToken)
          if (usableUserId) {
            token.usableUserId = usableUserId
          }
        }

        // CRITICAL: Require Usable user ID for billing accuracy
        // If missing, invalidate session and mark error for middleware redirect
        if (!token.usableUserId) {
          console.error(`❌ Session invalidated for user ${token.email} - missing usableUserId (required for billing)`)
          // Set error to trigger middleware redirect to explanation page
          token.error = "MissingUsableUserId"
          // Don't set session data - this will cause session to be invalid
          return null as any // Return null to invalidate session
        }

        // Use Usable user ID (required - we've already validated it exists above)
        session.user.id = token.usableUserId as string
        session.user.email = token.email as string
        session.user.name = token.name as string
        session.user.image = token.image as string

        // Only set accessToken if there's no error
        if (token.error) {
          console.error(`⚠️  Session error: ${token.error} - user needs to re-login`)
          // Don't set accessToken, which will trigger re-authentication
        } else {
          session.user.accessToken = token.accessToken as string
          // Expose idToken for Keycloak RP-initiated logout
          if (token.idToken) {
            session.idToken = token.idToken as string
          }
        }
      }
      return session
    },
  },
  events: {
    async signIn({ user, account }) {
      console.log(`User ${user.email} signed in via ${account?.provider}`)
    },
    async signOut() {
      console.log("User signed out")
    },
  },
  debug: false, // Disable debug to reduce session size
}
