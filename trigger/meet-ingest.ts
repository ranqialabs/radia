import { logger, schemaTask } from "@trigger.dev/sdk"
import { z } from "zod"
import {
  getValidAccessToken,
  getDriveClient,
  getDocTitle,
} from "../lib/google-drive"
import { getMeetClient, buildFormattedTranscript } from "../lib/google-meet"
import { extractMemories } from "../lib/memory-extractor"
import {
  buildIngestionMessages,
  buildMeetingContext,
  extractMem0Ids,
} from "../lib/mem0-helpers"
import { mem0 } from "../lib/mem0"
import { prisma } from "../lib/prisma"

export const meetIngestTask = schemaTask({
  id: "meet-ingest",
  schema: z.object({
    userId: z.string(),
    conferenceRecordId: z.string(),
    recordName: z.string(),
    transcriptName: z.string(),
    docsFileId: z.string(),
    startTime: z.string().nullable(),
  }),
  maxDuration: 300,
  run: async ({
    userId,
    conferenceRecordId,
    recordName,
    transcriptName,
    docsFileId,
    startTime,
  }) => {
    const accessToken = await getValidAccessToken(userId)
    const meetClient = getMeetClient(accessToken)
    const driveClient = getDriveClient(accessToken)

    // Only look up the Drive memory link if not already linked from a prior run
    const conferenceRow = await prisma.conferenceRecord.findUnique({
      where: { id: conferenceRecordId },
      select: { meetingMemoryId: true },
    })

    const [existingMemory, rawTranscript, docName] = await Promise.all([
      conferenceRow?.meetingMemoryId
        ? Promise.resolve(null)
        : prisma.meetingMemory.findUnique({
            where: { fileId_userId: { fileId: docsFileId, userId } },
          }),
      buildFormattedTranscript(meetClient, transcriptName),
      getDocTitle(driveClient, docsFileId),
    ])

    if (existingMemory) {
      await prisma.conferenceRecord.update({
        where: { id: conferenceRecordId },
        data: { meetingMemoryId: existingMemory.id },
      })
    }

    if (!rawTranscript.trim()) {
      logger.log("Empty raw transcript, skipping")
      await prisma.conferenceRecord.update({
        where: { id: conferenceRecordId },
        data: { transcriptIngested: true },
      })
      return { status: "empty" }
    }

    const lineCount = (rawTranscript.match(/\n/g) ?? []).length + 1
    logger.log(`Raw transcript: ${lineCount} lines`)

    // Strip auto-generated timestamp and "Transcript" suffix from Meet doc names
    const meetingTitle =
      docName?.replace(/\s*\(.*?\)\s*-\s*Transcript\s*$/i, "").trim() ||
      (startTime
        ? `Meet ${new Date(startTime).toLocaleDateString("pt-BR")}`
        : recordName)

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
        where: { id: conferenceRecordId },
        data: { transcriptIngested: true },
      })
      return { status: "no-memories" }
    }

    const meetingContext = buildMeetingContext(
      meetingTitle,
      extracted.participants
    )
    const messages = buildIngestionMessages(extracted, meetingContext)

    const result = await mem0.add(messages, {
      user_id: userId,
      run_id: recordName,
      metadata: {
        conferenceRecord: recordName,
        docsFileId,
        source: "google-meet",
        sourceType: "meeting-transcript-raw",
        participants: extracted.participants,
        startTime,
      },
    })

    if (!Array.isArray(result)) {
      logger.warn("Unexpected mem0.add response", { result })
    }

    await prisma.conferenceRecord.update({
      where: { id: conferenceRecordId },
      data: { transcriptIngested: true },
    })

    const mem0Ids = extractMem0Ids(result)
    logger.log("Ingested", { mem0Ids: mem0Ids.length, docsFileId })

    return { status: "ok", mem0Ids: mem0Ids.length }
  },
})
