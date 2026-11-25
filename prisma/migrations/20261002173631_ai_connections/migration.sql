-- CreateTable
CREATE TABLE "AiConnection" (
    "id" TEXT NOT NULL,
    "secretHash" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "label" TEXT,
    "model" TEXT,
    "data" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "AiConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AiConnection_secretHash_key" ON "AiConnection"("secretHash");

-- CreateIndex
CREATE INDEX "AiConnection_updatedAt_idx" ON "AiConnection"("updatedAt");
