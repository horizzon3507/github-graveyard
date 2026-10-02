import { NextResponse } from "next/server";
import { randomGrave } from "@/database/repository-queries";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  const base = env().APP_URL;
  const grave = await randomGrave().catch(() => null);
  return NextResponse.redirect(new URL(grave ? `/repo/${grave.owner}/${grave.name}` : "/explore", base), 307);
}
