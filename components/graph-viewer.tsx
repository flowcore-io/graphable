"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { GraphFragmentData } from "@/lib/services/graph.service"

interface GraphViewerProps {
  graph: GraphFragmentData
}

/**
 * Graph viewer component using Recharts
 * Renders graphs based on visualization type
 */
export function GraphViewer({ graph }: GraphViewerProps) {
  // TODO: Implement actual Recharts rendering based on graph.visualization.type
  // For MVP, show placeholder

  return (
    <Card>
      <CardHeader>
        <CardTitle>Graph Visualization</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-center h-64 bg-muted rounded-md">
          <p className="text-muted-foreground">
            Graph visualization will be rendered here using Recharts
            <br />
            Type: {graph.visualization.type}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

