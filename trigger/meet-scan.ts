import { logger, metadata, schemaTask } from "@trigger.dev/sdk"
import { z } from "zod"
import { getValidAccessToken } from "../lib/google-drive"
import {
  listConferenceRecords,
  listTranscriptsWithDoc,
} from "../lib/google-meet"
import { prisma } from "../lib/prisma"
import { meetIngestTask } from "./meet-ingest"

export const meetScanTask = schemaTask({
  id: "meet-scan",
  schema: z.object({ userId: z.string() }),
  maxDuration: 120,
  run: async ({ userId }) => {
    logger.log("Starting Meet scan", { userId })

    const accessToken = await getValidAccessToken(userId)

    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
    const conferences = await listConferenceRecords(accessToken, {
      filter: `startTime > "${since}"`,
    })

    logger.log(`Found ${conferences.length} conference records`)

    const alreadyIngested = new Set(
      (
        await prisma.conferenceRecord.findMany({
          where: {
            userId,
            recordName: { in: conferences.map((c) => c.name) },
            transcriptIngested: true,
          },
          select: { recordName: true },
        })
      ).map((r) => r.recordName)
    )

    const toProcess = conferences.filter((c) => !alreadyIngested.has(c.name))

    metadata.set("total", conferences.length)
    metadata.set("skipped", alreadyIngested.size)

    if (toProcess.length === 0) {
      logger.log("Nothing to process")
      return {
        dispatched: 0,
        skipped: alreadyIngested.size,
        total: conferences.length,
      }
    }

    // Fetch transcripts for all pending conferences in parallel
    const transcriptResults = await Promise.all(
      toProcess.map(async (conference) => ({
        conference,
        ready:
          (await listTranscriptsWithDoc(accessToken, conference.name)).find(
            (t) => t.state === "FILE_GENERATED" && t.docsFileId !== null
          ) ?? null,
      }))
    )

    const readyItems = transcriptResults.filter((r) => r.ready !== null) as {
      conference: (typeof toProcess)[number]
      ready: NonNullable<(typeof transcriptResults)[number]["ready"]>
    }[]

    if (readyItems.length === 0) {
      logger.log("No conferences with ready transcripts")
      return {
        dispatched: 0,
        skipped: alreadyIngested.size,
        total: conferences.length,
      }
    }

    // Register all ready conferences in parallel
    const conferenceRows = await Promise.all(
      readyItems.map(({ conference }) =>
        prisma.conferenceRecord.upsert({
          where: { recordName: conference.name },
          create: {
            userId,
            recordName: conference.name,
            spaceId: conference.spaceId,
            startTime: conference.startTime
              ? new Date(conference.startTime)
              : null,
            endTime: conference.endTime ? new Date(conference.endTime) : null,
          },
          update: {},
        })
      )
    )

    const batch = readyItems.map(({ conference, ready }, i) => ({
      payload: {
        userId,
        conferenceRecordId: conferenceRows[i].id,
        recordName: conference.name,
        transcriptName: ready.transcriptName,
        docsFileId: ready.docsFileId!,
        startTime: conference.startTime,
      },
    }))

    await meetIngestTask.batchTrigger(batch)

    logger.log(`Dispatched ${batch.length} ingest tasks`, {
      skipped: alreadyIngested.size,
    })

    return {
      dispatched: batch.length,
      skipped: alreadyIngested.size,
      total: conferences.length,
    }
  },
})
