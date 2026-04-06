import { meet_v2 } from "@googleapis/meet"
import { meet } from "@googleapis/meet"
import { OAuth2Client } from "google-auth-library"

export type ConferenceRecord = {
  name: string
  startTime: string | null
  endTime: string | null
  spaceId: string | null
}

export type TranscriptWithDoc = {
  transcriptName: string
  state: string
  docsFileId: string | null
}

export type TranscriptEntry = {
  participant: string
  text: string
  startTime: string | null
  endTime: string | null
  languageCode: string | null
}

export function getMeetClient(accessToken: string): meet_v2.Meet {
  const auth = new OAuth2Client()
  auth.setCredentials({ access_token: accessToken })
  return meet({ version: "v2", auth })
}

export async function listConferenceRecords(
  client: meet_v2.Meet,
  options?: { filter?: string }
): Promise<ConferenceRecord[]> {
  const records: ConferenceRecord[] = []
  let pageToken: string | undefined

  do {
    const res = await client.conferenceRecords.list({
      pageSize: 100,
      pageToken,
      filter: options?.filter,
    })

    for (const r of res.data.conferenceRecords ?? []) {
      records.push({
        name: r.name!,
        startTime: r.startTime ?? null,
        endTime: r.endTime ?? null,
        spaceId: r.space ?? null,
      })
    }

    pageToken = res.data.nextPageToken ?? undefined
  } while (pageToken)

  return records
}

export async function listTranscriptsWithDoc(
  client: meet_v2.Meet,
  conferenceRecordName: string
): Promise<TranscriptWithDoc[]> {
  const res = await client.conferenceRecords.transcripts.list({
    parent: conferenceRecordName,
  })

  return (res.data.transcripts ?? []).map((t) => ({
    transcriptName: t.name!,
    state: t.state ?? "STATE_UNSPECIFIED",
    docsFileId: t.docsDestination?.document ?? null,
  }))
}

async function* iterTranscriptEntries(
  client: meet_v2.Meet,
  transcriptName: string
): AsyncGenerator<TranscriptEntry> {
  let pageToken: string | undefined

  do {
    const res = await client.conferenceRecords.transcripts.entries.list({
      parent: transcriptName,
      pageSize: 100,
      pageToken,
    })

    for (const e of res.data.transcriptEntries ?? []) {
      yield {
        participant: e.participant ?? "",
        text: e.text ?? "",
        startTime: e.startTime ?? null,
        endTime: e.endTime ?? null,
        languageCode: e.languageCode ?? null,
      }
    }

    pageToken = res.data.nextPageToken ?? undefined
  } while (pageToken)
}

export async function resolveParticipant(
  client: meet_v2.Meet,
  participantName: string
): Promise<string | null> {
  try {
    const res = await client.conferenceRecords.participants.get({
      name: participantName,
    })
    return (
      res.data.signedinUser?.displayName ??
      res.data.anonymousUser?.displayName ??
      null
    )
  } catch {
    return null
  }
}

export async function buildFormattedTranscript(
  client: meet_v2.Meet,
  transcriptName: string
): Promise<string> {
  const nameMap = new Map<string, string>()
  const lines: string[] = []

  for await (const e of iterTranscriptEntries(client, transcriptName)) {
    if (e.participant && !nameMap.has(e.participant)) {
      const name = await resolveParticipant(client, e.participant)
      nameMap.set(e.participant, name ?? "Unknown")
    }

    const speaker = nameMap.get(e.participant) ?? "Unknown"
    const time = e.startTime ? new Date(e.startTime).toISOString() : ""
    lines.push(`[${time}] ${speaker}: ${e.text}`)
  }

  return lines.join("\n")
}
