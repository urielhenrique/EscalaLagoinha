-- CreateEnum
CREATE TYPE "AvailabilityDayOfWeek" AS ENUM ('SEGUNDA', 'TERCA', 'QUARTA', 'QUINTA', 'SEXTA', 'SABADO', 'DOMINGO');

-- CreateEnum
CREATE TYPE "AvailabilityPeriod" AS ENUM ('MANHA', 'TARDE', 'NOITE');

-- CreateEnum
CREATE TYPE "AvailabilityPreference" AS ENUM ('DISPONIVEL', 'INDISPONIVEL', 'PREFERENCIAL');

-- CreateEnum
CREATE TYPE "MinistryPreferenceType" AS ENUM ('PREFERENCIAL', 'INDISPONIVEL');

-- CreateTable
CREATE TABLE "VolunteerAvailability" (
    "id" TEXT NOT NULL,
    "volunteerId" TEXT NOT NULL,
    "dayOfWeek" "AvailabilityDayOfWeek" NOT NULL,
    "period" "AvailabilityPeriod" NOT NULL,
    "preference" "AvailabilityPreference" NOT NULL DEFAULT 'DISPONIVEL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VolunteerAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlockedDate" (
    "id" TEXT NOT NULL,
    "volunteerId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlockedDate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VolunteerMinistryPreference" (
    "id" TEXT NOT NULL,
    "volunteerId" TEXT NOT NULL,
    "ministryId" TEXT NOT NULL,
    "type" "MinistryPreferenceType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VolunteerMinistryPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VolunteerAvailability_volunteerId_idx" ON "VolunteerAvailability"("volunteerId");

-- CreateIndex
CREATE UNIQUE INDEX "VolunteerAvailability_volunteerId_dayOfWeek_period_key" ON "VolunteerAvailability"("volunteerId", "dayOfWeek", "period");

-- CreateIndex
CREATE INDEX "BlockedDate_volunteerId_idx" ON "BlockedDate"("volunteerId");

-- CreateIndex
CREATE UNIQUE INDEX "BlockedDate_volunteerId_date_key" ON "BlockedDate"("volunteerId", "date");

-- CreateIndex
CREATE INDEX "VolunteerMinistryPreference_volunteerId_idx" ON "VolunteerMinistryPreference"("volunteerId");

-- CreateIndex
CREATE INDEX "VolunteerMinistryPreference_ministryId_idx" ON "VolunteerMinistryPreference"("ministryId");

-- CreateIndex
CREATE UNIQUE INDEX "VolunteerMinistryPreference_volunteerId_ministryId_key" ON "VolunteerMinistryPreference"("volunteerId", "ministryId");

-- AddForeignKey
ALTER TABLE "VolunteerAvailability" ADD CONSTRAINT "VolunteerAvailability_volunteerId_fkey" FOREIGN KEY ("volunteerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockedDate" ADD CONSTRAINT "BlockedDate_volunteerId_fkey" FOREIGN KEY ("volunteerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VolunteerMinistryPreference" ADD CONSTRAINT "VolunteerMinistryPreference_volunteerId_fkey" FOREIGN KEY ("volunteerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VolunteerMinistryPreference" ADD CONSTRAINT "VolunteerMinistryPreference_ministryId_fkey" FOREIGN KEY ("ministryId") REFERENCES "Ministry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
