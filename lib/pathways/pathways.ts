import { env } from "@/lib/env"
import { NoopLogger, PathwayRouter, PathwaysBuilder, createPostgresPathwayState } from "@flowcore/pathways"
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

// Register handlers AFTER all registrations
pathways.handle(
  `${tenantContract.FlowcoreTenant.flowType}/${tenantContract.FlowcoreTenant.eventType.linked}`,
  handlerTenantLinked as any
)

pathways.handle(
  `${tenantContract.FlowcoreTenant.flowType}/${tenantContract.FlowcoreTenant.eventType.unlinked}`,
  handlerTenantUnlinked as any
)

// Export router for transformer endpoint
export const pathwaysRouter = new PathwayRouter(pathways, env.FLOWCORE_TRANSFORMER_SECRET)
