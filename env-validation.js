const { z } = require('zod')
const dotenv = require('dotenv')

// Load environment variables
dotenv.config()

// Define validation schema (must match lib/env.ts)
const envSchema = z.object({
  // NextAuth
  NEXTAUTH_SECRET:
    process.env.NODE_ENV === 'production' ? z.string().min(32) : z.string().min(32).optional(),
  NEXTAUTH_URL: z.string().min(1),

  // Usable OIDC
  USABLE_OIDC_ISSUER: z.string().url().optional(),
  USABLE_CLIENT_ID: z.string().min(1),
  USABLE_CLIENT_SECRET: z.string().min(1),

  // Database
  DATABASE_URL: z.string().url(),

  // Node Environment
  NODE_ENV: z.enum(['development', 'test', 'production']).optional(),
})

// Skip validation if explicitly requested (useful for Docker builds)
if (process.env.SKIP_ENV_VALIDATION) {
  console.log('⚠️  Environment validation skipped (SKIP_ENV_VALIDATION=true)')
  return // Don't use process.exit(0) - it kills the entire build process!
}

// Validate environment variables
try {
  envSchema.parse(process.env)
  console.log('✅ Environment validation passed')
} catch (error) {
  console.error('❌ Environment validation failed:')
  console.error('')
  if (error && typeof error === 'object' && 'errors' in error && Array.isArray(error.errors)) {
    for (const err of error.errors) {
      const path = err.path ? err.path.join('.') : 'unknown'
      console.error(`  - ${path}: ${err.message || 'Unknown error'}`)
    }
  } else {
    console.error(`  - ${error?.message || 'Unknown error'}`)
  }
  console.error('')
  console.error('Please check your .env.local file and ensure all required variables are set.')
  console.error('See .env.local.example for reference.')
  process.exit(1)
}
