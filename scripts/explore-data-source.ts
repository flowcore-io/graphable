#!/usr/bin/env bun

/**
 * Script to explore a data source and understand its structure
 * Usage: bun scripts/explore-data-source.ts [data-source-name]
 */

import { Client } from "pg"
import * as dotenv from "dotenv"

// Load environment variables
dotenv.config()

const DATA_SOURCE_NAME = process.argv[2] || "tk-child-db"
const CONNECTION_STRING = process.env.DATA_SOURCE_CONNECTION_STRING

if (!CONNECTION_STRING) {
  console.error("❌ DATA_SOURCE_CONNECTION_STRING not found in .env file")
  process.exit(1)
}

// Parse connection string
const url = new URL(CONNECTION_STRING)
const sslMode = url.searchParams.get("sslmode") || "prefer"

// Determine SSL config
let ssl: boolean | { rejectUnauthorized?: boolean } = false
if (sslMode === "require" || sslMode === "verify-ca" || sslMode === "verify-full") {
  ssl = { rejectUnauthorized: sslMode === "verify-full" || sslMode === "verify-ca" }
}

const client = new Client({
  host: url.hostname,
  port: parseInt(url.port || "5432", 10),
  database: url.pathname.slice(1), // Remove leading /
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password || ""),
  ssl,
  connectionTimeoutMillis: 10000,
})

async function exploreDatabase() {
  try {
    console.log(`🔌 Connecting to database: ${url.database}@${url.hostname}`)
    await client.connect()
    console.log("✅ Connected successfully!\n")

    // List all tables
    console.log("📊 Listing tables...")
    const tablesResult = await client.query(`
      SELECT schemaname, tablename, tableowner
      FROM pg_tables
      WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
      ORDER BY schemaname, tablename
    `)

    console.log(`\nFound ${tablesResult.rows.length} tables:\n`)
    const tables: Array<{ schema: string; name: string }> = []

    for (const row of tablesResult.rows) {
      const schema = row.schemaname
      const table = row.tablename
      tables.push({ schema, name: table })
      console.log(`  📋 ${schema}.${table}`)
    }

    // Explore each table
    console.log("\n" + "=".repeat(80))
    console.log("📈 Exploring table structures and sample data...\n")

    for (const { schema, name } of tables) {
      console.log(`\n${"─".repeat(80)}`)
      console.log(`📋 Table: ${schema}.${name}`)
      console.log(`${"─".repeat(80)}`)

      // Get column information
      const columnsResult = await client.query(
        `
        SELECT
          a.attname AS column_name,
          pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type,
          a.attnotnull AS not_null,
          a.atthasdef AS has_default
        FROM pg_catalog.pg_attribute a
        JOIN pg_catalog.pg_class c ON a.attrelid = c.oid
        JOIN pg_catalog.pg_namespace n ON c.relnamespace = n.oid
        WHERE c.relname = $1
          AND n.nspname = $2
          AND a.attnum > 0
          AND NOT a.attisdropped
        ORDER BY a.attnum
      `,
        [name, schema]
      )

      console.log("\nColumns:")
      const columns: string[] = []
      for (const col of columnsResult.rows) {
        columns.push(col.column_name)
        const nullable = col.not_null ? "NOT NULL" : "NULL"
        console.log(`  • ${col.column_name}: ${col.data_type} (${nullable})`)
      }

      // Get row count
      const countResult = await client.query(
        `SELECT COUNT(*) as count FROM "${schema}"."${name}"`
      )
      const rowCount = parseInt(countResult.rows[0].count, 10)
      console.log(`\nRow count: ${rowCount}`)

      // Sample rows (up to 5)
      if (rowCount > 0) {
        console.log("\nSample data (first 5 rows):")
        const sampleResult = await client.query(
          `SELECT * FROM "${schema}"."${name}" LIMIT 5`
        )

        if (sampleResult.rows.length > 0) {
          // Print header
          console.log("\n  " + columns.join(" | "))
          console.log("  " + "-".repeat(columns.join(" | ").length))

          // Print rows
          for (const row of sampleResult.rows) {
            const values = columns.map((col) => {
              const val = row[col]
              if (val === null) return "NULL"
              if (typeof val === "object") return JSON.stringify(val).slice(0, 50)
              return String(val).slice(0, 50)
            })
            console.log("  " + values.join(" | "))
          }
        }
      }

      // Suggest graph queries
      console.log("\n💡 Suggested graph queries:")
      
      // Check for date/timestamp columns
      const dateColumns = columnsResult.rows
        .filter((col) => col.data_type.includes("date") || col.data_type.includes("timestamp"))
        .map((col) => col.column_name)

      // Check for numeric columns
      const numericColumns = columnsResult.rows
        .filter((col) => {
          const type = col.data_type.toLowerCase()
          return (
            type.includes("int") ||
            type.includes("numeric") ||
            type.includes("decimal") ||
            type.includes("float") ||
            type.includes("double") ||
            type.includes("real")
          )
        })
        .map((col) => col.column_name)

      // Check for text/categorical columns
      const textColumns = columnsResult.rows
        .filter((col) => {
          const type = col.data_type.toLowerCase()
          return type.includes("text") || type.includes("varchar") || type.includes("char")
        })
        .map((col) => col.column_name)

      if (dateColumns.length > 0 && numericColumns.length > 0) {
        console.log(`\n  📈 Time Series (Line/Bar Chart):`)
        console.log(
          `     SELECT ${dateColumns[0]} as date, ${numericColumns[0]} as value FROM "${schema}"."${name}" ORDER BY ${dateColumns[0]}`
        )
      }

      if (textColumns.length > 0 && numericColumns.length > 0) {
        console.log(`\n  📊 Bar Chart (by category):`)
        console.log(
          `     SELECT ${textColumns[0]} as category, SUM(${numericColumns[0]}) as total FROM "${schema}"."${name}" GROUP BY ${textColumns[0]} ORDER BY total DESC`
        )

        console.log(`\n  🥧 Pie Chart (distribution):`)
        console.log(
          `     SELECT ${textColumns[0]} as category, COUNT(*) as count FROM "${schema}"."${name}" GROUP BY ${textColumns[0]} ORDER BY count DESC LIMIT 10`
        )
      }

      if (columns.length > 0) {
        console.log(`\n  📋 Table View:`)
        console.log(`     SELECT * FROM "${schema}"."${name}" LIMIT 100`)
      }
    }

    console.log("\n" + "=".repeat(80))
    console.log("✅ Exploration complete!")
  } catch (error) {
    console.error("❌ Error exploring database:", error)
    throw error
  } finally {
    await client.end()
    console.log("\n🔌 Disconnected from database")
  }
}

exploreDatabase().catch((error) => {
  console.error("Fatal error:", error)
  process.exit(1)
})




