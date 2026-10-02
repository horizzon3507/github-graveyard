import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, Sprout } from "lucide-react";
import { RepoCard } from "@/components/graveyard/repo-card";
import { Badge } from "@/components/ui/badge";
import { db } from "@/database/client";
import { toCard } from "@/database/repository-queries";
import { getCurrentUser } from "@/services/auth-service";
import { TechEditor } from "@/features/collections/tech-editor";
import { formatAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { username } = await params;
  return { title: `@${username}` };
}

const cardInclude = { resurrectionsAsOriginal: { select: { id: true }, take: 1 } } as const;

export default async function ProfilePage({ params }: Params) {
  const { username } = await params;
  if (!/^[A-Za-z0-9-]{1,39}$/.test(username)) notFound();
  const [viewer, profile] = await Promise.all([
    getCurrentUser(),
    db.user.findUnique({
      where: { loginLower: username.toLowerCase() },
      include: {
        interests: { orderBy: { createdAt: "desc" }, include: { repository: { include: cardInclude } } },
        resurrections: { orderBy: { createdAt: "desc" }, include: { original: true, revival: true } },
        collections: {
          where: { isPublic: true },
          orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
          include: { _count: { select: { items: true } }, items: { orderBy: { addedAt: "desc" }, take: 6, include: { repository: { include: cardInclude } } } },
        },
      },
    }),
  ]);
  if (!profile) notFound();
  const own = viewer?.id === profile.id;

  const saved = profile.collections.find((c) => c.isDefault);
  const languages = new Map<string, number>();
  for (const repo of [...profile.interests.map((i) => i.repository), ...profile.collections.flatMap((c) => c.items.map((i) => i.repository))]) {
    if (repo.language) languages.set(repo.language, (languages.get(repo.language) ?? 0) + 1);
  }
  const derived = [...languages.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([l]) => l);
  const activity = [
    ...profile.interests.map((i) => ({ at: i.createdAt, text: `Wants to revive ${i.repository.owner}/${i.repository.name}`, href: `/repo/${i.repository.owner}/${i.repository.name}` })),
    ...profile.resurrections.map((r) => ({ at: r.createdAt, text: `Registered ${r.revival.owner}/${r.revival.name} as a resurrection of ${r.original.owner}/${r.original.name}`, href: `/repo/${r.original.owner}/${r.original.name}` })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 8);

  return (
    <div className="mx-auto max-w-6xl space-y-12 px-4 py-10 sm:px-6">
      <header className="flex flex-wrap items-center gap-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {profile.avatarUrl && <img src={profile.avatarUrl} alt="" width={72} height={72} className="size-18 rounded-full border border-border" />}
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{profile.name ?? profile.login}</h1>
          <p className="text-sm text-muted-foreground">@{profile.login}</p>
          {profile.bio && <p className="max-w-xl text-sm text-muted-foreground">{profile.bio}</p>}
          <a href={profile.htmlUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-grave-green hover:underline">
            GitHub profile <ExternalLink className="size-3" />
          </a>
        </div>
      </header>

      <section aria-labelledby="tech" className="space-y-3">
        <h2 id="tech" className="text-lg font-semibold tracking-tight">Favorite technologies</h2>
        {own ? <TechEditor initial={profile.favoriteTech} /> : profile.favoriteTech.length > 0 ? <ul className="flex flex-wrap gap-1.5">{profile.favoriteTech.map((t) => <li key={t}><Badge variant="blue">{t}</Badge></li>)}</ul> : <p className="text-sm text-muted-foreground">Nothing listed yet.</p>}
        {derived.length > 0 && <p className="text-xs text-muted-foreground">Most seen in their graves: {derived.join(", ")}.</p>}
      </section>

      <section aria-labelledby="revive" className="space-y-4">
        <h2 id="revive" className="flex items-center gap-2 text-lg font-semibold tracking-tight"><Sprout className="size-5 text-grave-green" /> Wants to revive <span className="font-mono text-sm text-muted-foreground">{profile.interests.length}</span></h2>
        {profile.interests.length === 0 ? <p className="text-sm text-muted-foreground">No projects yet.</p> : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{profile.interests.slice(0, 6).map((i) => <li key={i.id}><RepoCard repo={toCard(i.repository)} /></li>)}</ul>
        )}
      </section>

      <section aria-labelledby="resurrections" className="space-y-4">
        <h2 id="resurrections" className="text-lg font-semibold tracking-tight">Resurrection projects <span className="font-mono text-sm text-muted-foreground">{profile.resurrections.length}</span></h2>
        {profile.resurrections.length === 0 ? <p className="text-sm text-muted-foreground">None registered.</p> : (
          <ul className="grid gap-3">
            {profile.resurrections.map((r) => (
              <li key={r.id} className="surface flex flex-wrap items-center gap-2 p-4 text-sm">
                <Link href={`/repo/${r.original.owner}/${r.original.name}`} className="text-muted-foreground hover:text-foreground">{r.original.owner}/{r.original.name}</Link>
                <span aria-hidden="true">→</span>
                <Link href={`/repo/${r.revival.owner}/${r.revival.name}`} className="font-medium text-grave-green hover:underline">{r.revival.owner}/{r.revival.name}</Link>
                {r.note && <span className="text-xs text-muted-foreground">· {r.note}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="saved" className="space-y-4">
        <h2 id="saved" className="text-lg font-semibold tracking-tight">Saved projects <span className="font-mono text-sm text-muted-foreground">{saved?._count.items ?? 0}</span></h2>
        {saved && saved.items.length > 0 ? <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{saved.items.map((i) => <li key={i.repositoryId}><RepoCard repo={toCard(i.repository)} /></li>)}</ul> : <p className="text-sm text-muted-foreground">Nothing saved publicly.</p>}
        {profile.collections.filter((c) => !c.isDefault).length > 0 && (
          <div className="space-y-2 pt-2">
            <h3 className="text-sm font-medium text-muted-foreground">Collections</h3>
            <ul className="flex flex-wrap gap-2">
              {profile.collections.filter((c) => !c.isDefault).map((c) => (
                <li key={c.id}><Link href={`/collections/${c.id}`} className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm hover:border-white/25">{c.name} <span className="font-mono text-xs text-muted-foreground">{c._count.items}</span></Link></li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section aria-labelledby="contrib" className="space-y-4">
        <h2 id="contrib" className="text-lg font-semibold tracking-tight">Recent activity</h2>
        {activity.length === 0 ? <p className="text-sm text-muted-foreground">No activity yet.</p> : (
          <ul className="grid gap-2 text-sm">
            {activity.map((a, i) => (
              <li key={i} className="flex flex-wrap items-baseline gap-x-3"><Link href={a.href} className="hover:text-grave-green">{a.text}</Link><span className="text-xs text-muted-foreground">{formatAgo(a.at)}</span></li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
