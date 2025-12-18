import type { FlowcoreEvent } from "@flowcore/pathways"
import type { EventDataSourceCreated, EventDataSourceDeleted, EventDataSourceUpdated } from "./datasource.0"

/**
 * Handler for datasource.created.0 event
 * Cache removed - all data comes from Usable fragments, so this handler is a no-op
 */
export async function handlerDataSourceCreated(event: FlowcoreEvent<EventDataSourceCreated>) {
  console.log(`Processing datasource.created.0: ${event.eventId}`)
  const { dataSourceId, fragmentId } = event.payload
  console.log(`✅ Data source created: ${dataSourceId} (fragment: ${fragmentId}) - data stored in Usable`)
}

/**
 * Handler for datasource.updated.0 event
 * Cache removed - all data comes from Usable fragments, so this handler is a no-op
 */
export async function handlerDataSourceUpdated(event: FlowcoreEvent<EventDataSourceUpdated>) {
  console.log(`Processing datasource.updated.0: ${event.eventId}`)
  const { dataSourceId, fragmentId } = event.payload
  console.log(`✅ Data source updated: ${dataSourceId} (fragment: ${fragmentId}) - data stored in Usable`)
}

/**
 * Handler for datasource.deleted.0 event
 * Cache removed - all data comes from Usable fragments, so this handler is a no-op
 */
export async function handlerDataSourceDeleted(event: FlowcoreEvent<EventDataSourceDeleted>) {
  console.log(`Processing datasource.deleted.0: ${event.eventId}`)
  const { fragmentId } = event.payload
  console.log(`✅ Data source deleted: fragment ${fragmentId} - data removed from Usable`)
}





