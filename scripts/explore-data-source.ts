#!/usr/bin/env bun

/**
 * Script to explore a data source and understand its schema
 * Usage: bun scripts/explore-data-source.ts
 */

import { config } from "dotenv"
import postgres from "postgres"

// Load environment variables
config()

const CONNECTION_STRING = process.env.DATA_SOURCE_CONNECTION_STRING

if (!CONNECTION_STRING) {
  console.error("❌ DATA_SOURCE_CONNECTION_STRING not found in .env file")
  process.exit(1)
}

async function exploreDatabase() {
  console.log("🔍 Connecting to database...\n")

  const sql = postgres(CONNECTION_STRING, {
    max: 1,
  })

  try {
    // List all schemas
    console.log("📋 SCHEMAS:")
    const schemas = await sql`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
      ORDER BY schema_name
    `
    console.table(schemas)

    // List all tables
    console.log("\n📊 TABLES:")
    const tables = await sql`
      SELECT 
        table_schema,
        table_name,
        table_type
      FROM information_schema.tables
      WHERE table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
      ORDER BY table_schema, table_name
    `
    console.table(tables)

    // Get detailed info for each table
    console.log("\n📝 TABLE DETAILS:\n")
    for (const table of tables) {
      const schema = table.table_schema
      const tableName = table.table_name

      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
      console.log(`📌 ${schema}.${tableName}`)
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)

      // Get columns
      const columns = await sql`
        SELECT 
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_schema = ${schema} AND table_name = ${tableName}
        ORDER BY ordinal_position
      `
      console.log("\nColumns:")
      console.table(columns)

      // Get row count
      const countResult = await sql`
        SELECT COUNT(*) as count
        FROM ${sql(schema)}.${sql(tableName)}
      `
      const rowCount = countResult[0]?.count || 0
      console.log(`\nRow count: ${rowCount}`)

      // Sample rows (limit 5)
      if (Number(rowCount) > 0) {
        const sampleRows = await sql`
          SELECT *
          FROM ${sql(schema)}.${sql(tableName)}
          LIMIT 5
        `
        console.log("\nSample rows:")
        console.table(sampleRows)
      }

      // Check for date/timestamp columns (useful for time series)
      const dateColumns = columns.filter(
        (col) =>
          col.data_type === "timestamp without time zone" ||
          col.data_type === "timestamp with time zone" ||
          col.data_type === "date" ||
          col.data_type === "time without time zone"
      )
      if (dateColumns.length > 0) {
        console.log("\n📅 Date/Time columns found:")
        dateColumns.forEach((col) => {
          console.log(`  - ${col.column_name} (${col.data_type})`)
        })
      }

      // Check for numeric columns (useful for aggregations)
      const numericColumns = columns.filter(
        (col) =>
          col.data_type === "integer" ||
          col.data_type === "bigint" ||
          col.data_type === "smallint" ||
          col.data_type === "numeric" ||
          col.data_type === "real" ||
          col.data_type === "double precision" ||
          col.data_type === "decimal"
      )
      if (numericColumns.length > 0) {
        console.log("\n🔢 Numeric columns found:")
        numericColumns.forEach((col) => {
          console.log(`  - ${col.column_name} (${col.data_type})`)
        })
      }
    }

    // Suggest graph queries
    console.log("\n\n✨ SUGGESTED GRAPH QUERIES:\n")
    for (const table of tables) {
      const schema = table.table_schema
      const tableName = table.table_name

      const columns = await sql`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = ${schema} AND table_name = ${tableName}
        ORDER BY ordinal_position
      `

      const dateColumns = columns.filter(
        (col) =>
          col.data_type === "timestamp without time zone" ||
          col.data_type === "timestamp with time zone" ||
          col.data_type === "date"
      )
      const numericColumns = columns.filter(
        (col) =>
          col.data_type === "integer" ||
          col.data_type === "bigint" ||
          col.data_type === "numeric" ||
          col.data_type === "real" ||
          col.data_type === "double precision"
      )

      if (dateColumns.length > 0 && numericColumns.length > 0) {
        const dateCol = dateColumns[0].column_name
        const numericCol = numericColumns[0].column_name

        console.log(`📈 Time Series (Line Chart) - ${schema}.${tableName}:`)
        console.log(
          `   SELECT ${dateCol}, ${numericCol} FROM ${schema}.${tableName} WHERE ${dateCol} >= NOW() - INTERVAL '30 days' ORDER BY ${dateCol}`
        )

        console.log(`\n📊 Bar Chart - ${schema}.${tableName}:`)
        console.log(`   SELECT ${dateCol}, SUM(${numericCol}) as total FROM ${schema}.${tableName} GROUP BY ${dateCol} ORDER BY ${dateCol}`)

        console.log(`\n🥧 Pie Chart - ${schema}.${tableName}:`)
        const categoryColumns = columns.filter((col) => col.data_type === "character varying" || col.data_type === "text")
        if (categoryColumns.length > 0) {
          const categoryCol = categoryColumns[0].column_name
          console.log(`   SELECT ${categoryCol}, COUNT(*) as count FROM ${schema}.${tableName} GROUP BY ${categoryCol}`)
        }
      }

      console.log(`\n📋 Table View - ${schema}.${tableName}:`)
      console.log(`   SELECT * FROM ${schema}.${tableName} LIMIT 100`)

      console.log("\n" + "─".repeat(60) + "\n")
    }
  } catch (error) {
    console.error("❌ Error exploring database:", error)
    throw error
  } finally {
    await sql.end()
  }
}

exploreDatabase()
  .then(() => {
    console.log("\n✅ Exploration complete!")
    process.exit(0)
  })
  .catch((error) => {
    console.error("\n❌ Exploration failed:", error)
    process.exit(1)
  })
