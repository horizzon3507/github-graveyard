import { AppError } from "@/lib/errors";
import { isValidRepoRef } from "@/lib/validation";

export interface RepoParams {
  params: Promise<{ owner: string; repo: string }>;
}

export async function readRepoParams(context: RepoParams): Promise<{ owner: string; name: string }> {
  const { owner, repo } = await context.params;
  if (!isValidRepoRef(owner, repo)) throw new AppError("invalid_input", "Invalid repository reference.");
  return { owner, name: repo };
}
