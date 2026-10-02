import Link from "next/link";
import { ExternalLink, Sprout } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { InterestButton } from "@/features/repo/interest-button";
import { ResurrectionForm } from "@/features/repo/resurrection-form";
import { formatAgo } from "@/lib/utils";
import type { RepositoryDetail } from "@/database/repository-detail";
import type { SessionUser } from "@/services/auth-service";

export function ClaimSection({ repo, user }: { repo: RepositoryDetail; user: SessionUser | null }) {
  const count = repo._count.interests;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="surface space-y-4 p-6">
        <p className="text-lg font-semibold tracking-tight">Ready to bring it back?</p>
        <p className="text-sm text-muted-foreground">
          {count > 0 ? <><strong className="text-foreground">{count}</strong> {count === 1 ? "developer wants" : "developers want"} to revive this project.</> : "Nobody has raised a hand yet."} Declaring interest is a signal to others, not a claim: it does not transfer ownership of the original repository.
        </p>
        <InterestButton owner={repo.owner} name={repo.name} signedIn={Boolean(user)} interested={repo.interested} count={count} />
        {repo.interestedUsers.length > 0 && (
          <ul className="flex flex-wrap gap-2 pt-1" aria-label="Developers who want to revive this project">
            {repo.interestedUsers.map((u) => (
              <li key={u.login}>
                <Link href={`/user/${u.login}`} className="inline-flex items-center gap-1.5 rounded-full border border-border py-0.5 pr-2.5 pl-0.5 text-xs text-muted-foreground hover:text-foreground">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {u.avatarUrl && <img src={u.avatarUrl} alt="" width={20} height={20} className="size-5 rounded-full" />}@{u.login}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="surface space-y-4 p-6">
        <p className="flex items-center gap-2 text-lg font-semibold tracking-tight"><Sprout className="size-5 text-grave-green" /> Resurrection projects</p>
        {repo.resurrectionsAsOriginal.length === 0 ? (
          <p className="text-sm text-muted-foreground">No one has registered a continuation yet. Forked it to carry on? Register it and this page will point people to your fork.</p>
        ) : (
          <ul className="grid gap-3">
            {repo.resurrectionsAsOriginal.map((r) => (
              <li key={r.id} className="grid gap-1 rounded-lg border border-grave-green/20 bg-grave-green/5 p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-muted-foreground">{repo.owner}/{repo.name}</span> <span aria-hidden="true">→</span>
                  <Link href={`/repo/${r.revival.owner}/${r.revival.name}`} className="font-medium text-grave-green hover:underline">{r.revival.owner}/{r.revival.name}</Link>
                  <a href={r.revival.htmlUrl} target="_blank" rel="noopener noreferrer" aria-label="Open on GitHub"><ExternalLink className="size-3 text-muted-foreground" /></a>
                  <Badge variant="green">Resurrection</Badge>
                </div>
                {r.note && <p className="text-xs text-muted-foreground">{r.note}</p>}
                <p className="text-xs text-muted-foreground">Registered by <Link href={`/user/${r.registeredBy.login}`} className="hover:text-foreground">@{r.registeredBy.login}</Link> {formatAgo(r.createdAt)}.</p>
              </li>
            ))}
          </ul>
        )}
        {user ? <ResurrectionForm owner={repo.owner} name={repo.name} /> : <p className="text-xs text-muted-foreground">Sign in with GitHub to register a fork.</p>}
      </div>
    </div>
  );
}
