-- CreateEnum
CREATE TYPE "SwapRequestStatus" AS ENUM ('PENDENTE', 'APROVADO', 'RECUSADO', 'CANCELADO');

-- CreateTable
CREATE TABLE "SwapRequest" (
    "id" TEXT NOT NULL,
    "requesterShiftId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "requestedShiftId" TEXT NOT NULL,
    "requestedVolunteerId" TEXT NOT NULL,
    "status" "SwapRequestStatus" NOT NULL DEFAULT 'PENDENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SwapRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SwapRequest_requesterShiftId_idx" ON "SwapRequest"("requesterShiftId");

-- CreateIndex
CREATE INDEX "SwapRequest_requestedShiftId_idx" ON "SwapRequest"("requestedShiftId");

-- CreateIndex
CREATE INDEX "SwapRequest_requesterId_idx" ON "SwapRequest"("requesterId");

-- CreateIndex
CREATE INDEX "SwapRequest_requestedVolunteerId_idx" ON "SwapRequest"("requestedVolunteerId");

-- CreateIndex
CREATE INDEX "SwapRequest_status_idx" ON "SwapRequest"("status");

-- AddForeignKey
ALTER TABLE "SwapRequest" ADD CONSTRAINT "SwapRequest_requesterShiftId_fkey" FOREIGN KEY ("requesterShiftId") REFERENCES "Schedule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SwapRequest" ADD CONSTRAINT "SwapRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SwapRequest" ADD CONSTRAINT "SwapRequest_requestedShiftId_fkey" FOREIGN KEY ("requestedShiftId") REFERENCES "Schedule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SwapRequest" ADD CONSTRAINT "SwapRequest_requestedVolunteerId_fkey" FOREIGN KEY ("requestedVolunteerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
