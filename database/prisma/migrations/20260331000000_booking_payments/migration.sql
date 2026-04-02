-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM (
  'PENDING',
  'ORDER_CREATED',
  'PAID',
  'FAILED',
  'REFUNDED'
);

-- AlterTable
ALTER TABLE "Booking"
ADD COLUMN "paymentAmount" INTEGER,
ADD COLUMN "paymentCurrency" TEXT,
ADD COLUMN "paymentGateway" TEXT,
ADD COLUMN "paymentId" TEXT,
ADD COLUMN "paymentOrderId" TEXT,
ADD COLUMN "paymentPaidAt" TIMESTAMP(3),
ADD COLUMN "paymentSignature" TEXT,
ADD COLUMN "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING';
