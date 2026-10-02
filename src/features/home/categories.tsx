import Link from "next/link";
import { Bot, Brain, Compass, Gamepad2, Gem, Library, type LucideIcon, Globe, Hourglass, Landmark, Smartphone, Terminal, Wrench } from "lucide-react";

interface Category {
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
}

export const HOME_CATEGORIES: Category[] = [
  { label: "Most Wanted", description: "Lively communities, silent maintainers", href: "/explore?sort=community", icon: Compass },
  { label: "Recently Abandoned", description: "Quiet for 6–12 months", href: "/explore?status=recently_abandoned&sort=recently-abandoned", icon: Hourglass },
  { label: "Hidden Gems", description: "Good ideas nobody forked yet", href: "/hidden-gems", icon: Gem },
  { label: "Easy to Revive", description: "Small, tidy, low tech debt", href: "/explore?difficulty=EASY&sort=highest-revival", icon: Wrench },
  { label: "Legendary Projects", description: "Once massive, now silent", href: "/legendary", icon: Landmark },
  { label: "Developer Tools", description: "CLIs, linters, build tools", href: "/explore?category=developer-tools", icon: Terminal },
  { label: "Games", description: "Engines, clones, emulators", href: "/explore?category=games", icon: Gamepad2 },
  { label: "Libraries", description: "Frameworks and SDKs", href: "/explore?category=libraries", icon: Library },
  { label: "AI", description: "Models, toolkits, experiments", href: "/explore?category=ai", icon: Brain },
  { label: "Linux", description: "Desktop, shell and system tools", href: "/explore?category=linux", icon: Bot },
  { label: "Web", description: "Frontend and backend projects", href: "/explore?category=web", icon: Globe },
  { label: "Mobile", description: "Android, iOS and cross-platform", href: "/explore?category=mobile", icon: Smartphone },
];

export function CategoryGrid() {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {HOME_CATEGORIES.map(({ label, description, href, icon: Icon }) => (
        <li key={label}>
          <Link href={href} className="surface group flex h-full flex-col gap-2 p-4 outline-none transition-colors hover:border-white/20 focus-visible:ring-2 focus-visible:ring-ring">
            <Icon className="size-4 text-muted-foreground transition-colors group-hover:text-grave-green" aria-hidden="true" />
            <span className="text-sm font-medium">{label}</span>
            <span className="text-xs text-muted-foreground">{description}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
