import "server-only";
import { z } from "zod";
import { db } from "@/database/client";
import { AppError } from "@/lib/errors";
import { parseOrThrow, parseRepoInput, toSlug } from "@/lib/validation";
import { getGitHub } from "@/services/github";
import { ensureRepository, upsertRepository } from "@/services/repository-service";
import type { SessionUser } from "@/services/auth-service";

async function repositoryBySlug(owner: string, name: string) {
  const repository = await db.repository.findUnique({ where: { slug: toSlug(owner, name) } });
  return repository ?? ensureRepository(owner, name);
}

export const interestInput = z.object({ message: z.string().trim().max(280).optional() });

export async function declareInterest(user: SessionUser, owner: string, name: string, input: unknown) {
  const { message } = parseOrThrow(interestInput, input ?? {});
  const repository = await repositoryBySlug(owner, name);
  await db.revivalInterest.upsert({
    where: { userId_repositoryId: { userId: user.id, repositoryId: repository.id } },
    create: { userId: user.id, repositoryId: repository.id, message },
    update: { message },
  });
  return { count: await db.revivalInterest.count({ where: { repositoryId: repository.id } }) };
}

export async function withdrawInterest(user: SessionUser, owner: string, name: string) {
  const repository = await repositoryBySlug(owner, name);
  await db.revivalInterest.deleteMany({ where: { userId: user.id, repositoryId: repository.id } });
  return { count: await db.revivalInterest.count({ where: { repositoryId: repository.id } }) };
}

export const resurrectionInput = z.object({ revivalRepo: z.string().trim().min(3).max(300), note: z.string().trim().max(280).optional() });

/**
 * Registers a fork as the continuation of an original project. The fork must really descend
 * from the original, and the person registering it must own it (or belong to the owning org).
 */
export async function registerResurrection(user: SessionUser, owner: string, name: string, input: unknown) {
  const data = parseOrThrow(resurrectionInput, input);
  const ref = parseRepoInput(data.revivalRepo);
  if (!ref) throw new AppError("invalid_input", "Enter the fork as owner/name or a GitHub URL.");

  const original = await repositoryBySlug(owner, name);
  if (toSlug(ref.owner, ref.name) === original.slug) throw new AppError("invalid_input", "The revival repository must be a fork, not the original.");

  const { github } = getGitHub();
  const meta = await github.getRepository(ref.owner, ref.name);
  const lineage = [meta.parent, meta.root].filter(Boolean).map((s) => s!.toLowerCase());
  if (!meta.isFork || !lineage.includes(original.slug)) throw new AppError("invalid_input", `${meta.owner}/${meta.name} is not a fork of ${original.owner}/${original.name}.`);

  const isOwner = meta.owner.toLowerCase() === user.loginLower;
  const isOrgMember = !isOwner && meta.ownerType === "Organization" && (await github.isPublicOrgMember(meta.owner, user.login));
  if (!isOwner && !isOrgMember) throw new AppError("forbidden", "Only the fork's owner (or a public member of the owning organization) can register it.");

  const revival = await upsertRepository(meta, "FORK");
  const project = await db.resurrectionProject.upsert({
    where: { originalId_revivalId: { originalId: original.id, revivalId: revival.id } },
    create: { originalId: original.id, revivalId: revival.id, registeredById: user.id, note: data.note },
    update: { note: data.note },
  });
  return { id: project.id, revival: `${revival.owner}/${revival.name}` };
}

export async function removeResurrection(user: SessionUser, id: string) {
  const project = await db.resurrectionProject.findUnique({ where: { id } });
  if (!project || project.registeredById !== user.id) throw new AppError("not_found", "Resurrection project not found.");
  await db.resurrectionProject.delete({ where: { id } });
}

export const profileInput = z.object({
  favoriteTech: z.array(z.string().trim().min(1).max(30)).max(15),
});

export async function updateProfile(user: SessionUser, input: unknown) {
  const { favoriteTech } = parseOrThrow(profileInput, input);
  const unique = [...new Set(favoriteTech.map((t) => t.trim()))];
  await db.user.update({ where: { id: user.id }, data: { favoriteTech: unique } });
  return { favoriteTech: unique };
}
