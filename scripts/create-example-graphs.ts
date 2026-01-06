#!/usr/bin/env bun

/**
 * Script to create example graphs in Usable for the dashboard
 * Usage: bun scripts/create-example-graphs.ts
 */

import * as dotenv from "dotenv"
import { getServerSession } from "next-auth"
import { authOptions } from "../lib/auth"
import { createSessionPathwayForAPI } from "../lib/pathways/session-provider"
import * as dataSourceService from "../lib/services/data-source.service"
import * as graphService from "../lib/services/graph.service"

// Load environment variables
dotenv.config()

const WORKSPACE_ID = "f37b9773-0e9f-4ccd-8e85-05c5971af264" // My Life workspace
const DATA_SOURCE_NAME = "tk-child-db"

async function createExampleGraphs() {
  try {
    // Get session for access token
    const session = await getServerSession(authOptions)
    if (!session?.user?.accessToken) {
      throw new Error("No session found. Please ensure you're authenticated.")
    }

    const accessToken = session.user.accessToken

    // Find the data source
    console.log(`🔍 Looking for data source: ${DATA_SOURCE_NAME}`)
    const dataSources = await dataSourceService.listDataSources(WORKSPACE_ID, accessToken)
    const dataSource = dataSources.find((ds: { name: string }) => ds.name === DATA_SOURCE_NAME)

    if (!dataSource) {
      throw new Error(
        `Data source '${DATA_SOURCE_NAME}' not found. Available: ${dataSources.map((d: { name: string }) => d.name).join(", ")}`
      )
    }

    console.log(`✅ Found data source: ${dataSource.name} (ID: ${dataSource.fragmentId})\n`)

    // Create session pathway for graph creation
    const sessionContext = await createSessionPathwayForAPI()
    if (!sessionContext) {
      throw new Error("Failed to create session context")
    }

    const graphs = [
      {
        title: "Hours Over Time",
        type: "line" as const,
        query: `SELECT date, SUM(hours) as total_hours FROM public.hours WHERE date IS NOT NULL GROUP BY date ORDER BY date`,
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

    console.log("📊 Creating example graphs...\n")

    for (const graphDef of graphs) {
      try {
        console.log(`Creating ${graphDef.type} chart: ${graphDef.title}`)

        const result = await graphService.createGraph(
          sessionContext.pathway,
          WORKSPACE_ID,
          {
            title: graphDef.title,
            dataSourceRef: dataSource.fragmentId,
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
          },
          accessToken
        )

        console.log(`  ✅ Created graph: ${result.graphId}`)
        console.log(`  📝 ${graphDef.description}\n`)
      } catch (error) {
        console.error(`  ❌ Failed to create graph '${graphDef.title}':`, error)
      }
    }

    console.log("✅ Example graphs created successfully!")
    console.log("\n💡 Next steps:")
    console.log("   1. Go to your dashboard in the browser")
    console.log("   2. Click 'Add Graph' to add these graphs to your dashboard")
    console.log("   3. Or use the graph IDs above to add them programmatically")
  } catch (error) {
    console.error("❌ Error creating example graphs:", error)
    throw error
  }
}

createExampleGraphs().catch((error) => {
  console.error("Fatal error:", error)
  process.exit(1)
})
