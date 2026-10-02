import { db } from "@/database/client";
import { toSlug } from "@/lib/validation";
import type { SnapshotData } from "@/types/analysis";

export async function getRepositoryDetail(owner: string, name: string, userId?: string | null) {
  const repository = await db.repository.findUnique({
    where: { slug: toSlug(owner, name) },
    include: {
      analysis: true,
      forkList: { orderBy: [{ isActive: "desc" }, { stars: "desc" }] },
      resurrectionsAsOriginal: {
        include: { revival: true, registeredBy: { select: { login: true, avatarUrl: true } } },
        orderBy: { createdAt: "desc" },
      },
      resurrectionsAsRevival: { include: { original: { select: { owner: true, name: true, stars: true } } }, take: 1 },
      _count: { select: { interests: true, collectionItems: true } },
    },
  });
  if (!repository) return null;

  const [snapshot, interested, interestedUsers] = await Promise.all([
    db.repositorySnapshot.findFirst({ where: { repositoryId: repository.id, depth: "DEEP" }, orderBy: { capturedAt: "desc" } }),
    userId ? db.revivalInterest.findUnique({ where: { userId_repositoryId: { userId, repositoryId: repository.id } } }) : null,
    db.revivalInterest.findMany({ where: { repositoryId: repository.id }, orderBy: { createdAt: "desc" }, take: 8, include: { user: { select: { login: true, avatarUrl: true } } } }),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { githubId, ...rest } = repository;
  return {
    ...rest,
    snapshotData: (snapshot?.data ?? null) as SnapshotData | null,
    snapshotAt: snapshot?.capturedAt ?? null,
    interested: Boolean(interested),
    interestedUsers: interestedUsers.map((i) => i.user),
  };
}

export type RepositoryDetail = NonNullable<Awaited<ReturnType<typeof getRepositoryDetail>>>;
