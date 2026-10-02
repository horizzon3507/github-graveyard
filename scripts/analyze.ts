import "dotenv/config";
import { db } from "@/database/client";
import { ensureRepository } from "@/services/repository-service";
import { runDeepAnalysis } from "@/services/analysis-service";
import { parseRepoInput } from "@/lib/validation";

async function main() {
  const inputs = process.argv.slice(2);
  if (inputs.length === 0) {
    console.error("Usage: pnpm analyze <owner/repo | github url> [...]");
    process.exit(1);
  }
  for (const input of inputs) {
    const ref = parseRepoInput(input);
    if (!ref) {
      console.error(`Not a GitHub repository: ${input}`);
      continue;
    }
    const repo = await ensureRepository(ref.owner, ref.name);
    await db.repositoryAnalysis.update({ where: { repositoryId: repo.id }, data: { status: "RUNNING", startedAt: new Date() } });
    await runDeepAnalysis(repo.id);
    const analysis = await db.repositoryAnalysis.findUnique({ where: { repositoryId: repo.id } });
    console.log(
      `${repo.owner}/${repo.name}: ${analysis?.status} grave=${analysis?.graveScore} revival=${analysis?.revivalScore} difficulty=${analysis?.difficulty ?? "-"} ${analysis?.error ?? ""}`,
    );
  }
  await db.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
