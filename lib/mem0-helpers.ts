import type { ExtractedMemories } from "./memory-extractor"

export function buildMeetingContext(
  title: string,
  participants: string[]
): string {
  return participants.length
    ? `[Meeting: ${title} | Participants: ${participants.join(", ")}]`
    : `[Meeting: ${title}]`
}

export function buildIngestionMessages(
  extracted: ExtractedMemories,
  meetingContext: string
) {
  const entityMessages = extracted.entities.map((e) => ({
    role: "user" as const,
    content: `${meetingContext} Entity: ${e.name} is a ${e.type}${e.description ? ` — ${e.description}` : ""}${e.aliases.length ? `. Also referred to as: ${e.aliases.join(", ")}` : ""}.`,
  }))

  const memoryMessages = extracted.memories.map((m) => ({
    role: "user" as const,
    content: `${meetingContext} ${m.content}`,
  }))

  // Entities first so mem0 has entity context before processing facts
  return [...entityMessages, ...memoryMessages]
}

export function extractMem0Ids(result: unknown): string[] {
  return Array.isArray(result)
    ? result
        .map((r: { id?: string }) => r.id)
        .filter((id): id is string => id !== undefined)
    : []
}
