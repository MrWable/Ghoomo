-- CreateEnum
CREATE TYPE "GuideVerificationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "GuideProfile" ADD COLUMN     "verificationStatus" "GuideVerificationStatus" NOT NULL DEFAULT 'PENDING';
