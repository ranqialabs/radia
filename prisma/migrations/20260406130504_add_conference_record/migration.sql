-- CreateTable
CREATE TABLE "conference_record" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recordName" TEXT NOT NULL,
    "spaceId" TEXT,
    "startTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "meetingMemoryId" TEXT,
    "transcriptIngested" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conference_record_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "conference_record_recordName_key" ON "conference_record"("recordName");

-- CreateIndex
CREATE UNIQUE INDEX "conference_record_meetingMemoryId_key" ON "conference_record"("meetingMemoryId");

-- CreateIndex
CREATE INDEX "conference_record_userId_idx" ON "conference_record"("userId");

-- AddForeignKey
ALTER TABLE "conference_record" ADD CONSTRAINT "conference_record_meetingMemoryId_fkey" FOREIGN KEY ("meetingMemoryId") REFERENCES "meeting_memory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
