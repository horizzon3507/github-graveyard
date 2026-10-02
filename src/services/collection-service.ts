import "server-only";
import { z } from "zod";
import { db } from "@/database/client";
import { AppError } from "@/lib/errors";
import { parseOrThrow, parseRepoInput } from "@/lib/validation";
import { ensureRepository } from "@/services/repository-service";
import { toSlug } from "@/lib/validation";

export const DEFAULT_COLLECTION = "Saved";
const MAX_COLLECTIONS = 50;
const MAX_ITEMS = 500;

export const collectionInput = z.object({
  name: z.string().trim().min(1).max(60),
  description: z.string().trim().max(280).optional(),
  isPublic: z.boolean().optional(),
});

export async function ensureDefaultCollection(userId: string) {
  return db.collection.upsert({
    where: { userId_name: { userId, name: DEFAULT_COLLECTION } },
    create: { userId, name: DEFAULT_COLLECTION, description: "Graves you want to come back to.", isDefault: true },
    update: {},
  });
}

export async function listCollections(userId: string) {
  await ensureDefaultCollection(userId);
  return db.collection.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    include: { _count: { select: { items: true } } },
  });
}

export async function createCollection(userId: string, input: unknown) {
  const data = parseOrThrow(collectionInput, input);
  const count = await db.collection.count({ where: { userId } });
  if (count >= MAX_COLLECTIONS) throw new AppError("invalid_input", `You can have up to ${MAX_COLLECTIONS} collections.`);
  const duplicate = await db.collection.findUnique({ where: { userId_name: { userId, name: data.name } } });
  if (duplicate) throw new AppError("conflict", "You already have a collection with that name.");
  return db.collection.create({ data: { userId, name: data.name, description: data.description, isPublic: data.isPublic ?? true } });
}

async function ownedCollection(userId: string, id: string) {
  const collection = await db.collection.findUnique({ where: { id } });
  if (!collection || collection.userId !== userId) throw new AppError("not_found", "Collection not found.");
  return collection;
}

export async function updateCollection(userId: string, id: string, input: unknown) {
  const collection = await ownedCollection(userId, id);
  const data = parseOrThrow(collectionInput.partial(), input);
  if (collection.isDefault && data.name && data.name !== collection.name) throw new AppError("invalid_input", "The default collection cannot be renamed.");
  return db.collection.update({ where: { id }, data });
}

export async function deleteCollection(userId: string, id: string) {
  const collection = await ownedCollection(userId, id);
  if (collection.isDefault) throw new AppError("invalid_input", "The default collection cannot be deleted.");
  await db.collection.delete({ where: { id } });
}

async function resolveRepository(input: string) {
  const ref = parseRepoInput(input);
  if (!ref) throw new AppError("invalid_input", "Expected a repository like owner/name.");
  const existing = await db.repository.findUnique({ where: { slug: toSlug(ref.owner, ref.name) } });
  return existing ?? ensureRepository(ref.owner, ref.name);
}

export async function addToCollection(userId: string, collectionId: string, repo: string, note?: string) {
  await ownedCollection(userId, collectionId);
  const repository = await resolveRepository(repo);
  const count = await db.collectionRepository.count({ where: { collectionId } });
  if (count >= MAX_ITEMS) throw new AppError("invalid_input", "This collection is full.");
  await db.collectionRepository.upsert({
    where: { collectionId_repositoryId: { collectionId, repositoryId: repository.id } },
    create: { collectionId, repositoryId: repository.id, note: note?.slice(0, 280) },
    update: { note: note?.slice(0, 280) },
  });
  return repository;
}

export async function removeFromCollection(userId: string, collectionId: string, repo: string) {
  await ownedCollection(userId, collectionId);
  const repository = await resolveRepository(repo);
  await db.collectionRepository.deleteMany({ where: { collectionId, repositoryId: repository.id } });
}

export async function collectionsContaining(userId: string, repositoryId: string): Promise<string[]> {
  const rows = await db.collectionRepository.findMany({ where: { repositoryId, collection: { userId } }, select: { collectionId: true } });
  return rows.map((r) => r.collectionId);
}
