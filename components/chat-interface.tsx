"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { MessageSquareIcon, SendIcon } from "lucide-react"
import { useState } from "react"

/**
 * Mocked chat interface component (UI only, no interaction)
 * Displays a chat-like interface but does not process messages or generate graphs
 */
export function ChatInterface() {
  const [messages] = useState<Array<{ id: string; role: "user" | "assistant"; content: string }>>([
    {
      id: "1",
      role: "assistant",
      content:
        "Hello! I'm your Graphable assistant. I can help you create graphs and dashboards using @datasource references.",
    },
    {
      id: "2",
      role: "user",
      content: "Create a graph showing sales over time from @datasource:postgres",
    },
    {
      id: "3",
      role: "assistant",
      content: "I'm a mocked interface. Full chat functionality will be implemented in a future phase.",
    },
  ])

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquareIcon className="h-5 w-5" />
          Chat Assistant
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-4">
        {/* Messages */}
        <div className="flex-1 space-y-4 overflow-y-auto">
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2 ${
                  message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                }`}
              >
                <p className="text-sm">{message.content}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Input area (disabled - mocked) */}
        <div className="flex gap-2">
          <Input placeholder="Type a message... (mocked - no interaction)" disabled className="flex-1" />
          <Button disabled size="icon">
            <SendIcon className="h-4 w-4" />
          </Button>
        </div>

        {/* Mocked notice */}
        <div className="text-xs text-muted-foreground text-center border-t pt-2">
          This is a mocked chat interface. Full chat functionality will be implemented in a future phase.
        </div>
      </CardContent>
    </Card>
  )
}
