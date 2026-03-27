-- CreateTable
CREATE TABLE "CityPlace" (
    "id" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "summary" TEXT,
    "imageBase64" TEXT NOT NULL,
    "imageMimeType" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CityPlace_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CityPlace_cityId_displayOrder_idx" ON "CityPlace"("cityId", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "CityPlace_cityId_slug_key" ON "CityPlace"("cityId", "slug");

-- AddForeignKey
ALTER TABLE "CityPlace" ADD CONSTRAINT "CityPlace_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE CASCADE ON UPDATE CASCADE;
