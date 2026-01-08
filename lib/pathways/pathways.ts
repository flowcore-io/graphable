import { createPostgresPathwayState, NoopLogger, PathwayRouter, PathwaysBuilder } from "@flowcore/pathways"
import { env } from "@/lib/env"
import * as dashboardContract from "./contracts/dashboard.0"
import {
  handlerDashboardCreated,
  handlerDashboardDeleted,
  handlerDashboardUpdated,
} from "./contracts/dashboard.0.handlers"
import * as datasourceContract from "./contracts/datasource.0"
import {
  handlerDataSourceCreated,
  handlerDataSourceDeleted,
  handlerDataSourceUpdated,
} from "./contracts/datasource.0.handlers"
import * as folderContract from "./contracts/folder.0"
import { handlerFolderCreated, handlerFolderDeleted, handlerFolderUpdated } from "./contracts/folder.0.handlers"
import * as graphContract from "./contracts/graph.0"
import { handlerGraphCreated, handlerGraphDeleted, handlerGraphUpdated } from "./contracts/graph.0.handlers"
import * as tenantContract from "./contracts/tenant.0"
import { handlerTenantLinked, handlerTenantUnlinked } from "./contracts/tenant.0.handlers"

// PostgreSQL state management for Flowcore Pathways
const postgresState = createPostgresPathwayState({
  connectionString: env.DATABASE_URL,
})

/**
 * Flowcore Pathways builder configuration
 * Registers tenant event types and handlers
 */
export const pathways = new PathwaysBuilder({
  baseUrl: env.FLOWCORE_WEBHOOK_BASE_URL,
  tenant: env.FLOWCORE_TENANT,
  dataCore: env.FLOWCORE_DATACORE,
  apiKey: env.FLOWCORE_WEBHOOK_API_KEY,
  logger: new NoopLogger(),
  pathwayTimeoutMs: 60_000,
  enableSessionUserResolvers: true, // Enable session tracking
})
  .withPathwayState(postgresState)
  // Register tenant.linked.0 event
  .register({
    flowType: tenantContract.FlowcoreTenant.flowType,
    eventType: tenantContract.FlowcoreTenant.eventType.linked,
    schema: tenantContract.EventTenantLinkedSchema as any,
    writable: true,
  })
  // Register tenant.unlinked.0 event
  .register({
    flowType: tenantContract.FlowcoreTenant.flowType,
    eventType: tenantContract.FlowcoreTenant.eventType.unlinked,
    schema: tenantContract.EventTenantUnlinkedSchema as any,
    writable: true,
  })
  // Register graph.created.0 event
  .register({
    flowType: graphContract.FlowcoreGraph.flowType,
    eventType: graphContract.FlowcoreGraph.eventType.created,
    schema: graphContract.EventGraphCreatedSchema as any,
    writable: true,
  })
  // Register graph.updated.0 event
  .register({
    flowType: graphContract.FlowcoreGraph.flowType,
    eventType: graphContract.FlowcoreGraph.eventType.updated,
    schema: graphContract.EventGraphUpdatedSchema as any,
    writable: true,
  })
  // Register graph.deleted.0 event
  .register({
    flowType: graphContract.FlowcoreGraph.flowType,
    eventType: graphContract.FlowcoreGraph.eventType.deleted,
    schema: graphContract.EventGraphDeletedSchema as any,
    writable: true,
  })
  // Register dashboard.created.0 event
  .register({
    flowType: dashboardContract.FlowcoreDashboard.flowType,
    eventType: dashboardContract.FlowcoreDashboard.eventType.created,
    schema: dashboardContract.EventDashboardCreatedSchema as any,
    writable: true,
  })
  // Register dashboard.updated.0 event
  .register({
    flowType: dashboardContract.FlowcoreDashboard.flowType,
    eventType: dashboardContract.FlowcoreDashboard.eventType.updated,
    schema: dashboardContract.EventDashboardUpdatedSchema as any,
    writable: true,
  })
  // Register dashboard.deleted.0 event
  .register({
    flowType: dashboardContract.FlowcoreDashboard.flowType,
    eventType: dashboardContract.FlowcoreDashboard.eventType.deleted,
    schema: dashboardContract.EventDashboardDeletedSchema as any,
    writable: true,
  })
  // Register folder.created.0 event
  .register({
    flowType: folderContract.FlowcoreFolder.flowType,
    eventType: folderContract.FlowcoreFolder.eventType.created,
    schema: folderContract.EventFolderCreatedSchema as any,
    writable: true,
  })
  // Register folder.updated.0 event
  .register({
    flowType: folderContract.FlowcoreFolder.flowType,
    eventType: folderContract.FlowcoreFolder.eventType.updated,
    schema: folderContract.EventFolderUpdatedSchema as any,
    writable: true,
  })
  // Register folder.deleted.0 event
  .register({
    flowType: folderContract.FlowcoreFolder.flowType,
    eventType: folderContract.FlowcoreFolder.eventType.deleted,
    schema: folderContract.EventFolderDeletedSchema as any,
    writable: true,
  })
  // Register datasource.created.0 event
  .register({
    flowType: datasourceContract.FlowcoreDataSource.flowType,
    eventType: datasourceContract.FlowcoreDataSource.eventType.created,
    schema: datasourceContract.EventDataSourceCreatedSchema as any,
    writable: true,
  })
  // Register datasource.updated.0 event
  .register({
    flowType: datasourceContract.FlowcoreDataSource.flowType,
    eventType: datasourceContract.FlowcoreDataSource.eventType.updated,
    schema: datasourceContract.EventDataSourceUpdatedSchema as any,
    writable: true,
  })
  // Register datasource.deleted.0 event
  .register({
    flowType: datasourceContract.FlowcoreDataSource.flowType,
    eventType: datasourceContract.FlowcoreDataSource.eventType.deleted,
    schema: datasourceContract.EventDataSourceDeletedSchema as any,
    writable: true,
  })

// Register handlers AFTER all registrations
pathways.handle(
  `${tenantContract.FlowcoreTenant.flowType}/${tenantContract.FlowcoreTenant.eventType.linked}`,
  handlerTenantLinked as any
)

pathways.handle(
  `${tenantContract.FlowcoreTenant.flowType}/${tenantContract.FlowcoreTenant.eventType.unlinked}`,
  handlerTenantUnlinked as any
)

pathways.handle(
  `${graphContract.FlowcoreGraph.flowType}/${graphContract.FlowcoreGraph.eventType.created}`,
  handlerGraphCreated as any
)

pathways.handle(
  `${graphContract.FlowcoreGraph.flowType}/${graphContract.FlowcoreGraph.eventType.updated}`,
  handlerGraphUpdated as any
)

pathways.handle(
  `${graphContract.FlowcoreGraph.flowType}/${graphContract.FlowcoreGraph.eventType.deleted}`,
  handlerGraphDeleted as any
)

pathways.handle(
  `${dashboardContract.FlowcoreDashboard.flowType}/${dashboardContract.FlowcoreDashboard.eventType.created}`,
  handlerDashboardCreated as any
)

pathways.handle(
  `${dashboardContract.FlowcoreDashboard.flowType}/${dashboardContract.FlowcoreDashboard.eventType.updated}`,
  handlerDashboardUpdated as any
)

pathways.handle(
  `${dashboardContract.FlowcoreDashboard.flowType}/${dashboardContract.FlowcoreDashboard.eventType.deleted}`,
  handlerDashboardDeleted as any
)

pathways.handle(
  `${folderContract.FlowcoreFolder.flowType}/${folderContract.FlowcoreFolder.eventType.created}`,
  handlerFolderCreated as any
)

pathways.handle(
  `${folderContract.FlowcoreFolder.flowType}/${folderContract.FlowcoreFolder.eventType.updated}`,
  handlerFolderUpdated as any
)

pathways.handle(
  `${folderContract.FlowcoreFolder.flowType}/${folderContract.FlowcoreFolder.eventType.deleted}`,
  handlerFolderDeleted as any
)

pathways.handle(
  `${datasourceContract.FlowcoreDataSource.flowType}/${datasourceContract.FlowcoreDataSource.eventType.created}`,
  handlerDataSourceCreated as any
)

pathways.handle(
  `${datasourceContract.FlowcoreDataSource.flowType}/${datasourceContract.FlowcoreDataSource.eventType.updated}`,
  handlerDataSourceUpdated as any
)

pathways.handle(
  `${datasourceContract.FlowcoreDataSource.flowType}/${datasourceContract.FlowcoreDataSource.eventType.deleted}`,
  handlerDataSourceDeleted as any
)

// Export router for transformer endpoint
export const pathwaysRouter = new PathwayRouter(pathways, env.FLOWCORE_TRANSFORMER_SECRET)
