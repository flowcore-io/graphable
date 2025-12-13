import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
	/**
	 * Specify your server-side environment variables schema here. This way you can ensure the app
	 * isn't built with invalid env vars.
	 */
	server: {
		// NextAuth
		NEXTAUTH_SECRET:
			process.env.NODE_ENV === "production"
				? z.string().min(32)
				: z.string().min(32).optional(),
		NEXTAUTH_URL: z.preprocess(
			// This makes Vercel deployments not fail if you don't set NEXTAUTH_URL
			// Since NextAuth.js automatically uses the VERCEL_URL if present.
			(str) => process.env.VERCEL_URL ?? str,
			// VERCEL_URL doesn't include `https` so it cant be validated as a URL
			process.env.VERCEL ? z.string().min(1) : z.string().url(),
		),

		// Usable OIDC
		USABLE_OIDC_ISSUER: z
			.string()
			.url()
			.default("https://auth.flowcore.io/realms/memory-mesh"),
		USABLE_CLIENT_ID: z.string().min(1),
		USABLE_CLIENT_SECRET: z.string().min(1),

		// Database
		DATABASE_URL: z.string().url(),

		// Usable API
		USABLE_API_BASE_URL: z.string().url().default("https://usable.dev/api"),

		// Flowcore
		FLOWCORE_TENANT: z.string().min(1),
		FLOWCORE_DATACORE: z.string().min(1),
		FLOWCORE_WEBHOOK_BASE_URL: z.string().url(),
		FLOWCORE_WEBHOOK_API_KEY: z.string().min(1),
		FLOWCORE_TRANSFORMER_SECRET: z.string().min(1),

		// Node Environment
		NODE_ENV: z
			.enum(["development", "test", "production"])
			.default("development"),
	},

	/**
	 * Specify your client-side environment variables schema here. This way you can ensure the app
	 * isn't built with invalid env vars. To expose them to the client, prefix them with
	 * `NEXT_PUBLIC_`.
	 */
	client: {},

	/**
	 * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
	 * middlewares) or client-side so we need to destruct manually.
	 */
	runtimeEnv: {
		// NextAuth
		NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
		NEXTAUTH_URL: process.env.NEXTAUTH_URL,

		// Usable OIDC
		USABLE_OIDC_ISSUER: process.env.USABLE_OIDC_ISSUER,
		USABLE_CLIENT_ID: process.env.USABLE_CLIENT_ID,
		USABLE_CLIENT_SECRET: process.env.USABLE_CLIENT_SECRET,

		// Database
		DATABASE_URL: process.env.DATABASE_URL,

		// Usable API
		USABLE_API_BASE_URL: process.env.USABLE_API_BASE_URL,

		// Flowcore
		FLOWCORE_TENANT: process.env.FLOWCORE_TENANT,
		FLOWCORE_DATACORE: process.env.FLOWCORE_DATACORE,
		FLOWCORE_WEBHOOK_BASE_URL: process.env.FLOWCORE_WEBHOOK_BASE_URL,
		FLOWCORE_WEBHOOK_API_KEY: process.env.FLOWCORE_WEBHOOK_API_KEY,
		FLOWCORE_TRANSFORMER_SECRET: process.env.FLOWCORE_TRANSFORMER_SECRET,

		// Node Environment
		NODE_ENV: process.env.NODE_ENV,
	},

	/**
	 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
	 * useful for Docker builds.
	 */
	skipValidation: !!process.env.SKIP_ENV_VALIDATION,

	/**
	 * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
	 * `SOME_VAR=''` will throw an error.
	 */
	emptyStringAsUndefined: true,
});
