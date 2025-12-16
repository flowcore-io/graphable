import { pathwaysRouter } from "@/lib/pathways/pathways"
import { type NextRequest, NextResponse } from "next/server"

/**
 * Control plane transformer endpoint for Flowcore Pathways
 * Processes events from Flowcore webhook system
 */
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  try {
    const event = await request.json()
    const secret = request.headers.get("x-secret") ?? ""

    console.log("Received event", {
      flowType: event.flowType,
      eventType: event.eventType,
      eventId: event.eventId,
    })

    // Process event through Pathways router
    await pathwaysRouter.processEvent(event, secret)

    return new NextResponse("OK", { status: 200 })
  } catch (error) {
    console.error("Error processing event", { error })
    return new NextResponse((error as Error).message || "Internal server error", { status: 500 })
  }
}



