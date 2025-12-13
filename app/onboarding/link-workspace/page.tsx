"use client";

import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useWorkspace } from "@/lib/context/workspace-context";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

// Alert component for error messages
function Alert({
	variant = "default",
	children,
}: {
	variant?: "default" | "destructive";
	children: React.ReactNode;
}) {
	return (
		<div
			className={`rounded-lg border p-4 ${
				variant === "destructive"
					? "border-destructive/50 bg-destructive/10 text-destructive"
					: "border-border bg-muted"
			}`}
		>
			{children}
		</div>
	);
}

function AlertTitle({ children }: { children: React.ReactNode }) {
	return <div className="font-semibold mb-1">{children}</div>;
}

function AlertDescription({ children }: { children: React.ReactNode }) {
	return <div className="text-sm">{children}</div>;
}

interface Workspace {
	id: string;
	name: string;
	description?: string;
	visibility: "private" | "public";
	createdAt: string;
	updatedAt: string;
}

export default function LinkWorkspacePage() {
	const { data: session, status: sessionStatus } = useSession();
	const { setWorkspaceId, refreshWorkspace } = useWorkspace();
	const router = useRouter();
	const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isLinking, setIsLinking] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(
		null,
	);
	const [searchQuery, setSearchQuery] = useState("");

	// Filter workspaces based on search query
	const filteredWorkspaces = useMemo(() => {
		if (!searchQuery.trim()) {
			return workspaces;
		}

		const query = searchQuery.toLowerCase().trim();
		return workspaces.filter(
			(workspace) =>
				workspace.name.toLowerCase().includes(query) ||
				workspace.description?.toLowerCase().includes(query),
		);
	}, [workspaces, searchQuery]);

	// Fetch workspaces on mount
	useEffect(() => {
		if (sessionStatus === "loading") {
			return;
		}

		if (!session?.user) {
			router.push("/auth/signin");
			return;
		}

		async function fetchWorkspaces() {
			try {
				const response = await fetch("/api/onboarding/workspaces");
				if (!response.ok) {
					throw new Error("Failed to fetch workspaces");
				}

				const data = await response.json();
				setWorkspaces(data.workspaces || []);
			} catch (err) {
				setError(
					err instanceof Error ? err.message : "Failed to load workspaces",
				);
			} finally {
				setIsLoading(false);
			}
		}

		fetchWorkspaces();
	}, [session, sessionStatus, router]);

	const handleLinkWorkspace = async () => {
		if (!selectedWorkspaceId) {
			setError("Please select a workspace");
			return;
		}

		setIsLinking(true);
		setError(null);

		try {
			const response = await fetch("/api/onboarding/link-workspace", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					workspaceId: selectedWorkspaceId,
				}),
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || "Failed to link workspace");
			}

			// Update workspace context
			setWorkspaceId(selectedWorkspaceId);
			await refreshWorkspace();

			// Redirect to main app
			router.push("/");
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to link workspace");
		} finally {
			setIsLinking(false);
		}
	};

	if (sessionStatus === "loading" || isLoading) {
		return (
			<div className="flex min-h-screen items-center justify-center">
				<div className="text-center">
					<p className="text-muted-foreground">Loading workspaces...</p>
				</div>
			</div>
		);
	}

	return (
		<div className="flex min-h-screen items-center justify-center p-4">
			<Card className="w-full max-w-2xl">
				<CardHeader>
					<CardTitle>Link Workspace</CardTitle>
					<CardDescription>
						Select a workspace to use with Graphable. This workspace will become
						your Graphable tenant.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					{error && (
						<Alert variant="destructive">
							<AlertTitle>Error</AlertTitle>
							<AlertDescription>{error}</AlertDescription>
						</Alert>
					)}

					<div className="space-y-2">
						<label className="text-sm font-medium">
							Select Workspace (Owner Only)
						</label>
						{workspaces.length === 0 ? (
							<p className="text-sm text-muted-foreground">
								No workspaces found. You need to be an owner of at least one
								workspace to use Graphable.
							</p>
						) : (
							<div className="space-y-2">
								<Input
									type="text"
									placeholder="Search workspaces by name or description..."
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									className="w-full"
								/>
								{filteredWorkspaces.length === 0 ? (
									<p className="text-sm text-muted-foreground py-4 text-center">
										No workspaces match your search.
									</p>
								) : (
									<div className="space-y-1.5">
										{filteredWorkspaces.map((workspace) => (
											<button
												key={workspace.id}
												type="button"
												onClick={() => setSelectedWorkspaceId(workspace.id)}
												className={`w-full rounded-md border p-3 text-left transition-colors ${
													selectedWorkspaceId === workspace.id
														? "border-primary bg-primary/5"
														: "border-border hover:bg-muted/50"
												}`}
											>
												<div className="flex items-start justify-between gap-3">
													<div className="flex-1 min-w-0">
														<div className="flex items-center gap-2">
															<h3 className="text-sm font-medium truncate">
																{workspace.name}
															</h3>
															<span className="text-xs text-muted-foreground shrink-0">
																{workspace.visibility === "private"
																	? "Private"
																	: "Public"}
															</span>
														</div>
														{workspace.description && (
															<p className="text-xs text-muted-foreground mt-1 line-clamp-2">
																{workspace.description}
															</p>
														)}
													</div>
													{selectedWorkspaceId === workspace.id && (
														<div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />
													)}
												</div>
											</button>
										))}
									</div>
								)}
							</div>
						)}
					</div>

					<div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
						<p className="text-sm font-medium text-yellow-800">
							⚠️ Important: Workspace Linking
						</p>
						<p className="text-sm text-yellow-700 mt-1">
							Linking a workspace means Graphable will create and manage
							Graphable resources inside that Usable workspace. If the workspace
							is deleted in Usable, the tenant link will break and you'll need
							to re-link to a new workspace.
						</p>
					</div>

					<div className="flex justify-end gap-2">
						<Button
							variant="outline"
							onClick={() => router.push("/auth/signout")}
						>
							Sign Out
						</Button>
						<Button
							onClick={handleLinkWorkspace}
							disabled={!selectedWorkspaceId || isLinking}
						>
							{isLinking ? "Linking..." : "Link Workspace"}
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
