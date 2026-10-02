import Link from "next/link";
import { Dices, LogIn } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/layout/user-menu";
import { MobileNav } from "@/components/layout/mobile-nav";
import { getCurrentUser } from "@/services/auth-service";

export const NAV_LINKS = [
  { href: "/explore", label: "Explore" },
  { href: "/hidden-gems", label: "Hidden Gems" },
  { href: "/legendary", label: "Legendary" },
  { href: "/methodology", label: "Methodology" },
  { href: "/settings/ai", label: "Your AI" },
];

export async function Header() {
  const user = await getCurrentUser().catch(() => null);
  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/80 backdrop-blur-md">
      <div className="relative mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md" aria-label="GitHub Graveyard home">
          <Logo className="text-[15px]" />
        </Link>
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {NAV_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link href="/random" prefetch={false}>
              <Dices /> Random Grave
            </Link>
          </Button>
          {user ? (
            <UserMenu login={user.login} avatarUrl={user.avatarUrl} />
          ) : (
            <Button asChild variant="secondary" size="sm">
              <Link href="/login" prefetch={false}>
                <LogIn /> Sign in
              </Link>
            </Button>
          )}
          <MobileNav links={[...NAV_LINKS, { href: "/random", label: "Random Grave" }]} />
        </div>
      </div>
    </header>
  );
}
