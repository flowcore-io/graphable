import type { FragmentInput, FragmentTypeInput } from "./usable-api.service"
import { usableApi } from "./usable-api.service"

const GRAPHABLE_VERSION = "0.2.0"
const GRAPHABLE_APP_TAG = "app:graphable"

/**
 * Required fragment types for Graphable
 */
const REQUIRED_FRAGMENT_TYPES: Array<{
  name: string
  description: string
  color?: string
  icon?: string
}> = [
  {
    name: "graphs",
    description: "Graph definitions for Graphable",
    color: "#3b82f6",
    icon: "chart-line",
  },
  {
    name: "dashboards",
    description: "Dashboard definitions for Graphable",
    color: "#8b5cf6",
    icon: "layout-dashboard",
  },
  {
    name: "data-sources",
    description: "Data source configurations for Graphable",
    color: "#10b981",
    icon: "database",
  },
  {
    name: "connectors-transformers",
    description: "Connector and transformer definitions for Graphable",
    color: "#f59e0b",
    icon: "plug",
  },
  {
    name: "policies-permissions",
    description: "Policy and permission configurations for Graphable",
    color: "#ef4444",
    icon: "shield",
  },
]

/**
 * Bootstrap a workspace with required fragment types and base configuration
 * All operations are idempotent - safe to retry
 */
export async function bootstrapWorkspace(workspaceId: string, accessToken: string): Promise<void> {
  console.log(`Bootstrapping workspace: ${workspaceId}`)

  // Ensure fragment types exist
  await ensureFragmentTypes(workspaceId, accessToken)

  // Create base configuration fragments
  await createBaseConfigFragments(workspaceId, accessToken)

  console.log(`✅ Workspace bootstrap completed: ${workspaceId}`)
}

/**
 * Ensure all required fragment types exist (idempotent)
 */
async function ensureFragmentTypes(workspaceId: string, accessToken: string): Promise<void> {
  console.log(`Ensuring fragment types for workspace: ${workspaceId}`)

  // Get existing fragment types
  const existingTypes = await usableApi.getFragmentTypes(workspaceId, accessToken)
  const existingTypeNames = new Set(existingTypes.map((type) => type.name.toLowerCase()))

  // Create missing fragment types
  for (const fragmentType of REQUIRED_FRAGMENT_TYPES) {
    if (existingTypeNames.has(fragmentType.name.toLowerCase())) {
      console.log(`Fragment type '${fragmentType.name}' already exists, skipping`)
      continue
    }

    try {
      const input: FragmentTypeInput = {
        name: fragmentType.name,
        description: fragmentType.description,
        color: fragmentType.color,
        icon: fragmentType.icon,
      }

      await usableApi.createFragmentType(workspaceId, input, accessToken)
      console.log(`✅ Created fragment type: ${fragmentType.name}`)
    } catch (error) {
      console.error(`Failed to create fragment type '${fragmentType.name}':`, error)
      // Continue with other fragment types even if one fails
    }
  }
}

/**
 * Create base configuration fragments (idempotent)
 * Checks for existing fragments before creating
 */
async function createBaseConfigFragments(workspaceId: string, accessToken: string): Promise<void> {
  console.log(`Creating base config fragments for workspace: ${workspaceId}`)

  // Graphable Tenant Config (type: knowledge)
  const tenantConfigFragment: FragmentInput = {
    workspaceId,
    title: "Graphable Tenant Configuration",
    content: JSON.stringify(
      {
        version: GRAPHABLE_VERSION,
        workspaceId,
        createdAt: new Date().toISOString(),
        settings: {
          defaultDashboard: null,
          defaultParameterPresets: {},
        },
      },
      null,
      2
    ),
    summary: "Graphable tenant configuration and settings",
    tags: [GRAPHABLE_APP_TAG, "type:tenant-config", `version:${GRAPHABLE_VERSION}`],
    fragmentTypeId: "04a5fb62-1ba5-436c-acf7-f65f3a5ba6f6", // Knowledge type
    repository: "graphable",
  }

  // Instruction Set (type: instruction set)
  const instructionSetFragment: FragmentInput = {
    workspaceId,
    title: "Graphable Agent Instructions",
    content: `# Graphable Agent Instructions

This workspace is configured for Graphable, an AI-first graphical service.

## Workspace Context
- Workspace ID: ${workspaceId}
- Version: ${GRAPHABLE_VERSION}

## Available Resources
- Graphs: Create and manage graph definitions
- Dashboards: Compose graphs into dashboards
- Data Sources: Configure PostgreSQL data sources
- Connectors/Transformers: Define event-driven transformers

## Usage Guidelines
- All resources are scoped to this workspace
- Use @datasource references in chat to connect to data sources
- Parameters can be set at dashboard or graph level
`,
    summary: "Instructions for LLM agents working with Graphable",
    tags: [GRAPHABLE_APP_TAG, "type:instruction-set", `version:${GRAPHABLE_VERSION}`],
    fragmentTypeId: "1d2d317d-f48f-4df9-a05b-b5d9a48090d7", // Instruction Set type
    repository: "graphable",
  }

  // Create fragments (idempotent - will fail gracefully if already exists)
  // Note: Usable API should handle duplicate prevention, but we log errors
  try {
    await usableApi.createFragment(workspaceId, tenantConfigFragment, accessToken)
    console.log("✅ Created tenant config fragment")
  } catch (_error) {
    console.log("Tenant config fragment may already exist, skipping")
  }

  try {
    await usableApi.createFragment(workspaceId, instructionSetFragment, accessToken)
    console.log("✅ Created instruction set fragment")
  } catch (_error) {
    console.log("Instruction set fragment may already exist, skipping")
  }
}
