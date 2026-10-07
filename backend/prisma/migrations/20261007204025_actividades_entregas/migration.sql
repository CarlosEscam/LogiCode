-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "scratchChecks" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "weight" DECIMAL(5,2);

-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "fileName" VARCHAR(255),
ADD COLUMN     "gradingDetails" JSONB;
