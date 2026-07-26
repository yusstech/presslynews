-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'EDITOR', 'JOURNALIST', 'COPY_EDITOR');

-- CreateEnum
CREATE TYPE "ArticleStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'REVISION_REQUESTED', 'READY_TO_PUBLISH', 'SCHEDULED', 'PUBLISHED', 'UPDATED', 'CORRECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ArticleType" AS ENUM ('NEWS', 'ANALYSIS', 'OPINION', 'FEATURE', 'INTERVIEW', 'BRIEFING');

-- CreateEnum
CREATE TYPE "MediaProcessingStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "hashedPassword" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'JOURNALIST',
    "locale" TEXT NOT NULL DEFAULT 'en',
    "avatarUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Country" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "defaultLanguage" TEXT NOT NULL DEFAULT 'en',

    CONSTRAINT "Country_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Language" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'ltr',

    CONSTRAINT "Language_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "Topic" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Topic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Media" (
    "id" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL DEFAULT 0,
    "width" INTEGER,
    "height" INTEGER,
    "alt" TEXT,
    "caption" TEXT,
    "photographer" TEXT,
    "copyrightHolder" TEXT,
    "usageRights" TEXT,
    "focalPointX" DOUBLE PRECISION,
    "focalPointY" DOUBLE PRECISION,
    "processingStatus" "MediaProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "variants" JSONB NOT NULL DEFAULT '{}',
    "countryId" TEXT,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Article" (
    "id" TEXT NOT NULL,
    "workingTitle" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "subheadline" TEXT,
    "slug" TEXT NOT NULL,
    "summary" TEXT,
    "bodyJson" JSONB NOT NULL DEFAULT '{"type":"doc","content":[]}',
    "status" "ArticleStatus" NOT NULL DEFAULT 'DRAFT',
    "articleType" "ArticleType" NOT NULL DEFAULT 'NEWS',
    "primaryLanguage" TEXT NOT NULL DEFAULT 'en',
    "readingTime" INTEGER NOT NULL DEFAULT 1,
    "isBreaking" BOOLEAN NOT NULL DEFAULT false,
    "homepagePlacement" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    "seoTitle" TEXT,
    "metaDescription" TEXT,
    "socialHeadline" TEXT,
    "socialDescription" TEXT,
    "publishAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "authorId" TEXT,
    "countryId" TEXT,
    "topicId" TEXT,
    "heroImageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Article_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArticleRevision" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "bodyJson" JSONB NOT NULL,
    "version" INTEGER NOT NULL,
    "editorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArticleRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArticleStatusEvent" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "fromStatus" "ArticleStatus",
    "toStatus" "ArticleStatus" NOT NULL,
    "actorId" TEXT,
    "comment" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArticleStatusEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_slug_key" ON "User"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Country_code_key" ON "Country"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Topic_slug_key" ON "Topic"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Article_slug_key" ON "Article"("slug");

-- CreateIndex
CREATE INDEX "Article_status_publishedAt_idx" ON "Article"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "Article_countryId_idx" ON "Article"("countryId");

-- CreateIndex
CREATE INDEX "Article_topicId_idx" ON "Article"("topicId");

-- CreateIndex
CREATE INDEX "ArticleRevision_articleId_idx" ON "ArticleRevision"("articleId");

-- CreateIndex
CREATE INDEX "ArticleStatusEvent_articleId_idx" ON "ArticleStatusEvent"("articleId");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_heroImageId_fkey" FOREIGN KEY ("heroImageId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleRevision" ADD CONSTRAINT "ArticleRevision_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleRevision" ADD CONSTRAINT "ArticleRevision_editorId_fkey" FOREIGN KEY ("editorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleStatusEvent" ADD CONSTRAINT "ArticleStatusEvent_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleStatusEvent" ADD CONSTRAINT "ArticleStatusEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
