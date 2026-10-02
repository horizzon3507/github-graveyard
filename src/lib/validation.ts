import { z } from "zod";
import { AppError } from "@/lib/errors";

export const OWNER_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
export const REPO_PATTERN = /^[A-Za-z0-9._-]{1,100}$/;

export interface RepoRef {
  owner: string;
  name: string;
}

export function isValidRepoRef(owner: string, name: string): boolean {
  return OWNER_PATTERN.test(owner) && REPO_PATTERN.test(name) && name !== "." && name !== "..";
}

export function toSlug(owner: string, name: string): string {
  return `${owner}/${name}`.toLowerCase();
}

/**
 * Parses "owner/repo", "github.com/owner/repo" and full https URLs.
 * Returns null when the input is not a GitHub repository reference.
 */
export function parseRepoInput(input: string): RepoRef | null {
  const value = input.trim();
  if (!value || value.length > 300) return null;

  let path = value;
  if (/^https?:\/\//i.test(value) || /^(www\.)?github\.com\//i.test(value)) {
    let url: URL;
    try {
      url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    } catch {
      return null;
    }
    if (!["github.com", "www.github.com"].includes(url.hostname.toLowerCase())) return null;
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    path = url.pathname;
  }

  const parts = path.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  const owner = parts[0];
  const name = parts[1].replace(/\.git$/i, "");
  if (!isValidRepoRef(owner, name)) return null;
  return { owner, name };
}

export function looksLikeGitHubUrl(input: string): boolean {
  return /^(https?:\/\/)?(www\.)?github\.com\//i.test(input.trim());
}

export function parseOrThrow<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new AppError("invalid_input", result.error.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; "));
  }
  return result.data;
}

export function safeRelativePath(path: string | null | undefined, fallback = "/"): string {
  if (!path || !path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return fallback;
  return path;
}
