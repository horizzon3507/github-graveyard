import "dotenv/config";
import { db } from "@/database/client";
import { refreshAnalyses } from "@/services/jobs";

async function main() {
  const limit = process.argv[2] ? Number(process.argv[2]) : 10;
  const result = await refreshAnalyses(limit);
  console.log(`Analyzed ${result.analyzed}/${result.attempted}`);
  for (const f of result.failed) console.log(`  failed ${f.slug}: ${f.error}`);
  await db.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
