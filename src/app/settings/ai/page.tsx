import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ConnectionPanel } from "@/features/ai/connection-panel";
import { BYOK_PRESETS } from "@/providers/ai/byok";
import { AI_COOKIE, getAiStatus } from "@/services/ai-connection-service";

export const metadata: Metadata = { title: "Your AI" };
export const dynamic = "force-dynamic";

export default async function AiSettingsPage({ searchParams }: { searchParams: Promise<{ connected?: string; error?: string }> }) {
  const flash = await searchParams;
  const status = await getAiStatus((await cookies()).get(AI_COOKIE)?.value);
  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-12 sm:px-6">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">Your AI</h1>
        <p className="text-muted-foreground">
          GitHub Graveyard works without AI: every score and finding is computed by fixed rules from GitHub data. If you connect your own AI, repository pages can also write a short plain-language verdict. It runs on your plan or your key, never on the site&apos;s.
        </p>
      </header>
      <ConnectionPanel status={status} presets={BYOK_PRESETS} flash={{ connected: flash.connected?.slice(0, 20), error: flash.error?.slice(0, 300) }} />
    </div>
  );
}
