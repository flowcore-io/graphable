import { env } from "@/lib/env"

export interface UsableWorkspace {
  id: string
  name: string
  description?: string
  visibility: "private" | "public"
  createdAt: string
  updatedAt: string
}

export interface UsableFragmentType {
  id: string
  name: string
  description?: string
  color: string
  icon: string
  workspaceId: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface UsableFragment {
  id: string
  workspaceId: string
  title: string
  summary?: string
  content?: string // Fragment content (JSON string or markdown)
  fragmentTypeId: string
  status: "draft" | "published" | "archived"
  tags: string[]
  createdAt: string
  updatedAt: string
}

export interface FragmentTypeInput {
  name: string
  description?: string
  color?: string
  icon?: string
}

export interface FragmentInput {
  workspaceId: string
  title: string
  content: string
  summary?: string
  tags?: string[]
  repository?: string
  branch?: string
  fragmentTypeId: string
  key?: string // Optional workspace-scoped key for deterministic lookup (key-value store semantics)
}

/**
 * Usable API client service for interacting with Usable API endpoints
 * Uses Bearer token authentication and handles errors appropriately
 */
export class UsableApiService {
  private baseUrl: string

  constructor() {
    this.baseUrl = env.USABLE_API_BASE_URL
  }

  private async request<T>(endpoint: string, options: RequestInit & { accessToken: string }): Promise<T> {
    const { accessToken, ...fetchOptions } = options
    const url = `${this.baseUrl}${endpoint}`

    const response = await fetch(url, {
      ...fetchOptions,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        ...fetchOptions.headers,
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorMessage =
        errorData.error || errorData.message || `Usable API error: ${response.status} ${response.statusText}`
      console.error("Usable API error:", {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
        errorDetails: errorData.details ? JSON.stringify(errorData.details, null, 2) : undefined,
        endpoint,
        method: fetchOptions.method || "GET",
      })
      throw new Error(errorMessage)
    }

    return response.json()
  }

  /**
   * List user's accessible workspaces
   * Returns all accessible workspaces - filtering to owner-only should be done client-side
   * or via the /workspaces/accessible endpoint
   */
  async listUserWorkspaces(accessToken: string): Promise<UsableWorkspace[]> {
    const response = await this.request<{
      workspaces?: UsableWorkspace[]
      success?: boolean
    }>("/workspaces", {
      method: "GET",
      accessToken,
    })

    // Handle different response formats
    if (Array.isArray(response)) {
      return response
    }
    if (response.workspaces) {
      return response.workspaces
    }
    return []
  }

  /**
   * Get workspace details by ID
   */
  async getWorkspace(workspaceId: string, accessToken: string): Promise<UsableWorkspace> {
    const response = await this.request<{
      workspace?: UsableWorkspace
      success?: boolean
    }>(`/workspaces/${workspaceId}`, {
      method: "GET",
      accessToken,
    })

    // Handle different response formats
    if (response.workspace) {
      return response.workspace
    }
    return response as unknown as UsableWorkspace
  }

  /**
   * List fragment types for a workspace
   */
  async getFragmentTypes(workspaceId: string, accessToken: string): Promise<UsableFragmentType[]> {
    const response = await this.request<{
      fragmentTypes?: UsableFragmentType[]
      success?: boolean
    }>(`/workspaces/${workspaceId}/fragment-types`, {
      method: "GET",
      accessToken,
    })

    // Handle different response formats
    if (Array.isArray(response)) {
      return response
    }
    return response.fragmentTypes || []
  }

  /**
   * Get fragment type ID by name (case-insensitive)
   * Returns the fragment type ID for the given name, or null if not found
   */
  async getFragmentTypeIdByName(
    workspaceId: string,
    fragmentTypeName: string,
    accessToken: string
  ): Promise<string | null> {
    const fragmentTypes = await this.getFragmentTypes(workspaceId, accessToken)
    const found = fragmentTypes.find((type) => type.name.toLowerCase() === fragmentTypeName.toLowerCase())
    return found?.id || null
  }

  /**
   * Create a custom fragment type in a workspace
   */
  async createFragmentType(
    workspaceId: string,
    fragmentType: FragmentTypeInput,
    accessToken: string
  ): Promise<UsableFragmentType> {
    const response = await this.request<{
      success: boolean
      fragmentType: UsableFragmentType
    }>(`/workspaces/${workspaceId}/fragment-types`, {
      method: "POST",
      accessToken,
      body: JSON.stringify(fragmentType),
    })

    return response.fragmentType
  }

  /**
   * Create a memory fragment in a workspace
   */
  async createFragment(workspaceId: string, fragment: FragmentInput, accessToken: string): Promise<UsableFragment> {
    const response = await this.request<unknown>("/memory-fragments", {
      method: "POST",
      accessToken,
      headers: {
        "X-Workspace-Id": workspaceId,
      },
      body: JSON.stringify({
        ...fragment,
        workspaceId,
      }),
    })

    // Handle different response formats
    // Format 1: { success: boolean, fragment: UsableFragment }
    if (typeof response === "object" && response !== null && "fragment" in response) {
      const wrapped = response as { fragment: UsableFragment }
      if (wrapped.fragment && typeof wrapped.fragment === "object" && "id" in wrapped.fragment) {
        return wrapped.fragment
      }
    }

    // Format 2: { success: boolean, fragmentId: string, status: string, message: string }
    // The API returns this format for async fragment creation
    if (typeof response === "object" && response !== null && "fragmentId" in response) {
      const asyncResponse = response as { fragmentId: string; status: string; message?: string }
      // For async creation, include the content we sent since we have it
      // The fragment will be persisted asynchronously, but we return the full fragment object
      return {
        id: asyncResponse.fragmentId,
        workspaceId,
        title: fragment.title,
        summary: fragment.summary,
        content: fragment.content, // Include content from input
        fragmentTypeId: fragment.fragmentTypeId,
        status: "draft" as const, // Default to draft for async fragments
        tags: fragment.tags || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    }

    // Format 3: Direct UsableFragment object
    if (typeof response === "object" && response !== null && "id" in response && !("fragmentId" in response)) {
      return response as UsableFragment
    }

    // If we get here, the response format is unexpected
    console.error("Unexpected createFragment response format:", JSON.stringify(response, null, 2))
    throw new Error(`Unexpected response format from createFragment API: ${JSON.stringify(response)}`)
  }

  /**
   * Get a memory fragment by ID
   */
  async getFragment(workspaceId: string, fragmentId: string, accessToken: string): Promise<UsableFragment> {
    const response = await this.request<unknown>(`/memory-fragments/${fragmentId}`, {
      method: "GET",
      accessToken,
      headers: {
        "X-Workspace-Id": workspaceId,
      },
    })

    // Handle different response formats
    // Format 1: { success: boolean, fragment: UsableFragment }
    if (typeof response === "object" && response !== null && "fragment" in response) {
      const wrapped = response as { fragment: UsableFragment }
      if (wrapped.fragment && typeof wrapped.fragment === "object" && "id" in wrapped.fragment) {
        return wrapped.fragment
      }
    }

    // Format 2: Direct UsableFragment object
    if (typeof response === "object" && response !== null && "id" in response) {
      return response as UsableFragment
    }

    // If we get here, the response format is unexpected
    console.error("Unexpected getFragment response format:", JSON.stringify(response, null, 2))
    throw new Error(`Unexpected response format from getFragment API: ${JSON.stringify(response)}`)
  }

  /**
   * List memory fragments by type and tags
   * Endpoint: GET /api/memory-fragments?workspaceId={id}&fragmentTypeId={typeId}&tags={tags}
   */
  async listFragments(
    workspaceId: string,
    options: {
      fragmentTypeId?: string
      tags?: string[]
      limit?: number
      offset?: number
    },
    accessToken: string
  ): Promise<UsableFragment[]> {
    const params = new URLSearchParams({
      workspaceId,
    })

    if (options.fragmentTypeId) {
      params.append("fragmentTypeId", options.fragmentTypeId)
    }

    if (options.tags && options.tags.length > 0) {
      for (const tag of options.tags) {
        params.append("tags", tag)
      }
    }

    if (options.limit) {
      params.append("limit", options.limit.toString())
    }

    if (options.offset) {
      params.append("offset", options.offset.toString())
    }

    const response = await this.request<{
      fragments?: UsableFragment[]
      success?: boolean
    }>(`/memory-fragments?${params.toString()}`, {
      method: "GET",
      accessToken,
    })

    // Handle different response formats
    if (Array.isArray(response)) {
      return response
    }
    return response.fragments || []
  }

  /**
   * Update a memory fragment
   * Endpoint: PATCH /api/memory-fragments/{fragmentId}
   */
  async updateFragment(
    workspaceId: string,
    fragmentId: string,
    fragmentData: Partial<FragmentInput>,
    accessToken: string
  ): Promise<UsableFragment> {
    const response = await this.request<{
      success: boolean
      fragment: UsableFragment
    }>(`/memory-fragments/${fragmentId}`, {
      method: "PATCH",
      accessToken,
      headers: {
        "X-Workspace-Id": workspaceId,
      },
      body: JSON.stringify(fragmentData),
    })

    return response.fragment
  }

  /**
   * Delete a memory fragment
   * Endpoint: DELETE /api/memory-fragments/{fragmentId}
   */
  async deleteFragment(workspaceId: string, fragmentId: string, accessToken: string): Promise<void> {
    await this.request(`/memory-fragments/${fragmentId}`, {
      method: "DELETE",
      accessToken,
      headers: {
        "X-Workspace-Id": workspaceId,
      },
    })
  }
}

// Export singleton instance
export const usableApi = new UsableApiService()
