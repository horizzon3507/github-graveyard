-- CreateEnum
CREATE TYPE "AnalysisStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETE', 'FAILED');

-- CreateEnum
CREATE TYPE "AnalysisDepth" AS ENUM ('QUICK', 'DEEP');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('EASY', 'MODERATE', 'HARD', 'EXTREME');

-- CreateEnum
CREATE TYPE "Effort" AS ENUM ('SMALL', 'MEDIUM', 'LARGE');

-- CreateEnum
CREATE TYPE "RepositorySource" AS ENUM ('INGEST', 'SEARCH', 'ANALYZE', 'FORK');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "githubId" BIGINT NOT NULL,
    "login" TEXT NOT NULL,
    "loginLower" TEXT NOT NULL,
    "name" TEXT,
    "avatarUrl" TEXT,
    "htmlUrl" TEXT NOT NULL,
    "bio" TEXT,
    "favoriteTech" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Repository" (
    "id" TEXT NOT NULL,
    "githubId" BIGINT NOT NULL,
    "owner" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "htmlUrl" TEXT NOT NULL,
    "homepage" TEXT,
    "language" TEXT,
    "topics" TEXT[],
    "categories" TEXT[],
    "license" TEXT,
    "licenseName" TEXT,
    "stars" INTEGER NOT NULL DEFAULT 0,
    "forks" INTEGER NOT NULL DEFAULT 0,
    "watchers" INTEGER NOT NULL DEFAULT 0,
    "openIssues" INTEGER NOT NULL DEFAULT 0,
    "sizeKb" INTEGER NOT NULL DEFAULT 0,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "isFork" BOOLEAN NOT NULL DEFAULT false,
    "parentSlug" TEXT,
    "defaultBranch" TEXT NOT NULL DEFAULT 'main',
    "ownerType" TEXT NOT NULL DEFAULT 'User',
    "ghCreatedAt" TIMESTAMP(3) NOT NULL,
    "pushedAt" TIMESTAMP(3) NOT NULL,
    "lastCommitAt" TIMESTAMP(3),
    "lastReleaseAt" TIMESTAMP(3),
    "lastActivityAt" TIMESTAMP(3) NOT NULL,
    "contributors" INTEGER,
    "graveScore" INTEGER,
    "revivalScore" INTEGER,
    "hiddenGemScore" INTEGER,
    "communityScore" INTEGER,
    "difficulty" "Difficulty",
    "activeForkCount" INTEGER,
    "analysisDepth" "AnalysisDepth" NOT NULL DEFAULT 'QUICK',
    "source" "RepositorySource" NOT NULL DEFAULT 'SEARCH',
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Repository_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepositorySnapshot" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "depth" "AnalysisDepth" NOT NULL,
    "stars" INTEGER NOT NULL,
    "forks" INTEGER NOT NULL,
    "watchers" INTEGER NOT NULL,
    "openIssues" INTEGER NOT NULL,
    "contributors" INTEGER,
    "pushedAt" TIMESTAMP(3) NOT NULL,
    "lastCommitAt" TIMESTAMP(3),
    "lastReleaseAt" TIMESTAMP(3),
    "data" JSONB NOT NULL,

    CONSTRAINT "RepositorySnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepositoryAnalysis" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "status" "AnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "depth" "AnalysisDepth" NOT NULL DEFAULT 'QUICK',
    "algorithmVersion" INTEGER NOT NULL,
    "graveScore" INTEGER NOT NULL,
    "graveConfidence" INTEGER NOT NULL,
    "revivalScore" INTEGER NOT NULL,
    "revivalConfidence" INTEGER NOT NULL,
    "hiddenGemScore" INTEGER NOT NULL,
    "communityScore" INTEGER NOT NULL,
    "difficulty" "Difficulty",
    "effort" "Effort",
    "graveFactors" JSONB NOT NULL,
    "revivalFactors" JSONB NOT NULL,
    "abandonmentSignals" JSONB NOT NULL,
    "communitySignals" JSONB NOT NULL,
    "technologies" JSONB NOT NULL,
    "challenges" JSONB NOT NULL,
    "modernizationSuggestions" JSONB NOT NULL,
    "roadmap" JSONB NOT NULL,
    "issuesWorthSolving" JSONB NOT NULL,
    "licenseAssessment" JSONB NOT NULL,
    "buildSignal" JSONB NOT NULL,
    "dependencyHealth" JSONB NOT NULL,
    "summary" TEXT,
    "summarySource" TEXT,
    "notes" JSONB NOT NULL,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "lastAnalyzedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RepositoryAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepositoryFork" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "htmlUrl" TEXT NOT NULL,
    "description" TEXT,
    "stars" INTEGER NOT NULL DEFAULT 0,
    "pushedAt" TIMESTAMP(3) NOT NULL,
    "aheadBy" INTEGER,
    "behindBy" INTEGER,
    "recentCommits" INTEGER,
    "contributors" INTEGER,
    "lastCommitAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RepositoryFork_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Collection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionRepository" (
    "collectionId" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "note" TEXT,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollectionRepository_pkey" PRIMARY KEY ("collectionId","repositoryId")
);

-- CreateTable
CREATE TABLE "RevivalInterest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RevivalInterest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResurrectionProject" (
    "id" TEXT NOT NULL,
    "originalId" TEXT NOT NULL,
    "revivalId" TEXT NOT NULL,
    "registeredById" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResurrectionProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CacheEntry" (
    "key" TEXT NOT NULL,
    "etag" TEXT,
    "status" INTEGER NOT NULL,
    "body" JSONB,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CacheEntry_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_githubId_key" ON "User"("githubId");

-- CreateIndex
CREATE UNIQUE INDEX "User_loginLower_key" ON "User"("loginLower");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Repository_githubId_key" ON "Repository"("githubId");

-- CreateIndex
CREATE UNIQUE INDEX "Repository_slug_key" ON "Repository"("slug");

-- CreateIndex
CREATE INDEX "Repository_lastActivityAt_idx" ON "Repository"("lastActivityAt");

-- CreateIndex
CREATE INDEX "Repository_stars_idx" ON "Repository"("stars");

-- CreateIndex
CREATE INDEX "Repository_forks_idx" ON "Repository"("forks");

-- CreateIndex
CREATE INDEX "Repository_graveScore_idx" ON "Repository"("graveScore");

-- CreateIndex
CREATE INDEX "Repository_revivalScore_idx" ON "Repository"("revivalScore");

-- CreateIndex
CREATE INDEX "Repository_hiddenGemScore_idx" ON "Repository"("hiddenGemScore");

-- CreateIndex
CREATE INDEX "Repository_communityScore_idx" ON "Repository"("communityScore");

-- CreateIndex
CREATE INDEX "Repository_language_idx" ON "Repository"("language");

-- CreateIndex
CREATE INDEX "Repository_license_idx" ON "Repository"("license");

-- CreateIndex
CREATE INDEX "Repository_archived_idx" ON "Repository"("archived");

-- CreateIndex
CREATE INDEX "Repository_difficulty_idx" ON "Repository"("difficulty");

-- CreateIndex
CREATE INDEX "Repository_owner_idx" ON "Repository"("owner");

-- CreateIndex
CREATE INDEX "Repository_topics_idx" ON "Repository" USING GIN ("topics");

-- CreateIndex
CREATE INDEX "Repository_categories_idx" ON "Repository" USING GIN ("categories");

-- CreateIndex
CREATE INDEX "RepositorySnapshot_repositoryId_capturedAt_idx" ON "RepositorySnapshot"("repositoryId", "capturedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "RepositoryAnalysis_repositoryId_key" ON "RepositoryAnalysis"("repositoryId");

-- CreateIndex
CREATE INDEX "RepositoryAnalysis_status_startedAt_idx" ON "RepositoryAnalysis"("status", "startedAt");

-- CreateIndex
CREATE INDEX "RepositoryAnalysis_depth_lastAnalyzedAt_idx" ON "RepositoryAnalysis"("depth", "lastAnalyzedAt");

-- CreateIndex
CREATE INDEX "RepositoryFork_repositoryId_isActive_stars_idx" ON "RepositoryFork"("repositoryId", "isActive", "stars" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "RepositoryFork_repositoryId_fullName_key" ON "RepositoryFork"("repositoryId", "fullName");

-- CreateIndex
CREATE INDEX "Collection_userId_idx" ON "Collection"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Collection_userId_name_key" ON "Collection"("userId", "name");

-- CreateIndex
CREATE INDEX "CollectionRepository_repositoryId_idx" ON "CollectionRepository"("repositoryId");

-- CreateIndex
CREATE INDEX "RevivalInterest_repositoryId_idx" ON "RevivalInterest"("repositoryId");

-- CreateIndex
CREATE UNIQUE INDEX "RevivalInterest_userId_repositoryId_key" ON "RevivalInterest"("userId", "repositoryId");

-- CreateIndex
CREATE INDEX "ResurrectionProject_revivalId_idx" ON "ResurrectionProject"("revivalId");

-- CreateIndex
CREATE INDEX "ResurrectionProject_registeredById_idx" ON "ResurrectionProject"("registeredById");

-- CreateIndex
CREATE UNIQUE INDEX "ResurrectionProject_originalId_revivalId_key" ON "ResurrectionProject"("originalId", "revivalId");

-- CreateIndex
CREATE INDEX "CacheEntry_expiresAt_idx" ON "CacheEntry"("expiresAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepositorySnapshot" ADD CONSTRAINT "RepositorySnapshot_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepositoryAnalysis" ADD CONSTRAINT "RepositoryAnalysis_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepositoryFork" ADD CONSTRAINT "RepositoryFork_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionRepository" ADD CONSTRAINT "CollectionRepository_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionRepository" ADD CONSTRAINT "CollectionRepository_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevivalInterest" ADD CONSTRAINT "RevivalInterest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevivalInterest" ADD CONSTRAINT "RevivalInterest_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResurrectionProject" ADD CONSTRAINT "ResurrectionProject_originalId_fkey" FOREIGN KEY ("originalId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResurrectionProject" ADD CONSTRAINT "ResurrectionProject_revivalId_fkey" FOREIGN KEY ("revivalId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResurrectionProject" ADD CONSTRAINT "ResurrectionProject_registeredById_fkey" FOREIGN KEY ("registeredById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
