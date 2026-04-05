-- CreateTable
CREATE TABLE "meeting_memory" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mem0Ids" TEXT[],
    "title" TEXT,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meeting_memory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "meeting_memory_fileId_userId_key" ON "meeting_memory"("fileId", "userId");

-- AddForeignKey
ALTER TABLE "meeting_memory" ADD CONSTRAINT "meeting_memory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
