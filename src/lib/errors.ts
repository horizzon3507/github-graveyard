export type AppErrorCode =
  | "invalid_input"
  | "not_found"
  | "private_repository"
  | "rate_limited"
  | "github_unavailable"
  | "unauthorized"
  | "forbidden"
  | "conflict"
  | "too_many_requests"
  | "internal";

const STATUS: Record<AppErrorCode, number> = {
  invalid_input: 400,
  not_found: 404,
  private_repository: 403,
  rate_limited: 429,
  github_unavailable: 503,
  unauthorized: 401,
  forbidden: 403,
  conflict: 409,
  too_many_requests: 429,
  internal: 500,
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor(code: AppErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = STATUS[code];
    this.details = details;
  }
}

export class GitHubNotFoundError extends AppError {
  constructor(what = "Repository") {
    super("not_found", `${what} not found. It may not exist, or it may be private.`);
    this.name = "GitHubNotFoundError";
  }
}

export class GitHubPrivateError extends AppError {
  constructor() {
    super("private_repository", "This repository is private. GitHub Graveyard only analyzes public repositories.");
    this.name = "GitHubPrivateError";
  }
}

export class GitHubRateLimitError extends AppError {
  readonly resetAt: Date | null;

  constructor(resetAt: Date | null) {
    super("rate_limited", "GitHub API rate limit reached.", { resetAt: resetAt?.toISOString() ?? null });
    this.name = "GitHubRateLimitError";
    this.resetAt = resetAt;
  }
}

export class GitHubUnavailableError extends AppError {
  constructor(message = "GitHub API is unavailable right now.") {
    super("github_unavailable", message);
    this.name = "GitHubUnavailableError";
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
