import "dotenv/config";
import { db } from "@/database/client";
import { runIngest } from "@/services/discovery";

async function main() {
  const maxQueries = process.argv[2] ? Number(process.argv[2]) : undefined;
  const result = await runIngest({ maxQueries, onProgress: (m) => console.log(m) });
  console.log(`Done: ${result.imported} repositories from ${result.queries} queries${result.stoppedBy ? `. Stopped early: ${result.stoppedBy}` : ""}`);
  await db.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
