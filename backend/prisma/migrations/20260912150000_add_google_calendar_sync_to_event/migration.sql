-- CreateEnum
CREATE TYPE "GoogleSyncStatus" AS ENUM ('NONE', 'PENDING', 'SYNCED', 'ERROR');

-- AlterTable
ALTER TABLE "Event" ADD COLUMN "googleEventId" TEXT,
ADD COLUMN "googleSyncStatus" "GoogleSyncStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN "lastSyncedAt" TIMESTAMP(3),
ADD COLUMN "googleSyncError" TEXT;
