import type { FlowcoreEvent } from "@flowcore/pathways"
import type { EventGraphCreated, EventGraphDeleted, EventGraphUpdated } from "./graph.0"

/**
 * Handler for graph.created.0 event
 * Cache removed - all data comes from Usable fragments, so this handler is a no-op
 */
export async function handlerGraphCreated(event: FlowcoreEvent<EventGraphCreated>) {
  console.log(`Processing graph.created.0: ${event.eventId}`)
  const { graphId, fragmentId } = event.payload
  console.log(`✅ Graph created: ${graphId} (fragment: ${fragmentId}) - data stored in Usable`)
}

/**
 * Handler for graph.updated.0 event
 * Cache removed - all data comes from Usable fragments, so this handler is a no-op
 */
export async function handlerGraphUpdated(event: FlowcoreEvent<EventGraphUpdated>) {
  console.log(`Processing graph.updated.0: ${event.eventId}`)
  const { graphId, fragmentId } = event.payload
  console.log(`✅ Graph updated: ${graphId} (fragment: ${fragmentId}) - data stored in Usable`)
}

/**
 * Handler for graph.deleted.0 event
 * Cache removed - all data comes from Usable fragments, so this handler is a no-op
 */
export async function handlerGraphDeleted(event: FlowcoreEvent<EventGraphDeleted>) {
  console.log(`Processing graph.deleted.0: ${event.eventId}`)
  const { fragmentId } = event.payload
  console.log(`✅ Graph deleted: fragment ${fragmentId} - data removed from Usable`)
}
