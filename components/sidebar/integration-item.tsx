"use client"

import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import {
  AlertCircleIcon,
  CheckmarkCircle01Icon,
} from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"

type IntegrationItemProps = {
  icon: IconSvgElement
  label: string
  connected: boolean
  onConnectAction: () => void
}

export function IntegrationItem({
  icon,
  label,
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
            ? `${label} connected`
            : `Click to connect ${label}`,
          hidden: false,
        }}
      >
        <HugeiconsIcon icon={icon} size={16} />
        <span className="flex-1">{label}</span>
        <HugeiconsIcon
          icon={connected ? CheckmarkCircle01Icon : AlertCircleIcon}
          size={14}
          className={connected ? "text-green-500" : "text-amber-500"}
        />
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}
