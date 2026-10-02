import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export function Footer() {
  return (
    <footer className="mt-24 border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 md:flex-row md:justify-between">
        <div className="max-w-sm space-y-3">
          <Logo className="text-sm" />
          <p className="text-sm text-muted-foreground">The code may be dead. The idea isn&apos;t.</p>
          <p className="text-xs text-muted-foreground/80">
            Scores and analyses are estimates computed from public GitHub data. They are signals to help you decide, not verdicts. Not affiliated with GitHub.
          </p>
        </div>
        <nav className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm text-muted-foreground" aria-label="Footer">
          <Link href="/explore" className="hover:text-foreground">Explore</Link>
          <Link href="/hidden-gems" className="hover:text-foreground">Hidden Gems</Link>
          <Link href="/legendary" className="hover:text-foreground">Legendary Graves</Link>
          <Link href="/methodology" className="hover:text-foreground">How scores work</Link>
          <Link href="/random" prefetch={false} className="hover:text-foreground">Random Grave</Link>
          <Link href="/collections" className="hover:text-foreground">Collections</Link>
        </nav>
      </div>
    </footer>
  );
}
