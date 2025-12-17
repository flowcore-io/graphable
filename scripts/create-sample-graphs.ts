#!/usr/bin/env bun

/**
 * Script to create sample graphs in Usable for the tk-child-db data source
 * Usage: bun scripts/create-sample-graphs.ts
 * 
 * Requires USABLE_ACCESS_TOKEN environment variable or will prompt for it
 */

import { config } from "dotenv"
import { UsableApiService } from "../lib/services/usable-api.service"
import { ulid } from "ulid"

// Load environment variables
config()

const WORKSPACE_ID = "60c10ca2-4115-4c1a-b6d7-04ac39fd3938" // my-life workspace
const DATA_SOURCE_NAME = "tk-child-db"
const GRAPHABLE_VERSION = "0.2.0"
const GRAPHABLE_APP_TAG = "app:graphable"

async function createSampleGraphs() {
  // Get access token from environment or prompt
  const accessToken = process.env.USABLE_ACCESS_TOKEN || process.env.USABLE_CLIENT_SECRET

  if (!accessToken) {
    console.error("❌ USABLE_ACCESS_TOKEN or USABLE_CLIENT_SECRET not found in environment")
    console.error("   Please set USABLE_ACCESS_TOKEN in your .env file")
    process.exit(1)
  }

  const usableApi = new UsableApiService()

  console.log("🔍 Finding data source...\n")

  // Find the data source fragment type
  const fragmentTypeId = await usableApi.getFragmentTypeIdByName(WORKSPACE_ID, "data-sources", accessToken)
  if (!fragmentTypeId) {
    console.error("❌ Fragment type 'data-sources' not found")
    process.exit(1)
  }

  // List data sources
  const fragments = await usableApi.listFragments(
    WORKSPACE_ID,
    {
      fragmentTypeId,
      tags: [GRAPHABLE_APP_TAG, "type:data-source"],
    },
    accessToken
  )

  const dataSource = fragments.find((f) => {
    try {
      const content = JSON.parse(f.content || "{}")
      return content.name === DATA_SOURCE_NAME
    } catch {
      return false
    }
  })

  if (!dataSource) {
    console.error(`❌ Data source "${DATA_SOURCE_NAME}" not found`)
    console.log("\nAvailable data sources:")
    fragments.forEach((f) => {
      try {
        const content = JSON.parse(f.content || "{}")
        console.log(`  - ${content.name} (${f.id})`)
      } catch {
        console.log(`  - ${f.title} (${f.id})`)
      }
    })
    process.exit(1)
  }

  console.log(`✅ Found data source: ${DATA_SOURCE_NAME} (${dataSource.id})\n`)

  // Get graph fragment type
  const graphFragmentTypeId = await usableApi.getFragmentTypeIdByName(WORKSPACE_ID, "graphs", accessToken)
  if (!graphFragmentTypeId) {
    console.error("❌ Fragment type 'graphs' not found")
    process.exit(1)
  }

  const graphs = [
    {
      title: "Capacity by Year (Line Chart)",
      description: "Shows capacity trends over years",
      query: {
        dialect: "sql" as const,
        text: `
          SELECT 
            year,
            SUM(capacity) as total_capacity
          FROM admitted_annual_child_capacity
          GROUP BY year
          ORDER BY year
        `.trim(),
        parameters: [],
      },
      visualization: {
        type: "line" as const,
        options: {
          colors: ["#8884d8"],
        },
      },
    },
    {
      title: "Costs by Institution Type (Bar Chart)",
      description: "Department costs grouped by institution type",
      query: {
        dialect: "sql" as const,
        text: `
          SELECT 
            type,
            SUM(department_cost) as total_cost
          FROM admitted_annual_child_costs
          WHERE year = 2024
          GROUP BY type
          ORDER BY total_cost DESC
        `.trim(),
        parameters: [],
      },
      visualization: {
        type: "bar" as const,
        options: {
          colors: ["#82ca9d"],
        },
      },
    },
    {
      title: "Cost Distribution by Type (Pie Chart)",
      description: "Cost distribution across institution types",
      query: {
        dialect: "sql" as const,
        text: `
          SELECT 
            type,
            SUM(department_cost) as total_cost
          FROM admitted_annual_child_costs
          WHERE year = 2024
          GROUP BY type
        `.trim(),
        parameters: [],
      },
      visualization: {
        type: "pie" as const,
        options: {
          colors: ["#8884d8", "#82ca9d", "#ffc658", "#ff7300", "#00ff00"],
        },
      },
    },
    {
      title: "Capacity Overview (Table)",
      description: "Detailed capacity data by facility",
      query: {
        dialect: "sql" as const,
        text: `
          SELECT 
            facility_name,
            institution_type_id,
            capacity,
            year
          FROM admitted_annual_child_capacity
          WHERE year = 2024
          ORDER BY facility_name, institution_type_id
          LIMIT 50
        `.trim(),
        parameters: [],
      },
      visualization: {
        type: "table" as const,
        options: {},
      },
    },
    {
      title: "Costs by Year (Line Chart)",
      description: "Total costs over time with parameter",
      query: {
        dialect: "sql" as const,
        text: `
          SELECT 
            year,
            SUM(department_cost) as total_cost
          FROM admitted_annual_child_costs
          WHERE year >= :minYear
          GROUP BY year
          ORDER BY year
        `.trim(),
        parameters: [
          {
            name: "minYear",
            type: "number" as const,
            required: true,
            default: 2022,
          },
        ],
      },
      visualization: {
        type: "line" as const,
        options: {
          colors: ["#ff7300"],
        },
      },
    },
  ]

  console.log(`📊 Creating ${graphs.length} sample graphs...\n`)

  for (const graphData of graphs) {
    try {
      console.log(`Creating: ${graphData.title}...`)

      const fragmentContentUlid = ulid()
      const fragmentKey = `graph:${fragmentContentUlid}`

      const fragmentContent = {
        id: fragmentContentUlid,
        title: graphData.title,
        dataSourceRef: dataSource.id,
        query: graphData.query,
        parameterSchema: {
          parameters: graphData.query.parameters,
        },
        visualization: graphData.visualization,
      }

      const fragment = await usableApi.createFragment(WORKSPACE_ID, {
        workspaceId: WORKSPACE_ID,
        title: graphData.title,
        key: fragmentKey,
        content: JSON.stringify(fragmentContent, null, 2),
        summary: `Graph: ${graphData.title}`,
        tags: [GRAPHABLE_APP_TAG, "type:graph", `version:${GRAPHABLE_VERSION}`, `workspace:${WORKSPACE_ID}`],
        fragmentTypeId: graphFragmentTypeId,
      }, accessToken)

      console.log(`  ✅ Created graph: ${fragment.id}`)
      console.log(`     Fragment ID: ${fragment.id}\n`)
    } catch (error) {
      console.error(`  ❌ Failed to create graph "${graphData.title}":`, error)
      if (error instanceof Error) {
        console.error(`     ${error.message}\n`)
      }
    }
  }

  console.log("✅ Sample graphs creation complete!")
  console.log("\n💡 You can now view these graphs in the dashboard at http://localhost:3000/dashboards")
}

createSampleGraphs()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error("❌ Script failed:", error)
    process.exit(1)
  })
