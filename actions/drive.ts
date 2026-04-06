"use server"

import {
  getDriveClient,
  getValidAccessToken,
  listDriveFolders,
} from "@/lib/google-drive"
import { prisma } from "@/lib/prisma"
import { getServerSession, requireServerSession } from "@/lib/session"
import { schedules } from "@trigger.dev/sdk"
import { folderMonitorTask } from "@/trigger/folder-monitor"

export type DriveFolder = {
  id: string
  name: string
}

export async function getDriveFolderChildren(
  parentId: string
): Promise<DriveFolder[]> {
  const session = await requireServerSession()
  const accessToken = await getValidAccessToken(session.user.id)
  const drive = getDriveClient(accessToken)
  const folders = await listDriveFolders(drive, parentId)

  return folders
    .filter((f) => f.id && f.name)
    .map((f) => ({ id: f.id!, name: f.name! }))
}

export async function getMonitoredFolder(): Promise<DriveFolder | null> {
  const session = await getServerSession()
  if (!session) return null

  const folder = await prisma.monitoredFolder.findUnique({
    where: { userId: session.user.id },
    select: { folderId: true, folderName: true },
  })

  if (!folder) return null
  return { id: folder.folderId, name: folder.folderName }
}

export async function saveMonitoredFolder(
  folderId: string,
  folderName: string
): Promise<void> {
  const session = await requireServerSession()

  const userId = session.user.id

  const existing = await prisma.monitoredFolder.findUnique({
    where: { userId },
    select: { scheduleId: true },
  })

  if (existing?.scheduleId) {
    await schedules.del(existing.scheduleId).catch(() => null)
  }

  // externalId = userId so folderMonitorTask can look up the folder without extra args
  const schedule = await schedules.create({
    task: folderMonitorTask.id,
    cron: "*/30 * * * *",
    externalId: userId,
    deduplicationKey: `${userId}-folder-monitor`,
  })

  await prisma.monitoredFolder.upsert({
    where: { userId },
    create: { userId, folderId, folderName, scheduleId: schedule.id },
    update: { folderId, folderName, scheduleId: schedule.id },
  })
}
