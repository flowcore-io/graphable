import { AppShell } from "@/components/app-shell"
import { Providers } from "@/components/providers"
import { authOptions } from "@/lib/auth"
import { getWorkspaceForUser } from "@/lib/services/tenant.service"
import type { Metadata } from "next"
import { getServerSession } from "next-auth"
import { Geist_Mono, Inter } from "next/font/google"
import "./globals.css"

/* Usable Design System: Inter font family for all text */
/* Weights: 300 (light), 400 (regular), 600 (semibold), 700 (bold), 900 (black) */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["300", "400", "600", "700", "900"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Graphable - AI-first Graphical Service",
  description: "Create, manage, and visualize your data with AI-powered graphs and dashboards",
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Fetch workspace ID server-side if user is authenticated
  let initialWorkspaceId: string | null = null
  try {
    const session = await getServerSession(authOptions)
    if (session?.user?.id) {
      initialWorkspaceId = await getWorkspaceForUser(session.user.id)
    }
  } catch (error) {
    // Silently fail - workspace will be loaded client-side
    console.error("Failed to fetch workspace server-side:", error)
  }

  return (
    <html lang="en" className={inter.variable}>
      <body className={`${inter.variable} ${geistMono.variable} antialiased`}>
        <Providers initialWorkspaceId={initialWorkspaceId}>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  )
}
