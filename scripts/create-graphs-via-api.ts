#!/usr/bin/env bun

/**
 * Script to create example graphs via API calls
 * This script creates graphs directly using fetch API calls
 *
 * Usage:
 * 1. Make sure you're logged in to the app (have a valid session cookie)
 * 2. Get your session cookie from browser DevTools -> Application -> Cookies
 * 3. Set SESSION_COOKIE environment variable or pass as argument
 * 4. Run: bun scripts/create-graphs-via-api.ts [session-cookie]
 */

import * as dotenv from "dotenv"

// Load environment variables
dotenv.config()

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3001"
const WORKSPACE_ID = "f37b9773-0e9f-4ccd-8e85-05c5971af264" // My Life workspace
const DASHBOARD_ID = "c68256b6-ba84-411a-8575-8f8e693c1977" // MrDashy dashboard
const DATA_SOURCE_ID = "8f6ff67c-3614-42a9-8580-593efde93cf1" // tk-child-db

// Get session cookie from args or env
const sessionCookie = process.argv[2] || process.env.SESSION_COOKIE

if (!sessionCookie) {
  console.error("❌ Session cookie required!")
  console.error("Usage: bun scripts/create-graphs-via-api.ts <session-cookie>")
  console.error("Or set SESSION_COOKIE environment variable")
  console.error("\nTo get your session cookie:")
  console.error("1. Open browser DevTools (F12)")
  console.error("2. Go to Application/Storage -> Cookies")
  console.error("3. Find the session cookie (usually named 'next-auth.session-token' or similar)")
  console.error("4. Copy its value")
  process.exit(1)
}

const graphs = [
  {
    title: "Hours Over Time",
    type: "line" as const,
    query: `SELECT date, SUM(hours) as total_hours FROM public.hours WHERE date IS NOT NULL GROUP BY date ORDER BY date LIMIT 100`,
    description: "Total hours worked over time",
  },
  {
    title: "Capacity by Institution Type",
    type: "bar" as const,
    query: `SELECT institution_type_id as type, SUM(capacity) as total_capacity FROM public.admitted_annual_child_capacity GROUP BY institution_type_id ORDER BY total_capacity DESC`,
    description: "Total capacity grouped by institution type",
  },
  {
    title: "Institution Type Distribution",
    type: "pie" as const,
    query: `SELECT institution_type_id as type, COUNT(*) as count FROM public.institutions WHERE institution_type_id IS NOT NULL GROUP BY institution_type_id ORDER BY count DESC LIMIT 10`,
    description: "Distribution of institutions by type",
  },
  {
    title: "Institutions Overview",
    type: "table" as const,
    query: `SELECT name, institution_type_id, enrolled, date FROM public.institutions WHERE date IS NOT NULL ORDER BY date DESC LIMIT 100`,
    description: "Recent institutions with enrollment data",
  },
]

async function createGraphs() {
  console.log("📊 Creating example graphs via API...\n")

  const createdGraphs: Array<{ id: string; title: string; type: string }> = []

  for (const graphDef of graphs) {
    try {
      console.log(`Creating ${graphDef.type} chart: ${graphDef.title}`)

      // Create graph
      const createResponse = await fetch(`${BASE_URL}/api/graphs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Workspace-Id": WORKSPACE_ID,
          ...(sessionCookie && { Cookie: sessionCookie }),
        },
        body: JSON.stringify({
          title: graphDef.title,
          dataSourceRef: DATA_SOURCE_ID,
          query: {
            dialect: "sql",
            text: graphDef.query,
            parameters: [],
          },
          parameterSchema: {
            parameters: [],
          },
          visualization: {
            type: graphDef.type,
            options: {},
          },
        }),
      })

      if (!createResponse.ok) {
        const errorData = await createResponse.json()
        throw new Error(errorData.error || `HTTP ${createResponse.status}`)
      }

      const createResult = await createResponse.json()
      const graphId = createResult.graphId

      console.log(`  ✅ Created graph: ${graphId}`)
      console.log(`  📝 ${graphDef.description}`)

      createdGraphs.push({ id: graphId, title: graphDef.title, type: graphDef.type })

      // Get current dashboard layout
      const dashboardResponse = await fetch(`${BASE_URL}/api/dashboards/${DASHBOARD_ID}`, {
        headers: {
          "X-Workspace-Id": WORKSPACE_ID,
          ...(sessionCookie && { Cookie: sessionCookie }),
        },
      })

      if (!dashboardResponse.ok) {
        console.warn(`  ⚠️  Failed to fetch dashboard, skipping add to dashboard`)
        continue
      }

      const dashboardData = await dashboardResponse.json()
      const currentLayout = dashboardData.dashboard.layout || {
        grid: { columns: 12, rows: 8 },
        tiles: [],
      }

      // Calculate position for new tile (add at bottom)
      const maxY =
        currentLayout.tiles.length > 0
          ? Math.max(
              ...currentLayout.tiles.map(
                (tile: { position: { y: number; h: number } }) => tile.position.y + tile.position.h
              ),
              0
            )
          : 0

      // Calculate x position (place in a grid pattern)
      const tileIndex = createdGraphs.length - 1
      const x = (tileIndex % 3) * 4 // 3 columns, each graph is 4 units wide
      const y = Math.floor(tileIndex / 3) * 3 + maxY // 3 rows tall, stack vertically

      const updatedTiles = [
        ...currentLayout.tiles,
        {
          graphRef: graphId,
          position: {
            x,
            y,
            w: 4, // 4 columns wide
            h: 3, // 3 rows tall
          },
        },
      ]

      // Update dashboard with new tile
      const updateResponse = await fetch(`${BASE_URL}/api/dashboards/${DASHBOARD_ID}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Workspace-Id": WORKSPACE_ID,
          ...(sessionCookie && { Cookie: sessionCookie }),
        },
        body: JSON.stringify({
          layout: {
            ...currentLayout,
            tiles: updatedTiles,
          },
        }),
      })

      if (!updateResponse.ok) {
        console.warn(`  ⚠️  Failed to add graph to dashboard, but graph was created`)
      } else {
        console.log(`  ✅ Added to dashboard at position (${x}, ${y})`)
      }

      console.log("")
    } catch (error) {
      console.error(`  ❌ Failed to create graph '${graphDef.title}':`, error)
      if (error instanceof Error) {
        console.error(`     ${error.message}`)
      }
    }
  }

  console.log("=".repeat(80))
  console.log("✅ Graph creation complete!")
  console.log(`\nCreated ${createdGraphs.length} graphs:`)
  createdGraphs.forEach((g) => {
    console.log(`  • ${g.title} (${g.type}) - ID: ${g.id}`)
  })
  console.log(`\n💡 View your dashboard at:`)
  console.log(`   ${BASE_URL}/dashboards/${DASHBOARD_ID}`)
}

createGraphs().catch((error) => {
  console.error("Fatal error:", error)
  process.exit(1)
})
