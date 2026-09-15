-- DropIndex
DROP INDEX "Ministry_nome_key";

-- AlterTable
ALTER TABLE "Event" ALTER COLUMN "recurrenceDays" DROP DEFAULT;

-- CreateTable
CREATE TABLE "GoogleCalendarEventSync" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "googleEventId" TEXT,
    "syncStatus" "GoogleSyncStatus" NOT NULL DEFAULT 'NONE',
    "lastSyncedAt" TIMESTAMP(3),
    "syncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleCalendarEventSync_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GoogleCalendarEventSync_userId_idx" ON "GoogleCalendarEventSync"("userId");

-- CreateIndex
CREATE INDEX "GoogleCalendarEventSync_eventId_idx" ON "GoogleCalendarEventSync"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "GoogleCalendarEventSync_userId_eventId_key" ON "GoogleCalendarEventSync"("userId", "eventId");

-- CreateIndex
CREATE INDEX "UserFeedback_status_idx" ON "UserFeedback"("status");

-- AddForeignKey
ALTER TABLE "GoogleCalendarEventSync" ADD CONSTRAINT "GoogleCalendarEventSync_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoogleCalendarEventSync" ADD CONSTRAINT "GoogleCalendarEventSync_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
