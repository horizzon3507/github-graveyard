import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RepoCard } from "@/components/graveyard/repo-card";
import { StateMessage } from "@/components/graveyard/states";
import { db } from "@/database/client";
import { toCard } from "@/database/repository-queries";
import { getCurrentUser } from "@/services/auth-service";
import { CollectionActions } from "@/features/collections/collection-actions";
import { RemoveItem } from "@/features/collections/remove-item";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Collection" };

export default async function CollectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, collection] = await Promise.all([
    getCurrentUser(),
    db.collection.findUnique({
      where: { id },
      include: {
        user: { select: { login: true } },
        items: { orderBy: { addedAt: "desc" }, include: { repository: { include: { resurrectionsAsOriginal: { select: { id: true }, take: 1 } } } } },
      },
    }),
  ]);
  if (!collection) notFound();
  const owned = user?.id === collection.userId;
  if (!collection.isPublic && !owned) notFound();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <header className="mb-8 space-y-3">
        <p className="text-sm text-muted-foreground">
          Collection by <Link href={`/user/${collection.user.login}`} className="hover:text-foreground">@{collection.user.login}</Link>
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">{collection.name}</h1>
        {collection.description && <p className="max-w-2xl text-muted-foreground">{collection.description}</p>}
        {owned && <CollectionActions id={collection.id} isPublic={collection.isPublic} isDefault={collection.isDefault} />}
      </header>
      {collection.items.length === 0 ? (
        <StateMessage kind="empty" title="Nothing in here yet" action={{ href: "/explore", label: "Explore the graveyard" }}>
          Open a repository and press Save to add it to this collection.
        </StateMessage>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {collection.items.map((item) => (
            <li key={item.repositoryId} className="group/item relative">
              {owned && <RemoveItem collectionId={collection.id} repo={`${item.repository.owner}/${item.repository.name}`} />}
              <RepoCard repo={toCard(item.repository)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
