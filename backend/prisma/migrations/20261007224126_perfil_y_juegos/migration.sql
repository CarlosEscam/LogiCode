-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatarPath" TEXT;

-- CreateTable
CREATE TABLE "GameScore" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "game" VARCHAR(30) NOT NULL,
    "score" INTEGER NOT NULL,
    "maxScore" INTEGER NOT NULL,
    "seconds" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GameScore_userId_game_idx" ON "GameScore"("userId", "game");

-- AddForeignKey
ALTER TABLE "GameScore" ADD CONSTRAINT "GameScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
