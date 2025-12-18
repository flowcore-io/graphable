import { testConnectionString } from "@/lib/services/data-source.service"
import { NextResponse } from "next/server"
import { z } from "zod"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const testConnectionSchema = z.object({
  connectionString: z.string().min(1, "Connection string is required"),
})

/**
 * Test PostgreSQL connection directly without storing the secret
 * POST /api/data-sources/test-connection
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const validated = testConnectionSchema.parse(body)

    const result = await testConnectionString(validated.connectionString)

    return NextResponse.json(result)
  } catch (error) {
    console.error("Failed to test connection:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to test connection",
      },
      { status: 400 }
    )
  }
}





