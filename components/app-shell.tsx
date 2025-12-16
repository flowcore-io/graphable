"use client"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import {
  DatabaseIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  MenuIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  SparklesIcon,
  XIcon,
} from "lucide-react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useMemo, useState } from "react"
import { WorkspaceSelector } from "./workspace-selector"

type NavItem = {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  const handleSignOut = () => {
    window.location.href = "/api/auth/signout-auto"
  }

  const shouldHideShell = pathname.startsWith("/auth") || pathname.startsWith("/onboarding")
  const navItems: NavItem[] = useMemo(
    () => [
      { href: "/", label: "Overview", icon: SparklesIcon },
      { href: "/dashboards", label: "Dashboards", icon: LayoutDashboardIcon },
      { href: "/data-sources", label: "Data Sources", icon: DatabaseIcon },
    ],
    []
  )

  if (shouldHideShell) {
    return <>{children}</>
  }

  const DesktopSidebar = (
    <aside
      className={cn(
        "bg-sidebar text-sidebar-foreground border-r border-sidebar-border h-full flex flex-col",
        collapsed ? "w-[56px]" : "w-[240px]"
      )}
    >
      <div className={cn("h-14 px-3 flex items-center gap-2", collapsed ? "justify-center" : "justify-between")}>
        {collapsed ? (
          <div className="h-8 w-8 rounded-md bg-sidebar-primary/20 flex items-center justify-center">
            <span className="text-xs font-bold">G</span>
          </div>
        ) : (
          <div className="min-w-0">
            <div className="text-sm font-semibold leading-tight">Graphable</div>
            <div className="text-[0.65rem] text-sidebar-foreground/70 leading-tight">Control plane</div>
          </div>
        )}

        <Button
          variant="ghost"
          size="icon-sm"
          className={cn("text-sidebar-foreground hover:bg-sidebar-accent/10", collapsed && "hidden")}
          onClick={() => setCollapsed(true)}
          aria-label="Collapse sidebar"
        >
          <PanelLeftCloseIcon className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon-sm"
          className={cn("text-sidebar-foreground hover:bg-sidebar-accent/10", !collapsed && "hidden")}
          onClick={() => setCollapsed(false)}
          aria-label="Expand sidebar"
        >
          <PanelLeftOpenIcon className="h-4 w-4" />
        </Button>
      </div>

      <Separator className="bg-sidebar-border" />

      <nav className="flex-1 p-2 space-y-1">
        {navItems.map((item) => {
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-md px-2 py-2 text-xs flex items-center gap-2 transition-colors",
                "hover:bg-sidebar-accent/10 hover:text-sidebar-foreground",
                active ? "bg-sidebar-accent/15 text-sidebar-foreground" : "text-sidebar-foreground/80",
                collapsed && "justify-center"
              )}
              onClick={() => setMobileOpen(false)}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          )
        })}
      </nav>

      <Separator className="bg-sidebar-border" />

      <div className={cn("p-3", collapsed ? "hidden" : "block")}>
        <div className="text-[0.65rem] uppercase tracking-wide text-sidebar-foreground/70 mb-2">Workspace</div>
        <WorkspaceSelector />
      </div>

      <Separator className="bg-sidebar-border" />

      <div className={cn("p-3", collapsed ? "hidden" : "block")}>
        <div className="text-[0.65rem] uppercase tracking-wide text-sidebar-foreground/70 mb-2">Account</div>
        {session?.user && (
          <div className="text-xs text-sidebar-foreground/80 truncate mb-2">
            {session.user.email || session.user.name}
          </div>
        )}
        <Button variant="outline" size="sm" className="w-full justify-start gap-2" onClick={handleSignOut}>
          <LogOutIcon className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </aside>
  )

  const MobileSidebar = (
    <aside className="bg-sidebar text-sidebar-foreground border-r border-sidebar-border h-full w-[85vw] max-w-[320px] flex flex-col">
      <div className="h-14 px-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold leading-tight">Graphable</div>
          <div className="text-[0.65rem] text-sidebar-foreground/70 leading-tight">Control plane</div>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={() => setMobileOpen(false)} aria-label="Close navigation">
          <XIcon className="h-4 w-4" />
        </Button>
      </div>

      <Separator className="bg-sidebar-border" />

      <div className="p-3">
        <div className="text-[0.65rem] uppercase tracking-wide text-sidebar-foreground/70 mb-2">Workspace</div>
        <WorkspaceSelector />
      </div>

      <Separator className="bg-sidebar-border" />

      <nav className="flex-1 p-2 space-y-1">
        {navItems.map((item) => {
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-md px-2 py-2 text-xs flex items-center gap-2 transition-colors",
                "hover:bg-sidebar-accent/10 hover:text-sidebar-foreground",
                active ? "bg-sidebar-accent/15 text-sidebar-foreground" : "text-sidebar-foreground/80"
              )}
              onClick={() => setMobileOpen(false)}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <Separator className="bg-sidebar-border" />

      <div className="p-3">
        <div className="text-[0.65rem] uppercase tracking-wide text-sidebar-foreground/70 mb-2">Account</div>
        <div className="text-xs text-sidebar-foreground/80 truncate mb-2">
          {session?.user?.email || session?.user?.name}
        </div>
        <Button variant="outline" size="sm" className="w-full justify-start gap-2" onClick={handleSignOut}>
          <LogOutIcon className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </aside>
  )

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop sidebar */}
      <div className="hidden md:block">{DesktopSidebar}</div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
          />
          <div className="absolute left-0 top-0 bottom-0">{MobileSidebar}</div>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile menu button - floating */}
        <div className="md:hidden fixed top-4 left-4 z-40">
          <Button
            variant="outline"
            size="icon-sm"
            className="bg-card shadow-md"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <MenuIcon className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 min-w-0 overflow-auto">{children}</div>
      </div>
    </div>
  )
}
