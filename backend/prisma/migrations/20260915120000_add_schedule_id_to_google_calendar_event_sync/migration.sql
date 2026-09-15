-- AlterTable: Add scheduleId column (nullable initially)
ALTER TABLE "GoogleCalendarEventSync" ADD COLUMN "scheduleId" TEXT;

-- Backfill: Associate existing sync records with their corresponding Schedule
-- Only backfills when exactly one Schedule matches (userId + eventId)
-- Records with 0 or 2+ matching Schedules remain NULL (will be cleaned up)
UPDATE "GoogleCalendarEventSync" gces
SET "scheduleId" = s."schedule_id"
FROM (
  SELECT gces_inner."id" AS gces_id, s_inner."id" AS schedule_id
  FROM "GoogleCalendarEventSync" gces_inner
  INNER JOIN "Schedule" s_inner
    ON s_inner."eventId" = gces_inner."eventId"
    AND s_inner."volunteerId" = gces_inner."userId"
  WHERE gces_inner."scheduleId" IS NULL
) s
WHERE gces."id" = s.gces_id
  AND (
    SELECT COUNT(*)
    FROM "Schedule" s_count
    WHERE s_count."eventId" = gces."eventId"
      AND s_count."volunteerId" = gces."userId"
  ) = 1;

-- Remove orphaned sync records (no matching Schedule)
DELETE FROM "GoogleCalendarEventSync"
WHERE "scheduleId" IS NULL;

-- AlterTable: Make scheduleId NOT NULL
ALTER TABLE "GoogleCalendarEventSync" ALTER COLUMN "scheduleId" SET NOT NULL;

-- DropIndex: Remove old unique constraint on (userId, eventId)
DROP INDEX "GoogleCalendarEventSync_userId_eventId_key";

-- CreateIndex: New unique constraint on scheduleId
CREATE UNIQUE INDEX "GoogleCalendarEventSync_scheduleId_key" ON "GoogleCalendarEventSync"("scheduleId");

-- CreateIndex: Index on scheduleId
CREATE INDEX "GoogleCalendarEventSync_scheduleId_idx" ON "GoogleCalendarEventSync"("scheduleId");

-- AddForeignKey
ALTER TABLE "GoogleCalendarEventSync" ADD CONSTRAINT "GoogleCalendarEventSync_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
