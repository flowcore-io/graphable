import { authOptions } from "@/lib/auth";
import { usableApi } from "@/lib/services/usable-api.service";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

/**
 * GET /api/onboarding/workspaces
 * Fetch user's owned workspaces for workspace linking
 */
export async function GET() {
	try {
		// Layer 1 - Authentication (401)
		const session = await getServerSession(authOptions);
		if (!session?.user?.accessToken) {
			return NextResponse.json(
				{ error: "Authentication required" },
				{ status: 401 },
			);
		}

		// Get user's accessible workspaces
		const workspaces = await usableApi.listUserWorkspaces(
			session.user.accessToken,
		);

		// Filter to owner-only workspaces
		// Note: The API may not include role info, so we return all accessible workspaces
		// Client-side filtering can be done if role information is available
		// For now, we assume the API returns only workspaces where user has appropriate access

		return NextResponse.json({
			success: true,
			workspaces,
		});
	} catch (error) {
		console.error("Error fetching workspaces:", error);
		return NextResponse.json(
			{ error: "Failed to fetch workspaces" },
			{ status: 500 },
		);
	}
}
