import "dotenv/config";
import { db } from "@/database/client";
import { recomputeQuickAnalyses } from "@/services/repository-service";

async function main() {
  console.log(`Recomputed ${await recomputeQuickAnalyses()} quick scans`);
  await db.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
