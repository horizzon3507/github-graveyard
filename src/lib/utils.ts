import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const DAY_MS = 86_400_000;

export function daysBetween(from: Date, to: Date = new Date()): number {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / DAY_MS));
}

export function formatCompact(n: number): string {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("en").format(n);
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(date));
}

export function formatMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 1)));
}

export function formatYears(days: number): string {
  const years = days / 365.25;
  if (years >= 1) return `${years.toFixed(years >= 10 ? 0 : 1).replace(/\.0$/, "")} ${years < 1.05 && years >= 0.95 ? "year" : "years"}`;
  const months = Math.round(days / 30.44);
  if (months >= 1) return `${months} ${months === 1 ? "month" : "months"}`;
  return `${days} ${days === 1 ? "day" : "days"}`;
}

export function formatAgo(date: Date | string | null | undefined, now: Date = new Date()): string {
  if (!date) return "never";
  const days = daysBetween(new Date(date), now);
  if (days < 1) return "today";
  if (days < 31) return `${days} ${days === 1 ? "day" : "days"} ago`;
  return `${formatYears(days)} ago`;
}

export function formatBytes(kb: number): string {
  if (kb < 1024) return `${Math.round(kb)} KB`;
  if (kb < 1024 * 1024) return `${(kb / 1024).toFixed(1)} MB`;
  return `${(kb / 1024 / 1024).toFixed(1)} GB`;
}

export function clamp(n: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, n));
}

export function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}
