"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import {
  AlertCircleIcon,
  CheckmarkCircle01Icon,
  GoogleDriveIcon,
} from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"

type IntegrationItemProps = {
  connected: boolean
  onConnectAction: () => void
}

export function IntegrationItem({
  connected,
  onConnectAction,
}: IntegrationItemProps) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        onClick={connected ? undefined : onConnectAction}
        className={cn(!connected && "text-muted-foreground")}
        tooltip={{
          children: connected
            ? "Google Drive connected"
            : "Click to connect Google Drive",
          hidden: false,
        }}
      >
        <HugeiconsIcon icon={GoogleDriveIcon} size={16} />
        <span className="flex-1">Google Drive</span>
        <HugeiconsIcon
          icon={connected ? CheckmarkCircle01Icon : AlertCircleIcon}
          size={14}
          className={connected ? "text-green-500" : "text-amber-500"}
        />
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}
