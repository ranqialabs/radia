"use client"

import { useState, useTransition } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  AlertCircleIcon,
  ArrowRight01Icon,
  CheckmarkCircle01Icon,
  Folder01Icon,
  Folder02Icon,
} from "@hugeicons/core-free-icons"
import {
  getDriveFolderChildren,
  saveMonitoredFolder,
  type DriveFolder,
} from "@/actions/drive"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/loader"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"
import { AnimatePresence, motion } from "motion/react"

const INDENT = 16

type FolderNodeData = DriveFolder & {
  children: FolderNodeData[] | null // null = not yet fetched
}

const ROOT: FolderNodeData = { id: "root", name: "My Drive", children: null }

function DriveTreeNode({
  folder,
  depth,
  selectedId,
  onSelect,
}: {
  folder: FolderNodeData
  depth: number
  selectedId: string | null
  onSelect: (folder: DriveFolder) => void
}) {
  const [children, setChildren] = useState<FolderNodeData[] | null>(
    folder.children
  )
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const isSelected = selectedId === folder.id
  const fetched = children !== null
  const hasSubfolders = !fetched || children!.length > 0

  function handleToggle(e: React.MouseEvent) {
    e.stopPropagation()
    if (!hasSubfolders) return // already fetched, known empty — nothing to expand
    if (open) {
      setOpen(false)
      return
    }
    if (fetched) {
      setOpen(true)
      return
    }
    startTransition(async () => {
      const result = await getDriveFolderChildren(folder.id)
      setChildren(result.map((c) => ({ ...c, children: null })))
      setOpen(true)
    })
  }

  const paddingLeft = depth * INDENT + 8

  return (
    <div>
      <motion.div
        className={cn(
          "mx-1 flex cursor-pointer items-center gap-1.5 rounded-md py-1.5 pr-2 text-sm transition-colors",
          "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          isSelected &&
            "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
        )}
        style={{ paddingLeft }}
        onClick={() => onSelect({ id: folder.id, name: folder.name })}
        whileTap={{ scale: 0.98, transition: { duration: 0.1 } }}
      >
        {/* chevron — stopPropagation so it only toggles, doesn't select */}
        <span
          className="flex h-4 w-4 shrink-0 items-center justify-center"
          onClick={handleToggle}
        >
          {isPending ? (
            <Spinner size={10} />
          ) : hasSubfolders ? (
            <motion.span
              animate={{ rotate: open ? 90 : 0 }}
              transition={{ duration: 0.18, ease: "easeInOut" }}
              className="flex items-center justify-center"
            >
              <HugeiconsIcon
                icon={ArrowRight01Icon}
                size={12}
                className="text-sidebar-foreground/50"
              />
            </motion.span>
          ) : null}
        </span>

        {/* folder icon — swaps open/closed, also triggers expand on click */}
        <span onClick={handleToggle} className="flex shrink-0 items-center">
          <HugeiconsIcon
            icon={open ? Folder02Icon : Folder01Icon}
            size={15}
            className={cn(
              "transition-colors",
              isSelected ? "text-sidebar-primary" : "text-sidebar-foreground/60"
            )}
          />
        </span>

        <span className="flex-1 truncate">{folder.name}</span>
      </motion.div>

      <AnimatePresence initial={false}>
        {(open || isPending) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            {isPending && (
              <div
                className="flex items-center gap-2 py-1.5 text-xs text-muted-foreground"
                style={{ paddingLeft: paddingLeft + INDENT + 6 }}
              >
                <Spinner size={11} />
                <span>Loading…</span>
              </div>
            )}
            {open &&
              !isPending &&
              children?.map((child) => (
                <DriveTreeNode
                  key={child.id}
                  folder={child}
                  depth={depth + 1}
                  selectedId={selectedId}
                  onSelect={onSelect}
                />
              ))}
            {open && !isPending && children?.length === 0 && (
              <p
                className="py-1.5 text-xs text-muted-foreground italic"
                style={{ paddingLeft: paddingLeft + INDENT + 6 }}
              >
                No subfolders
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

type FolderMonitorItemProps = {
  monitoredFolder: DriveFolder | null
}

export function FolderMonitorItem({ monitoredFolder }: FolderMonitorItemProps) {
  const [open, setOpen] = useState(false)
  const [committed, setCommitted] = useState<DriveFolder | null>(
    monitoredFolder
  )
  const [selected, setSelected] = useState<DriveFolder | null>(monitoredFolder)
  const [saving, startSave] = useTransition()

  const isConfigured = committed !== null

  function handleOpenChange(next: boolean) {
    if (!next) setSelected(committed) // discard unsaved picks on close
    setOpen(next)
  }

  function handleSave() {
    if (!selected) return
    startSave(async () => {
      await saveMonitoredFolder(selected.id, selected.name)
      setCommitted(selected)
      setOpen(false)
    })
  }

  return (
    <SidebarMenuItem>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SidebarMenuButton
          onClick={() => setOpen(true)}
          className={cn(!isConfigured && "text-muted-foreground")}
          tooltip={{
            children: isConfigured
              ? `Monitoring: ${committed!.name}`
              : "No folder monitored yet",
            hidden: false,
          }}
        >
          <HugeiconsIcon icon={Folder01Icon} size={16} />
          <span className="flex-1 truncate">
            {isConfigured ? committed!.name : "Google Drive Folder"}
          </span>
          <HugeiconsIcon
            icon={isConfigured ? CheckmarkCircle01Icon : AlertCircleIcon}
            size={14}
            className={isConfigured ? "text-green-500" : "text-amber-500"}
          />
        </SidebarMenuButton>

        <SheetContent side="left" className="flex w-80 flex-col sm:max-w-80">
          <SheetHeader>
            <SheetTitle>Google Drive Folder</SheetTitle>
            <SheetDescription>
              Select a Google Drive folder to scan every 30 minutes.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto py-2">
            <DriveTreeNode
              folder={ROOT}
              depth={0}
              selectedId={selected?.id ?? null}
              onSelect={setSelected}
            />
          </div>

          <SheetFooter>
            <Button
              onClick={handleSave}
              disabled={!selected || saving}
              className="w-full"
            >
              {saving ? <Spinner size={16} /> : "Save"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </SidebarMenuItem>
  )
}
