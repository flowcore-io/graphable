import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * Public health check endpoint
 * Used to verify the application is running and responding
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "graphable",
    version: process.env.npm_package_version || "unknown",
  })
}
