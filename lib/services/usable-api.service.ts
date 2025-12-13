import { env } from "@/lib/env";

export interface UsableWorkspace {
	id: string;
	name: string;
	description?: string;
	visibility: "private" | "public";
	createdAt: string;
	updatedAt: string;
}

export interface UsableFragmentType {
	id: string;
	name: string;
	description?: string;
	color: string;
	icon: string;
	workspaceId: string;
	isActive: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface UsableFragment {
	id: string;
	workspaceId: string;
	title: string;
	summary?: string;
	fragmentTypeId: string;
	status: "draft" | "published" | "archived";
	tags: string[];
	createdAt: string;
	updatedAt: string;
}

export interface FragmentTypeInput {
	name: string;
	description?: string;
	color?: string;
	icon?: string;
}

export interface FragmentInput {
	workspaceId: string;
	title: string;
	content: string;
	summary?: string;
	tags?: string[];
	repository?: string;
	branch?: string;
	fragmentTypeId: string;
}

/**
 * Usable API client service for interacting with Usable API endpoints
 * Uses Bearer token authentication and handles errors appropriately
 */
export class UsableApiService {
	private baseUrl: string;

	constructor() {
		this.baseUrl = env.USABLE_API_BASE_URL;
	}

	private async request<T>(
		endpoint: string,
		options: RequestInit & { accessToken: string },
	): Promise<T> {
		const { accessToken, ...fetchOptions } = options;
		const url = `${this.baseUrl}${endpoint}`;

		const response = await fetch(url, {
			...fetchOptions,
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${accessToken}`,
				...fetchOptions.headers,
			},
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			throw new Error(
				errorData.error ||
					`Usable API error: ${response.status} ${response.statusText}`,
			);
		}

		return response.json();
	}

	/**
	 * List user's accessible workspaces
	 * Returns all accessible workspaces - filtering to owner-only should be done client-side
	 * or via the /api/workspaces/accessible endpoint
	 */
	async listUserWorkspaces(accessToken: string): Promise<UsableWorkspace[]> {
		const response = await this.request<{
			workspaces?: UsableWorkspace[];
			success?: boolean;
		}>("/api/workspaces", {
			method: "GET",
			accessToken,
		});

		// Handle different response formats
		if (Array.isArray(response)) {
			return response;
		}
		if (response.workspaces) {
			return response.workspaces;
		}
		return [];
	}

	/**
	 * Get workspace details by ID
	 */
	async getWorkspace(
		workspaceId: string,
		accessToken: string,
	): Promise<UsableWorkspace> {
		const response = await this.request<{
			workspace?: UsableWorkspace;
			success?: boolean;
		}>(`/api/workspaces/${workspaceId}`, {
			method: "GET",
			accessToken,
		});

		// Handle different response formats
		if (response.workspace) {
			return response.workspace;
		}
		return response as unknown as UsableWorkspace;
	}

	/**
	 * List fragment types for a workspace
	 */
	async getFragmentTypes(
		workspaceId: string,
		accessToken: string,
	): Promise<UsableFragmentType[]> {
		const response = await this.request<{
			fragmentTypes?: UsableFragmentType[];
			success?: boolean;
		}>(`/api/workspaces/${workspaceId}/fragment-types`, {
			method: "GET",
			accessToken,
		});

		// Handle different response formats
		if (Array.isArray(response)) {
			return response;
		}
		return response.fragmentTypes || [];
	}

	/**
	 * Create a custom fragment type in a workspace
	 */
	async createFragmentType(
		workspaceId: string,
		fragmentType: FragmentTypeInput,
		accessToken: string,
	): Promise<UsableFragmentType> {
		const response = await this.request<{
			success: boolean;
			fragmentType: UsableFragmentType;
		}>(`/api/workspaces/${workspaceId}/fragment-types`, {
			method: "POST",
			accessToken,
			body: JSON.stringify(fragmentType),
		});

		return response.fragmentType;
	}

	/**
	 * Create a memory fragment in a workspace
	 */
	async createFragment(
		workspaceId: string,
		fragment: FragmentInput,
		accessToken: string,
	): Promise<UsableFragment> {
		const response = await this.request<{
			success: boolean;
			fragment: UsableFragment;
		}>("/api/memory-fragments", {
			method: "POST",
			accessToken,
			body: JSON.stringify({
				...fragment,
				workspaceId,
			}),
		});

		return response.fragment;
	}

	/**
	 * Get a memory fragment by ID
	 */
	async getFragment(
		workspaceId: string,
		fragmentId: string,
		accessToken: string,
	): Promise<UsableFragment> {
		return this.request<UsableFragment>(`/api/memory-fragments/${fragmentId}`, {
			method: "GET",
			accessToken,
			headers: {
				"X-Workspace-Id": workspaceId,
			},
		});
	}
}

// Export singleton instance
export const usableApi = new UsableApiService();
