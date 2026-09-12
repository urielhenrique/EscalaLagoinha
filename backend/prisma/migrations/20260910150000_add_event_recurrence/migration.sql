-- CreateEnum
CREATE TYPE "RecurrenceType" AS ENUM ('NONE', 'WEEKLY');

-- AlterTable: Add recurrence fields to Event
ALTER TABLE "Event" ADD COLUMN "recurrenceGroupId" TEXT,
ADD COLUMN "recurrenceType" "RecurrenceType" NOT NULL DEFAULT 'NONE',
ADD COLUMN "recurrenceDays" TEXT[] NOT NULL DEFAULT '{}',
ADD COLUMN "recurrenceStart" TIMESTAMP(3),
ADD COLUMN "recurrenceEnd" TIMESTAMP(3),
ADD COLUMN "recurrenceIndex" INTEGER;

-- CreateIndex
CREATE INDEX "Event_recurrenceGroupId_idx" ON "Event"("recurrenceGroupId");
