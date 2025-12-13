import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { authOptions } from "./lib/auth";

export default withAuth(
	function middleware(req) {
		const isOnAuthPage = req.nextUrl.pathname.startsWith("/auth");

		// Check if token has MissingUsableUserId error - redirect to error page
		if (
			req.nextauth.token?.error === "MissingUsableUserId" &&
			!isOnAuthPage
		) {
			return NextResponse.redirect(
				new URL("/auth/error?error=MissingUsableUserId", req.url),
			);
		}

		// Redirect to home if logged in and on auth page (but not if missing userId)
		if (
			req.nextauth.token &&
			isOnAuthPage &&
			req.nextauth.token.error !== "MissingUsableUserId"
		) {
			return NextResponse.redirect(new URL("/", req.url));
		}

		return NextResponse.next();
	},
	{
		// Pass cookies configuration so middleware knows about custom cookie names
		cookies: authOptions.cookies,
		callbacks: {
			authorized: ({ req, token }) => {
				const isOnAuthPage = req.nextUrl.pathname.startsWith("/auth");

				// Always allow access to auth pages
				if (isOnAuthPage) {
					return true;
				}

				// Allow access to API routes (they handle their own auth)
				if (req.nextUrl.pathname.startsWith("/api")) {
					return true;
				}

				// Allow access to static assets
				if (
					req.nextUrl.pathname.startsWith("/_next") ||
					req.nextUrl.pathname.startsWith("/favicon.ico") ||
					req.nextUrl.pathname.match(/\.(ico|png|jpg|jpeg|svg|gif|webp)$/)
				) {
					return true;
				}

				// Require auth for all other routes
				return !!token;
			},
		},
		pages: {
			signIn: "/auth/signin",
		},
	},
);

export const config = {
	matcher: [
		"/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
	],
};
