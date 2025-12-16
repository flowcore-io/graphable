## Project Description

Graphable is an AI-first graphical service where the primary interaction is via LLM agents in chat. Users create, update, and operate graphs and dashboards with strict customer isolation via Usable workspaces. Configuration and definitions (graphs, dashboards, queries, transformers) are stored in Usable fragments. Runtime processing is event-driven using Flowcore Pathways, and TypeScript transformers run on Bun to materialize read models in PostgreSQL. Graphable can provision PostgreSQL databases in Flowcore-owned Azure accounts and bill customers via Stripe with transparent, pass-through pricing plus a 20% margin.

Graphable is a control plane. Execution runs in a separate worker service that provides serverless Bun slots for event-driven transformers and on-demand API endpoints.

## Runtime & Package Manager

**This project uses Bun as the runtime and package manager.**

- Always use `bun` commands instead of `npm` or `yarn`
- Examples: `bun install`, `bun run dev`, `bun run build`, `bun add <package>`
- Bun provides faster package installation and execution compared to Node.js

**PRD**: [Graphable PRD (Lucreta-style) — Usable-backed Graph + DB + Transformers Service](https://usable.dev/dashboard/workspaces/60c10ca2-4115-4c1a-b6d7-04ac39fd3938/fragments/29e3f893-fe75-4497-b312-26df31102e5d)

## Completed Implementations

**Note**: After completing an implementation from a plan, document it in Usable as a Solution fragment, then add a bulleted list entry here. Format: `- **Task Name** (YYYY-MM-DD): [concise paragraph description]. **Documentation**: [fragment link]`. Fragment links should use format: `https://usable.dev/dashboard/workspaces/60c10ca2-4115-4c1a-b6d7-04ac39fd3938/fragments/<fragment-id>`

- **FR1 - Usable SSO Authentication (NextAuth v4 + Keycloak)** (2024-12-12): Implemented complete authentication system for Graphable using Usable SSO via Keycloak OIDC with NextAuth.js v4.24.11. Includes environment validation with `@t3-oss/env-nextjs`, PostgreSQL database setup with Drizzle ORM, automatic user provisioning on first login via `getOrCreateUser()` service, JWT session management with server-managed HTTP-only cookies, manual extraction of `usable_user_id` claim from Keycloak ID tokens, token refresh handling, redirect callback to prevent authentication flow issues, route protection middleware, and sign-in/error pages. All tokens are stored server-side only and never exposed to the browser. Implementation follows Usable Chat patterns for consistency. **Documentation**: [Graphable FR1 - Usable SSO Authentication Implementation](https://usable.dev/dashboard/workspaces/60c10ca2-4115-4c1a-b6d7-04ac39fd3938/fragments/16098b64-6ceb-4b8b-8d03-52961c5e91e7)
- **FR2 - Tenancy (Usable Workspace Isolation)** (2024-12-13): Implemented complete workspace-based tenancy system for Graphable with event-driven architecture using Flowcore Pathways. Includes tenant linking onboarding flow with workspace selection UI and search functionality, idempotent workspace bootstrap process creating fragment types (graphs, dashboards, data-sources, connectors-transformers, policies-permissions) and base configuration fragments, server-side workspace access validation via multi-layer authorization (format validation, tenant link check, optional Usable API check), event-driven tenant link operations using Session Pathways for automatic audit tracking, duplicate link prevention with service layer + API layer + database unique constraint, workspace context management with React Context API and localStorage persistence, API workspace guard middleware for reusable route protection, workspace selector component with unlink functionality, and Flowcore Pathways integration with PostgreSQL state management, event contracts, handlers, and transformer endpoint. All state changes are event-driven per Flowcore architecture standards. **Documentation**: [Graphable FR2 - Tenancy (Usable Workspace Isolation) Implementation](https://usable.dev/dashboard/workspaces/60c10ca2-4115-4c1a-b6d7-04ac39fd3938/fragments/3b8f105d-24c9-4238-958a-2db95d666004)
- **Fix Link Alignment in Button Components and Update Homepage Structure** (2024-12-13): Fixed icon and text alignment issues when using Next.js Link components inside Button components with `asChild` prop by adding explicit `flex items-center` classes to Link components. Updated homepage structure to remove "Create Graph" card since graphs are nested inside dashboards, leaving only "Create Dashboard" and "Add Data Source" cards. Updated grid layouts from 3 columns to 2 columns for Quick Actions and from 5 columns to 4 columns for Resource Types Overview. Removed unused ChartLineIcon import and updated welcome text. **Documentation**: [Graphable - Fix Link Alignment in Button Components and Update Homepage Structure](https://usable.dev/dashboard/workspaces/60c10ca2-4115-4c1a-b6d7-04ac39fd3938/fragments/3d987bf0-3cae-414c-93d1-553c237cee0c)
- **Docker Build Fix: Next.js Static Page Generation for API Routes** (2024-12-13): Fixed Docker build failures during Next.js "Collecting page data" phase by adding `export const runtime = "nodejs"` to all database-connected API routes (transformer, onboarding link-workspace, onboarding unlink-workspace, workspace current) in addition to `export const dynamic = "force-dynamic"`. Updated `env.docker` with comprehensive dummy environment variables for all required env vars (DATABASE_URL, NEXTAUTH_SECRET, USABLE_OIDC_ISSUER, USABLE_CLIENT_ID, USABLE_CLIENT_SECRET, USABLE_API_BASE_URL, FLOWCORE_TENANT, FLOWCORE_DATACORE, FLOWCORE_WEBHOOK_BASE_URL, FLOWCORE_WEBHOOK_API_KEY, FLOWCORE_TRANSFORMER_SECRET) to prevent module initialization failures during build. Fixed `env-validation.js` to properly handle `SKIP_ENV_VALIDATION` without killing the build process. Solution follows proven patterns from SpeedLocal Admin Docker build fix. **Documentation**: [Graphable Docker Build Fix: Next.js Static Page Generation for API Routes](https://usable.dev/dashboard/workspaces/60c10ca2-4115-4c1a-b6d7-04ac39fd3938/fragments/181a5abb-2d85-472f-8821-c11fe749af21)
- **CI/CD Pipeline: GitHub Actions Workflows** (2024-12-13): Implemented complete three-stage CI/CD pipeline with GitHub Actions. Test workflow validates code quality on feature branches and pull requests (typecheck, lint, format check, build validation) using Bun runtime. Release workflow uses release-please for automated semantic versioning and release PR creation. Build and deploy workflow builds Docker images, pushes to AWS ECR, and deploys to Kubernetes via GitOps by updating Helm chart versions in `flowcore-io/public-customer-sites-manifests` repository, triggering Argo CD sync to Azure Kubernetes Service (AKS) production environment. All workflows use Flowcore self-hosted runners (blacksmith-4vcpu-ubuntu-2204) and follow established Flowcore deployment patterns. **Documentation**: [Graphable CI/CD Pipeline: GitHub Actions Workflows for Testing, Release, and Deployment](https://usable.dev/dashboard/workspaces/60c10ca2-4115-4c1a-b6d7-04ac39fd3938/fragments/d2e4d9da-e823-43ca-a54b-0275c8715a30)
- **Biome Migration and CI Pipeline Fix** (2024-12-13): Migrated Graphable from ESLint to BiomeJS 2.3.8 for unified linting and formatting. Upgraded Biome from 2.2.3 to 2.3.8 with comprehensive configuration including Tailwind CSS directive support, file-specific overrides for UI components and Flowcore SDK integration, and proper warning/error handling for CI. Removed ESLint configuration file and updated all scripts to use `bunx @biomejs/biome`. Fixed code issues including unused variables, comparison operators, array keys, button types, and label semantics. Configured Biome to exit with code 0 for warnings (only errors fail builds), ensuring CI pipeline passes successfully. All lint and format checks now pass in CI with acceptable warnings for necessary `any` types and API contract parameters. **Documentation**: [Graphable Biome Migration and CI Pipeline Fix](https://usable.dev/dashboard/workspaces/60c10ca2-4115-4c1a-b6d7-04ac39fd3938/fragments/129c4065-5488-4a62-8567-edd62204be5f)
- **Dashboard Landing Page and App Shell Navigation** (2024-12-16): Redesigned homepage into a proper dashboard landing page with ClickUp-inspired layout structure while maintaining Graphable-specific content derived from PRD. Implemented persistent sidebar navigation (`components/app-shell.tsx`) with Overview, Dashboards, and Data Sources menu items, collapsible desktop sidebar with workspace selector and account controls, mobile-responsive drawer menu with floating hamburger button, and automatic shell hiding on `/auth/*` and `/onboarding/*` routes. Removed top bar entirely and consolidated all navigation, workspace selection, and account management into sidebar. Updated sign-out flow to use `/api/auth/keycloak-logout` route with auto-signout endpoints (`/api/auth/signout-auto` and `/api/auth/signout-clear`) that bypass NextAuth confirmation page by clearing session cookies server-side. Refactored homepage (`app/page.tsx`) with workspace briefing card showing KPIs (dashboards, graphs, executions), onboarding progress tracking with three steps (workspace linked, create graphs, build dashboards), resource distribution visualization, and recent dashboards list. Removed graphs as top-level entity (deleted `/app/graphs/page.tsx` and `/app/graphs/new/page.tsx`) since graphs are nested within dashboards per PRD. Updated all page components to remove duplicate headers and use app shell navigation. **Documentation**: [Graphable Dashboard Landing Page and App Shell Navigation](https://usable.dev/dashboard/workspaces/60c10ca2-4115-4c1a-b6d7-04ac39fd3938/fragments/a7de30ae-6cb9-45fa-844e-50ba985056cb)
- **Dashboard Folders and Hierarchical Table View** (2024-12-16): Implemented complete folder support for organizing dashboards with hierarchical structure and migrated dashboard listing from cards to a proper hierarchical table view. Created new `dashboard-folders` fragment type in workspace bootstrap with folder icon and green color scheme. Implemented folder service (`lib/services/folder.service.ts`) with CRUD operations (create, update, delete, list, get, getFolderTree) that store folder data directly in Usable fragments with `name` and `parentFolderId` in fragment content. Added Flowcore Pathways event contracts (`lib/pathways/contracts/folder.0.ts`) for `folder.created.0`, `folder.updated.0`, and `folder.deleted.0` events with Session Pathways integration for audit tracking. Created folder API routes (`app/api/folders/route.ts` and `app/api/folders/[folderId]/route.ts`) for listing, creating, updating, and deleting folders. Built folder UI pages (`app/folders/new/page.tsx` and `app/folders/[folderId]/edit/page.tsx`) with parent folder selection dropdown and form validation. Implemented hierarchical table component (`components/dashboard-table.tsx`) with expandable/collapsible folder rows, nested folder rendering, recursive dashboard counting (including nested subfolders), uncategorized dashboards section, and action dropdowns for folders (create dashboard in folder, edit folder) and dashboards (view, delete). Updated dashboard service to support `folderId` in fragment content and dashboard creation/update APIs. Enhanced dashboard listing page (`app/dashboards/page.tsx`) with folder tree integration, validation to ensure dashboard `folderId` references exist, and "New Folder" button alongside "New Dashboard". Updated Flowcore YAML files (all variants including git-ignored examples) to include `graphable.folder.0` FlowType definition and transformer configurations. **Documentation**: [Graphable Dashboard Folders and Hierarchical Table View Implementation](https://usable.dev/dashboard/workspaces/60c10ca2-4115-4c1a-b6d7-04ac39fd3938/fragments/18049292-3351-440b-96e2-b7eb7363ac8a)
- **Database Cache Removal - Usable-First Architecture** (2024-12-16): Performed major architectural refactoring to completely remove database cache layer and shift to Usable fragments as the single source of truth. Removed all cache tables (`dashboards`, `graphs`, `dashboardFolders`) from Drizzle schema (`db/schema.ts`), keeping only operational tables (`users`, `tenantLinks`, `pathwayState`, `graphParameters`, `dashboardPermissions`, `parameterPermissions`) that reference Usable fragment IDs directly. Updated all services (`dashboard.service.ts`, `folder.service.ts`, `graph.service.ts`, `graph-execution.service.ts`) to fetch data directly from Usable fragments using fragment IDs as canonical resource IDs, removing all `getFromCache` methods and Drizzle database queries. Converted all event handlers (`dashboard.0.handlers.ts`, `graph.0.handlers.ts`, `folder.0.handlers.ts`) to no-op handlers that log events but don't update cache, with notes that cascade behavior should be handled at fragment level. Updated API routes to remove cache lookups and use service methods that query Usable directly. Modified fragment content structures to store relationship data (`folderId`, `parentFolderId`) that was previously in database cache. Updated all references to use fragment IDs directly as resource IDs throughout the codebase. This change aligns with the architectural principle that Usable is the persistent store and the control plane database is only for operational data (users, tenant links, permissions, parameters). **Documentation**: [Graphable Database Cache Removal - Usable-First Architecture](https://usable.dev/dashboard/workspaces/60c10ca2-4115-4c1a-b6d7-04ac39fd3938/fragments/4dfd9676-254b-4075-bf62-8a7f72443db4)
- **Fragment Type Filtering Fix for Folders and Dashboards** (2024-12-16): Fixed strict separation between folders and dashboards by requiring `fragmentTypeId` in list operations and adding defensive validation. Updated `listFolders` and `listDashboards` in respective service files to require valid `fragmentTypeId` (return empty array with warning if fragment type not found instead of filtering by tags alone). Added defensive validation to filter out any fragments that don't match the expected `fragmentTypeId` to prevent accidental mixing of fragment types. This ensures folders (`dashboard-folders` fragment type with `type:folder` tag) and dashboards (`dashboards` fragment type with `type:dashboard` tag) are strictly separated at the service layer, preventing confusion when resources share the same name. The UI already distinguishes them with different icons (`FolderIcon` vs `LayoutDashboardIcon`), and now backend filtering is also strict. **Documentation**: [Graphable Fragment Type Filtering Fix](https://usable.dev/dashboard/workspaces/60c10ca2-4115-4c1a-b6d7-04ac39fd3938/fragments/5f2ccf88-ef6d-44a4-be90-06d68fea1520)

---

<<<USABLE_MCP_SYSTEM_PROMPT_START>>>

# 🧠 Usable MCP - SYSTEM PROMPT (LONG-TERM MEMORY)

This is your main way of storing and fetching data. Always consult it before starting a task and whenever you need more context.

Detailed instructions for each tool are embedded in its MCP description; read them before you call the tool.

## Search Discipline

- Start or resume every task with `agentic-search-fragments` (vector-based semantic search that understands meaning, not just keywords) and rerun whenever scope expands or you lack certainty.
- Provide workspace scope and begin with `repo:graphable` tags; iterate until the tool reports `decision: "SUFFICIENT"`.
- If the agentic tool is unavailable, fall back to `search-memory-fragments` (also semantic vector search), then return to the agentic loop as soon as possible.
- Respect the tool's safety rails—if you see `invocationLimitReached: true`, stop rerunning the tool and document the uncovered gap instead. Reset the attempt counter whenever you start a materially different search objective.
- Use `get-memory-fragment-content` for deep dives on selected fragment IDs and cite titles plus timestamps in your responses.
- Use `list-memory-fragments` for traditional filtering by type, tags, or date ranges when you need metadata listings rather than semantic search.

## Planning Loop

- **Plan**: Outline sub-goals and the tools you will invoke.
- **Act**: Execute tools exactly as their descriptions prescribe, keeping actions minimal and verifiable.
- **Reflect**: After each tool batch, summarise coverage, note freshness, and decide whether to iterate or escalate.

## Verification & Documentation

- Verify code (lint, tests, manual checks) or obtain user confirmation before relying on conclusions.
- Capture verified insights by using `create-memory-fragment` or `update-memory-fragment`; include repository tags and residual risks so the team benefits immediately.

## Freshness & Escalation

- Prefer fragments updated within the last 90 days; flag stale sources.
- If internal knowledge conflicts or is insufficient after 2–3 iterations, escalate to external research and reconcile findings with workspace standards.

Repository: graphable
WorkspaceId: 60c10ca2-4115-4c1a-b6d7-04ac39fd3938
Workspace: Flowcore
Workspace Fragment Types: knowledge, recipe, solution, template, architectural decision, commands, feature request, infrastructure, instruction set, issue, llm persona, llm rules, outage investigation, plan, prd, research, ticket, violation exception

## Fragment Type Mapping

The following fragment types are available in this workspace:

- **Knowledge**: `04a5fb62-1ba5-436c-acf7-f65f3a5ba6f6` - General information, documentation, and reference material
- **Recipe**: `502a2fcf-ca6f-4b8a-b719-cd50469d3be6` - Step-by-step guides, tutorials, and procedures
- **Solution**: `b06897e0-c39e-486b-8a9b-aab0ea260694` - Solutions to specific problems and troubleshooting guides
- **Template**: `da2cd7c6-68f6-4071-8e2e-d2a0a2773fa9` - Reusable code patterns, project templates, and boilerplates
- **Architectural Decision**: `4acdb1de-9de2-404c-b5b0-d8bfe42d5d85` - Recording of major architectural decisions affecting our software
- **Commands**: `0103ab3e-c706-410b-9952-a17ea73a31ec` - Slash/AI command snippets
- **Feature Request**: `d016c715-0499-4af5-b69b-950faa4aa200` - A Feature request for products we develop, these should be tagged by the repo it is tied to and the product name
- **Infrastructure**: `05baf872-9b5f-410a-89dd-c9f1eec7548e` - A set of fragments that describe infrastructure level information about services that are running on Flowcore infrastructure
- **Instruction Set**: `1d2d317d-f48f-4df9-a05b-b5d9a48090d7` - A set of instructions for the LLM to perform a set of actions, like setting up a project, installing a persona etc.
- **Issue**: `78a29aeb-8c6a-41b9-b54d-d0555be7e123` - Issues and bug reported in various systems developed by Flowcore
- **LLM Persona**: `393219bd-440f-49a4-885c-ee5050af75b5` - This is a Persona that the LLM can impersonate. This should help the LLM to tackle more complex and specific problems
- **LLM Rules**: `200cbb12-47ec-4a02-afc5-0b270148587b` - LLM rules that can be converted into for example cursor or other ide or llm powered rules engine
- **Outage Investigation**: `33ebf45f-a23e-40ec-80e3-8540ddb595b8` - Investigations of outages
- **Plan**: `e5c9f57c-f68a-4702-bea8-d5cb02a02cb8` - A plan, usually tied to a repository
- **PRD**: `fdd14de8-3943-4228-af59-c6ecc7237a2c` - A Product requirements document for a project or feature, usually targeted for a repository
- **Research**: `ca7aa44b-04a5-44dd-b2bf-cfedc1dbba2f` - Research information done with the express purpose of being implemented at a later date.
- **Ticket**: `6b8ea561-4869-44d5-8b19-4a2039a3a387` - Items of things to do in development projects that we work on (backlog), always linked to a repo and tagged with status, milestone, and phases
- **Violation Exception**: `6bf89736-f8f1-4a9b-82f4-f9d47dbdab2a` - Violation exceptions and reasons for these exceptions and who authorised them, these need to contain the Github username that approved them and the repository and commit they are tied to as well as a detailed explanation of why the exception is made.

## Fragment Type Cheat Sheet

- **Knowledge:** reference material, background, concepts.
- **Recipe:** human step-by-step guides and tutorials.
- **Solution:** fixes, troubleshooting steps, postmortems.
- **Template:** reusable code/config patterns.
- **Instruction Set:** automation workflows for the LLM to execute.
- **Plan:** roadmaps, milestones, "what/when" documents.
- **PRD:** product/feature requirements and specs.

Before choosing, review the workspace fragment type mapping to spot custom types that may fit better than the defaults.

Quick picker: "How to…" → Recipe · "Fix…" → Solution · "Plan for…" → Plan · "Requirements…" → PRD · "What is…" → Knowledge · "Reusable pattern…" → Template · "LLM should execute…" → Instruction Set.

<<<USABLE_MCP_SYSTEM_PROMPT_END>>>
