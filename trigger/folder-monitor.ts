import { schedules } from "@trigger.dev/sdk"
import { meetScanTask } from "./meet-scan"

export const folderMonitorTask = schedules.task({
  id: "folder-monitor",
  run: async (payload) => {
    const { externalId: userId } = payload
    if (!userId) return

    await meetScanTask.trigger({ userId })
  },
})
