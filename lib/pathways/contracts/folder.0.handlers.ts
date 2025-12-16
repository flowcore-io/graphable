import type { FlowcoreEvent } from "@flowcore/pathways"
import type { EventFolderCreated, EventFolderDeleted, EventFolderUpdated } from "./folder.0"

/**
 * Handler for folder.created.0 event
 * Cache removed - all data comes from Usable fragments, so this handler is a no-op
 * Note: Cascade behavior (updating dashboards when folder is deleted) should be handled
 * by updating dashboard fragments directly, not via cache
 */
export async function handlerFolderCreated(event: FlowcoreEvent<EventFolderCreated>) {
  console.log(`Processing folder.created.0: ${event.eventId}`)
  const { folderId, fragmentId } = event.payload
  console.log(`✅ Folder created: ${folderId} (fragment: ${fragmentId}) - data stored in Usable`)
}

/**
 * Handler for folder.updated.0 event
 * Cache removed - all data comes from Usable fragments, so this handler is a no-op
 */
export async function handlerFolderUpdated(event: FlowcoreEvent<EventFolderUpdated>) {
  console.log(`Processing folder.updated.0: ${event.eventId}`)
  const { folderId, fragmentId } = event.payload
  console.log(`✅ Folder updated: ${folderId} (fragment: ${fragmentId}) - data stored in Usable`)
}

/**
 * Handler for folder.deleted.0 event
 * Cache removed - all data comes from Usable fragments, so this handler is a no-op
 * Note: Cascade behavior (setting dashboards' folderId to null) should be handled
 * by updating dashboard fragments directly when folder is deleted
 */
export async function handlerFolderDeleted(event: FlowcoreEvent<EventFolderDeleted>) {
  console.log(`Processing folder.deleted.0: ${event.eventId}`)
  const { folderId, fragmentId } = event.payload
  console.log(`✅ Folder deleted: ${folderId} (fragment: ${fragmentId}) - data removed from Usable`)
  console.log(`⚠️  Note: Cascade behavior (updating dashboards) should be handled at fragment level`)
}
