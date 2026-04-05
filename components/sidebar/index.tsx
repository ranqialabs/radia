"use client"

import { authClient } from "@/lib/auth-client"
import { useIntegrations } from "@/providers/integrations"
import { GOOGLE_SCOPES } from "@/lib/google-scopes"
import { GoogleDocIcon, GoogleDriveIcon } from "@hugeicons/core-free-icons"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { IntegrationItem } from "./integration-item"
import { AccountItem } from "./account-item"

export function AppSidebar() {
  const { data: session } = authClient.useSession()
  const { driveConnected, docsConnected } = useIntegrations()

  async function requestGoogleScope(scopes: string[]) {
    const { data } = await authClient.linkSocial({
      provider: "google",
      scopes,
      callbackURL: "/",
      disableRedirect: true,
    })
    if (data?.url) {
      const url = new URL(data.url)
      if (session?.user.email) url.searchParams.set("login_hint", session.user.email)
      window.location.href = url.toString()
    }
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="pointer-events-none">
              <div className="flex aspect-square size-8 items-center justify-center bg-primary text-xs font-bold text-primary-foreground">
                R
              </div>
              <span className="font-medium">Radia</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent />

      <SidebarFooter>
        <SidebarMenu>
          <IntegrationItem
            icon={GoogleDriveIcon}
            label="Google Drive"
            connected={driveConnected}
            onConnectAction={() => requestGoogleScope([GOOGLE_SCOPES.DRIVE_READONLY])}
          />
          <IntegrationItem
            icon={GoogleDocIcon}
            label="Google Docs"
            connected={docsConnected}
            onConnectAction={() => requestGoogleScope([GOOGLE_SCOPES.DOCS_READONLY])}
          />
          <AccountItem
            name={session?.user.name}
            email={session?.user.email}
            image={session?.user.image}
          />
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
