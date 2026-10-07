-- AlterTable
ALTER TABLE "ForumPost" ADD COLUMN     "editedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ForumThread" ADD COLUMN     "lastPostAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "ForumThread_isPinned_lastPostAt_idx" ON "ForumThread"("isPinned", "lastPostAt");
