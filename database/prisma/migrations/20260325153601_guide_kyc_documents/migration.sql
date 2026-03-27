-- AlterTable
ALTER TABLE "GuideProfile" ADD COLUMN     "aadhaarImageBase64" TEXT,
ADD COLUMN     "aadhaarImageMimeType" TEXT,
ADD COLUMN     "aadhaarNumber" TEXT,
ADD COLUMN     "panImageBase64" TEXT,
ADD COLUMN     "panImageMimeType" TEXT,
ADD COLUMN     "panNumber" TEXT,
ADD COLUMN     "passportPhotoBase64" TEXT,
ADD COLUMN     "passportPhotoMimeType" TEXT;
