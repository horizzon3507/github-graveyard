import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "GitHub Graveyard — abandoned open-source projects worth reviving", template: "%s · GitHub Graveyard" },
  description: "Discover abandoned open-source projects worth bringing back to life. Grave Score, Revival Score, active forks and modernization roadmaps for GitHub repositories.",
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  openGraph: { title: "GitHub Graveyard", description: "Discover abandoned open-source projects worth bringing back to life.", type: "website" },
};

export const viewport: Viewport = { themeColor: "#07080a", colorScheme: "dark" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-dvh font-sans">
        <TooltipProvider delayDuration={150}>
          <Header />
          <main>{children}</main>
          <Footer />
        </TooltipProvider>
      </body>
    </html>
  );
}
