"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ExternalLink, KeyRound, Loader2, Plug, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { AiStatus } from "@/services/ai-connection-service";
import type { ByokPreset } from "@/providers/ai/byok";

async function call(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error?.message ?? "Something went wrong.");
  return json;
}

export function ConnectionPanel({ status, presets, flash }: { status: AiStatus; presets: ByokPreset[]; flash: { connected?: string; error?: string } }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(flash.error ?? null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pasteMode, setPasteMode] = useState<{ authorizeUrl: string; redirectUri: string } | null>(null);
  const [pasted, setPasted] = useState("");
  const [provider, setProvider] = useState(presets[0].id);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const preset = presets.find((p) => p.id === provider) ?? presets[0];
  const connection = status.connection;

  async function run<T>(name: string, fn: () => Promise<T>) {
    setBusy(name);
    setError(null);
    try {
      return await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  const startChatGPT = () =>
    run("chatgpt", async () => {
      const { authorizeUrl, mode, redirectUri } = await call("/api/ai/chatgpt/start", "POST");
      if (mode === "local") {
        window.location.href = authorizeUrl;
        return;
      }
      setPasteMode({ authorizeUrl, redirectUri });
      window.open(authorizeUrl, "_blank", "noopener,noreferrer");
    });

  const completeChatGPT = () =>
    run("complete", async () => {
      await call("/api/ai/chatgpt/complete", "POST", { callbackUrl: pasted });
      setPasteMode(null);
      setPasted("");
      router.refresh();
    });

  const saveKey = () =>
    run("key", async () => {
      await call("/api/ai/key", "POST", { provider, apiKey, model: model || undefined });
      setApiKey("");
      router.refresh();
    });

  const disconnect = () =>
    run("disconnect", async () => {
      await call("/api/ai", "DELETE");
      router.refresh();
    });

  return (
    <div className="space-y-6">
      {flash.connected && !error && <p role="status" className="rounded-lg border border-grave-green/30 bg-grave-green/10 px-4 py-3 text-sm text-grave-green">Connected. You can now generate AI insights on any repository page.</p>}
      {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}

      {connection && (
        <div className="surface flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="space-y-1">
            <p className="flex items-center gap-2 font-medium">
              <Plug className="size-4 text-grave-green" /> {connection.kind === "CHATGPT" ? "ChatGPT plan" : `${connection.provider} API key`}
              <Badge variant="green">Connected</Badge>
            </p>
            <p className="text-sm text-muted-foreground">
              {connection.label}
              {connection.model ? ` · model ${connection.model}` : ""}
            </p>
            {connection.kind === "CHATGPT" && <p className="text-xs text-muted-foreground">Usage counts toward your ChatGPT plan limits. Review or limit it in ChatGPT Settings → Usage.</p>}
          </div>
          <Button variant="destructive" onClick={disconnect} disabled={busy !== null}>
            {busy === "disconnect" ? <Loader2 className="animate-spin" /> : <Unplug />} Disconnect
          </Button>
        </div>
      )}

      <section className="surface space-y-4 p-6" aria-labelledby="chatgpt-title">
        <div className="space-y-1">
          <h2 id="chatgpt-title" className="text-lg font-semibold tracking-tight">Use your ChatGPT plan</h2>
          <p className="text-sm text-muted-foreground">
            Sign in with ChatGPT and authorize this app to use your plan for AI requests. No API key, and no access to your conversations. Tokens are encrypted on the server and never sent to your browser.
          </p>
        </div>
        {!status.chatgptAvailable ? (
          <p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            Not enabled on this instance. The operator needs to set <code className="font-mono text-xs">ENCRYPTION_KEY</code> and <code className="font-mono text-xs">CHATGPT_PLAN_ENABLED=true</code>. OpenAI documents this sign-in for open-source and self-hosted apps, so read the README before enabling it on a public deployment.
          </p>
        ) : (
          <>
            <Button size="lg" onClick={startChatGPT} disabled={busy !== null} className="w-full sm:w-auto">
              {busy === "chatgpt" && <Loader2 className="animate-spin" />} Continue with ChatGPT
            </Button>
            {pasteMode && (
              <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4 text-sm">
                <ol className="list-decimal space-y-1.5 pl-5 text-muted-foreground">
                  <li>
                    ChatGPT opened in a new tab. Sign in and allow plan usage.{" "}
                    <a href={pasteMode.authorizeUrl} target="_blank" rel="noopener noreferrer" className="text-grave-green hover:underline">
                      Reopen it <ExternalLink className="inline size-3" />
                    </a>
                  </li>
                  <li>
                    Your browser will end on a page that fails to load, with an address starting with <code className="font-mono text-xs text-foreground">{pasteMode.redirectUri}</code>. That is expected: this server is not on your machine.
                  </li>
                  <li>Copy that full address and paste it here.</li>
                </ol>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder={`${pasteMode.redirectUri}?code=…&state=…`} aria-label="Callback address" autoComplete="off" spellCheck={false} />
                  <Button onClick={completeChatGPT} disabled={busy !== null || pasted.trim().length < 10}>
                    {busy === "complete" && <Loader2 className="animate-spin" />} Finish connecting
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      <section className="surface space-y-4 p-6" aria-labelledby="key-title">
        <div className="space-y-1">
          <h2 id="key-title" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <KeyRound className="size-4 text-muted-foreground" /> Or bring your own API key
          </h2>
          <p className="text-sm text-muted-foreground">Your key is checked once, then stored encrypted on the server and used only for your requests. Disconnect any time to delete it.</p>
        </div>
        {!status.keysAvailable ? (
          <p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            Not enabled on this instance: the operator needs to set <code className="font-mono text-xs">ENCRYPTION_KEY</code>.
          </p>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void saveKey();
            }}
            className="grid gap-3"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1.5 text-xs text-muted-foreground">
                Provider
                <select value={provider} onChange={(e) => setProvider(e.target.value)} className="h-9 rounded-lg border border-input bg-muted/50 px-2.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {presets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1.5 text-xs text-muted-foreground">
                Model (optional)
                <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder={preset.defaultModel} maxLength={80} />
              </label>
            </div>
            <label className="grid gap-1.5 text-xs text-muted-foreground">
              API key
              <Input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Paste your key" autoComplete="off" spellCheck={false} maxLength={400} />
            </label>
            <p className="text-xs text-muted-foreground">
              {preset.note}{" "}
              <a href={preset.keyUrl} target="_blank" rel="noopener noreferrer" className="text-grave-green hover:underline">
                Get a {preset.label} key <ExternalLink className="inline size-3" />
              </a>
            </p>
            <Button type="submit" variant="secondary" className="w-fit" disabled={busy !== null || apiKey.trim().length < 8}>
              {busy === "key" && <Loader2 className="animate-spin" />} Verify and save
            </Button>
          </form>
        )}
      </section>
    </div>
  );
}
