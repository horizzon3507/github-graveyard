import { json } from "@/lib/api";
import { db } from "@/database/client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return json({ status: "ok", database: "up" });
  } catch {
    return json({ status: "degraded", database: "down" }, { status: 503 });
  }
}
