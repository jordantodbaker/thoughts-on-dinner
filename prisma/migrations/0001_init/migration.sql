-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "VenueType" AS ENUM ('RESTAURANT', 'GROCERY', 'ACTIVITY');

-- CreateEnum
CREATE TYPE "ActivityCategory" AS ENUM ('ICE_SKATING', 'PINBALL', 'ARCADE', 'BOWLING', 'DARTS', 'DANCING', 'LIVE_MUSIC', 'TRIVIA', 'KARAOKE', 'COMEDY', 'THEATER', 'MOVIES', 'GAMES', 'OUTDOORS', 'OTHER');

-- CreateEnum
CREATE TYPE "Weekday" AS ENUM ('MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN');

-- CreateEnum
CREATE TYPE "RecordSource" AS ENUM ('SEED', 'AI', 'MANUAL');

-- CreateEnum
CREATE TYPE "Confidence" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "ScoutTarget" AS ENUM ('RESTAURANTS', 'GROCERY', 'ACTIVITIES');

-- CreateEnum
CREATE TYPE "ScoutStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "Venue" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "VenueType" NOT NULL,
    "category" "ActivityCategory",
    "cuisine" TEXT,
    "address" TEXT,
    "neighborhood" TEXT,
    "website" TEXT,
    "weeklyAdUrl" TEXT,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "source" "RecordSource" NOT NULL DEFAULT 'SEED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Venue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deal" (
    "id" SERIAL NOT NULL,
    "venueId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "days" "Weekday"[],
    "startTime" TEXT,
    "endTime" TEXT,
    "priceText" TEXT,
    "validFrom" DATE,
    "validTo" DATE,
    "sourceUrl" TEXT,
    "confidence" "Confidence" NOT NULL DEFAULT 'MEDIUM',
    "source" "RecordSource" NOT NULL DEFAULT 'SEED',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" SERIAL NOT NULL,
    "venueId" INTEGER NOT NULL,
    "category" "ActivityCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "recurring" BOOLEAN NOT NULL DEFAULT true,
    "days" "Weekday"[],
    "date" DATE,
    "startTime" TEXT,
    "endTime" TEXT,
    "priceText" TEXT,
    "sourceUrl" TEXT,
    "confidence" "Confidence" NOT NULL DEFAULT 'MEDIUM',
    "source" "RecordSource" NOT NULL DEFAULT 'SEED',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoutRun" (
    "id" SERIAL NOT NULL,
    "target" "ScoutTarget" NOT NULL,
    "status" "ScoutStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "model" TEXT,
    "summary" TEXT,
    "error" TEXT,
    "venuesUpserted" INTEGER NOT NULL DEFAULT 0,
    "dealsUpserted" INTEGER NOT NULL DEFAULT 0,
    "eventsUpserted" INTEGER NOT NULL DEFAULT 0,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "searches" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ScoutRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Venue_slug_key" ON "Venue"("slug");

-- CreateIndex
CREATE INDEX "Venue_type_active_idx" ON "Venue"("type", "active");

-- CreateIndex
CREATE INDEX "Venue_neighborhood_idx" ON "Venue"("neighborhood");

-- CreateIndex
CREATE INDEX "Deal_active_idx" ON "Deal"("active");

-- CreateIndex
CREATE UNIQUE INDEX "Deal_venueId_title_key" ON "Deal"("venueId", "title");

-- CreateIndex
CREATE INDEX "Event_active_recurring_idx" ON "Event"("active", "recurring");

-- CreateIndex
CREATE INDEX "Event_date_idx" ON "Event"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Event_venueId_title_date_key" ON "Event"("venueId", "title", "date");

-- CreateIndex
CREATE INDEX "ScoutRun_target_startedAt_idx" ON "ScoutRun"("target", "startedAt");

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

