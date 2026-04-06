import { logger, metadata, schemaTask } from "@trigger.dev/sdk"
import { z } from "zod"
import { getValidAccessToken } from "../lib/google-drive"
import {
  buildFormattedTranscript,
  listConferenceRecords,
  listTranscriptsWithDoc,
} from "../lib/google-meet"
import { extractMemories } from "../lib/memory-extractor"
import {
  buildIngestionMessages,
  buildMeetingContext,
  extractMem0Ids,
} from "../lib/mem0-helpers"
import { mem0 } from "../lib/mem0"
import { prisma } from "../lib/prisma"

export const meetScanTask = schemaTask({
  id: "meet-scan",
  schema: z.object({ userId: z.string() }),
  maxDuration: 600,
  run: async ({ userId }) => {
    logger.log("Starting Meet scan", { userId })

    const accessToken = await getValidAccessToken(userId)

    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
    const conferences = await listConferenceRecords(accessToken, {
      filter: `startTime > "${since}"`,
    })

    logger.log(`Found ${conferences.length} conference records`, {
      conferences: conferences.map((c) => ({
        name: c.name,
        startTime: c.startTime,
      })),
    })

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
    metadata.set("processed", 0)

    let processed = 0

    for (const conference of toProcess) {
      logger.log(`Processing conference: ${conference.name}`, {
        startTime: conference.startTime,
      })

      const transcripts = await listTranscriptsWithDoc(
        accessToken,
        conference.name
      )
      const ready = transcripts.filter(
        (t) => t.state === "FILE_GENERATED" && t.docsFileId !== null
      )

      if (ready.length === 0) {
        logger.log(
          `No FILE_GENERATED transcripts yet for: ${conference.name}`,
          {
            states: transcripts.map((t) => t.state),
          }
        )
        // Not persisted — will be retried on next scan when transcripts are ready.
        continue
      }

      // Transcript is ready: register the record to prevent future reprocessing
      // if the task crashes mid-flight.
      const conferenceRow = await prisma.conferenceRecord.upsert({
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

      const transcript = ready[0]
      const docsFileId = transcript.docsFileId!

      // Fetch existing Drive memory link and raw transcript in parallel
      const [existingMemory, rawTranscript] = await Promise.all([
        prisma.meetingMemory.findUnique({
          where: { fileId_userId: { fileId: docsFileId, userId } },
        }),
        buildFormattedTranscript(accessToken, transcript.transcriptName),
      ])

      if (existingMemory && !conferenceRow.meetingMemoryId) {
        await prisma.conferenceRecord.update({
          where: { id: conferenceRow.id },
          data: { meetingMemoryId: existingMemory.id },
        })
      }

      if (!rawTranscript.trim()) {
        logger.log(`Empty raw transcript for: ${conference.name}, skipping`)
        await prisma.conferenceRecord.update({
          where: { id: conferenceRow.id },
          data: { transcriptIngested: true },
        })
        continue
      }

      logger.log(`Raw transcript: ${rawTranscript.split("\n").length} lines`)

      const meetingTitle = conference.startTime
        ? `Meet ${new Date(conference.startTime).toLocaleDateString("pt-BR")}`
        : conference.name

      const extracted = await extractMemories(
        [{ tabId: "meet-raw", title: "Raw Transcript", text: rawTranscript }],
        meetingTitle
      )

      logger.log(
        `Extracted ${extracted.memories.length} memories, ${extracted.entities.length} entities`,
        { participants: extracted.participants }
      )

      if (extracted.memories.length === 0 && extracted.entities.length === 0) {
        await prisma.conferenceRecord.update({
          where: { id: conferenceRow.id },
          data: { transcriptIngested: true },
        })
        continue
      }

      const meetingContext = buildMeetingContext(
        meetingTitle,
        extracted.participants
      )
      const messages = buildIngestionMessages(extracted, meetingContext)

      const result = await mem0.add(messages, {
        user_id: userId,
        run_id: conference.name,
        metadata: {
          conferenceRecord: conference.name,
          docsFileId,
          source: "google-meet",
          sourceType: "meeting-transcript-raw",
          participants: extracted.participants,
          startTime: conference.startTime,
        },
      })

      if (!Array.isArray(result)) {
        logger.warn(`Unexpected mem0.add response`, { result })
      }

      await prisma.conferenceRecord.update({
        where: { id: conferenceRow.id },
        data: { transcriptIngested: true },
      })

      processed++
      metadata.set("processed", processed)
      logger.log(`Ingested Meet transcript: ${conference.name}`, {
        mem0Ids: extractMem0Ids(result).length,
        docsFileId,
      })
    }

    logger.log("Meet scan complete", {
      processed,
      skipped: alreadyIngested.size,
    })
    return {
      processed,
      skipped: alreadyIngested.size,
      total: conferences.length,
    }
  },
})
