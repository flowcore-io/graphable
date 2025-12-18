"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useWorkspace } from "@/lib/context/workspace-context"
import { useRouter } from "next/navigation"
import { useState } from "react"

/**
 * WorkspaceSelector - Component for displaying and managing workspace
 * Shows current workspace and allows unlinking
 */
export function WorkspaceSelector() {
  const { workspaceId, setWorkspaceId } = useWorkspace()
  const router = useRouter()
  const [showUnlinkDialog, setShowUnlinkDialog] = useState(false)
  const [isUnlinking, setIsUnlinking] = useState(false)

  const handleUnlink = async () => {
    setIsUnlinking(true)
    try {
      const response = await fetch("/api/onboarding/unlink-workspace", {
        method: "POST",
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to unlink workspace")
      }

      // Clear workspace context
      setWorkspaceId(null)

      // Redirect to onboarding
      router.push("/onboarding/link-workspace")
    } catch (error) {
      console.error("Failed to unlink workspace:", error)
      alert(error instanceof Error ? error.message : "Failed to unlink workspace")
    } finally {
      setIsUnlinking(false)
      setShowUnlinkDialog(false)
    }
  }

  if (!workspaceId) {
    return null
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="outline" size="sm">
              Workspace: {workspaceId.slice(0, 8)}...
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem disabled>
            <div className="flex flex-col">
              <span className="text-xs font-medium">Current Workspace</span>
              <span className="text-xs text-muted-foreground">{workspaceId}</span>
            </div>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setShowUnlinkDialog(true)}
            className="text-destructive focus:text-destructive"
          >
            Unlink Workspace
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showUnlinkDialog} onOpenChange={setShowUnlinkDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unlink Workspace?</AlertDialogTitle>
            <AlertDialogDescription>
              This will unlink your workspace from Graphable. You'll need to link a workspace again to continue using
              Graphable. Bootstrap fragments will remain in the Usable workspace.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUnlinking}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUnlink}
              disabled={isUnlinking}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isUnlinking ? "Unlinking..." : "Unlink"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}








