import type { FlowcoreEvent } from "@flowcore/pathways"
import type { EventDashboardCreated, EventDashboardDeleted, EventDashboardUpdated } from "./dashboard.0"

/**
 * Handler for dashboard.created.0 event
 * Cache removed - all data comes from Usable fragments, so this handler is a no-op
 */
export async function handlerDashboardCreated(event: FlowcoreEvent<EventDashboardCreated>) {
  console.log(`Processing dashboard.created.0: ${event.eventId}`)
  const { dashboardId, fragmentId } = event.payload
  console.log(`✅ Dashboard created: ${dashboardId} (fragment: ${fragmentId}) - data stored in Usable`)
}

/**
 * Handler for dashboard.updated.0 event
 * Cache removed - all data comes from Usable fragments, so this handler is a no-op
 */
export async function handlerDashboardUpdated(event: FlowcoreEvent<EventDashboardUpdated>) {
  console.log(`Processing dashboard.updated.0: ${event.eventId}`)
  const { dashboardId, fragmentId } = event.payload
  console.log(`✅ Dashboard updated: ${dashboardId} (fragment: ${fragmentId}) - data stored in Usable`)
}

/**
 * Handler for dashboard.deleted.0 event
 * Cache removed - all data comes from Usable fragments, so this handler is a no-op
 */
export async function handlerDashboardDeleted(event: FlowcoreEvent<EventDashboardDeleted>) {
  console.log(`Processing dashboard.deleted.0: ${event.eventId}`)
  const { fragmentId } = event.payload
  console.log(`✅ Dashboard deleted: fragment ${fragmentId} - data removed from Usable`)
}
