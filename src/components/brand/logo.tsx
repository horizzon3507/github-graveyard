import { cn } from "@/lib/utils";

/** Git branch inside a small headstone, with a sprout where the branch ends. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" className={cn("size-6", className)}>
      <path d="M6.5 28V14.5a9.5 9.5 0 0 1 19 0V28" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
      <path d="M4 28h24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" opacity="0.9" />
      <circle cx="12.5" cy="23" r="1.9" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12.5 21.1V13.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12.5 17.6c0-2.4 1.6-3.7 4-3.7" stroke="#6ee7a8" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M16.6 13.9c.1-2.6 1.7-4.1 4.4-4.2-.1 2.7-1.7 4.2-4.4 4.2Z" fill="#6ee7a8" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 font-semibold tracking-tight", className)}>
      <LogoMark className="size-6 text-foreground" />
      <span>
        GitHub <span className="text-muted-foreground">Graveyard</span>
      </span>
    </span>
  );
}
