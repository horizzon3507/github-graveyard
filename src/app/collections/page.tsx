import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Bookmark, Lock } from "lucide-react";
import { getCurrentUser } from "@/services/auth-service";
import { listCollections } from "@/services/collection-service";
import { CreateCollection } from "@/features/collections/create-collection";

export const metadata: Metadata = { title: "Your collections" };
export const dynamic = "force-dynamic";

export default async function CollectionsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/collections");
  const collections = await listCollections(user.id);
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Your collections</h1>
          <p className="text-muted-foreground">Lists of graves you want to remember.</p>
        </div>
        <CreateCollection />
      </header>
      <ul className="grid gap-3 sm:grid-cols-2">
        {collections.map((c) => (
          <li key={c.id}>
            <Link href={`/collections/${c.id}`} className="surface flex h-full flex-col gap-2 p-5 outline-none transition-colors hover:border-white/20 focus-visible:ring-2 focus-visible:ring-ring">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 font-medium"><Bookmark className="size-4 text-muted-foreground" /> {c.name}</span>
                {!c.isPublic && <Lock className="size-3.5 text-muted-foreground" aria-label="Private" />}
              </div>
              {c.description && <p className="text-sm text-muted-foreground">{c.description}</p>}
              <p className="mt-auto text-xs text-muted-foreground">{c._count.items} {c._count.items === 1 ? "repository" : "repositories"}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
