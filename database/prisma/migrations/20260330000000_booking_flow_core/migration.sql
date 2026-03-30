-- AlterEnum
ALTER TYPE "BookingStatus" ADD VALUE 'REJECTED';
ALTER TYPE "BookingStatus" ADD VALUE 'IN_PROGRESS';
ALTER TYPE "BookingStatus" ADD VALUE 'NO_SHOW';

-- DropIndex
DROP INDEX "Review_touristId_guideProfileId_key";

-- AlterTable
ALTER TABLE "Booking"
ADD COLUMN "cancellationReason" TEXT,
ADD COLUMN "cancelledAt" TIMESTAMP(3),
ADD COLUMN "completedAt" TIMESTAMP(3),
ADD COLUMN "confirmedAt" TIMESTAMP(3),
ADD COLUMN "endAt" TIMESTAMP(3),
ADD COLUMN "guestCount" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "meetingPoint" TEXT,
ADD COLUMN "startAt" TIMESTAMP(3),
ADD COLUMN "timezone" TEXT;

ALTER TABLE "GuideProfile"
ADD COLUMN "acceptingBookings" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Review"
ADD COLUMN "bookingId" TEXT,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill
UPDATE "Booking"
SET
  "startAt" = COALESCE("startAt", "travelDate"),
  "endAt" = COALESCE("endAt", "travelDate" + INTERVAL '4 hours')
WHERE "startAt" IS NULL OR "endAt" IS NULL;

UPDATE "GuideProfile"
SET "acceptingBookings" = false
WHERE "verificationStatus" <> 'APPROVED'
   OR "isVerified" = false
   OR "isAvailable" = false;

ALTER TABLE "Review"
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "GuideAvailabilityBlock" (
    "id" TEXT NOT NULL,
    "guideProfileId" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuideAvailabilityBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GuideAvailabilityBlock_guideProfileId_startAt_endAt_idx"
ON "GuideAvailabilityBlock"("guideProfileId", "startAt", "endAt");

CREATE INDEX "Booking_guideProfileId_status_startAt_endAt_idx"
ON "Booking"("guideProfileId", "status", "startAt", "endAt");

CREATE INDEX "Booking_touristId_status_travelDate_idx"
ON "Booking"("touristId", "status", "travelDate");

CREATE UNIQUE INDEX "Review_bookingId_key" ON "Review"("bookingId");

CREATE INDEX "Review_guideProfileId_createdAt_idx"
ON "Review"("guideProfileId", "createdAt");

CREATE INDEX "Review_touristId_createdAt_idx"
ON "Review"("touristId", "createdAt");

-- AddForeignKey
ALTER TABLE "Review"
ADD CONSTRAINT "Review_bookingId_fkey"
FOREIGN KEY ("bookingId") REFERENCES "Booking"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GuideAvailabilityBlock"
ADD CONSTRAINT "GuideAvailabilityBlock_guideProfileId_fkey"
FOREIGN KEY ("guideProfileId") REFERENCES "GuideProfile"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
