import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/brand/logo";
import { getCurrentUser } from "@/services/auth-service";
import { isGitHubOAuthConfigured } from "@/lib/env";
import { safeRelativePath } from "@/lib/validation";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  not_configured: "GitHub sign-in isn't configured on this instance yet.",
  invalid_state: "That sign-in attempt expired or was tampered with. Please try again.",
  access_denied: "You cancelled the GitHub authorization.",
  login_failed: "GitHub sign-in failed. Please try again.",
  too_many_requests: "Too many attempts. Wait a minute and try again.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const { error, next } = await searchParams;
  const target = safeRelativePath(next, "/");
  if (await getCurrentUser().catch(() => null)) redirect(target);
  const configured = isGitHubOAuthConfigured();
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
      <LogoMark className="mb-5 size-10" />
      <h1 className="text-2xl font-semibold tracking-tight">Sign in to GitHub Graveyard</h1>
      <p className="mt-3 text-sm text-muted-foreground">Save graves into collections, say you want to revive a project and register your resurrections. We only read your public profile.</p>
      {error && <p role="alert" className="mt-6 w-full rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{ERRORS[error] ?? "Something went wrong."}</p>}
      {configured ? (
        <Button asChild size="lg" className="mt-8 w-full">
          <Link href={`/api/auth/github?next=${encodeURIComponent(target)}`} prefetch={false}><LogIn /> Continue with GitHub</Link>
        </Button>
      ) : (
        <div className="surface mt-8 w-full space-y-2 p-5 text-left text-sm">
          <p className="font-medium">GitHub OAuth is not configured</p>
          <p className="text-muted-foreground">Create a GitHub OAuth App and set <code className="font-mono text-xs">GITHUB_CLIENT_ID</code> and <code className="font-mono text-xs">GITHUB_CLIENT_SECRET</code>. The README walks through it.</p>
        </div>
      )}
    </div>
  );
}
