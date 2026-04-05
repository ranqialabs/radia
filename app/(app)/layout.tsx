import { Suspense } from "react"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { IntegrationsProvider } from "@/providers/integrations"

async function hasDriveScope(userId: string) {
  const account = await prisma.account.findFirst({
    where: { userId, providerId: "google" },
    select: { scope: true },
  })
  return account?.scope?.includes("drive") ?? false
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth.api.getSession({ headers: await headers() })
  const driveConnected = session ? await hasDriveScope(session.user.id) : false

  return (
    <IntegrationsProvider value={{ driveConnected }}>
      <SidebarProvider>
        <Suspense>
          <AppSidebar />
        </Suspense>
        <SidebarInset>
          <header className="flex h-12 items-center border-b px-4">
            <SidebarTrigger />
          </header>
          <main className="flex-1 p-6">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </IntegrationsProvider>
  )
}
