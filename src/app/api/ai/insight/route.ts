import { z } from "zod";
import { assertSameOrigin, json, readJson, route } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { AppError } from "@/lib/errors";
import { parseOrThrow } from "@/lib/validation";
import { AI_COOKIE, findConnection, getCookie } from "@/services/ai-connection-service";
import { generateInsight } from "@/services/insight-service";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const body = z.object({ repo: z.string().trim().min(3).max(300) });

export const POST = route(async (request) => {
  assertSameOrigin(request);
  enforceRateLimit(request, "ai-insight", 6);
  const { repo } = parseOrThrow(body, await readJson(request));
  const row = await findConnection(getCookie(request, AI_COOKIE));
  if (!row) throw new AppError("unauthorized", "Connect your own AI first (ChatGPT plan or API key).");
  return json(await generateInsight(row, repo));
});
