import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const databaseUrlSet = Boolean(process.env.DATABASE_URL);

  if (!databaseUrlSet) {
    return NextResponse.json(
      {
        ok: false,
        databaseUrlSet,
        db: { connected: false },
        hint: "Set DATABASE_URL in the deployment environment and redeploy/restart.",
      },
      { status: 500 },
    );
  }

  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();

    await prisma.$queryRaw`SELECT 1`;

    // Check whether migrations table exists and has rows.
    let migrationsApplied: boolean | null = null;
    try {
      const rows = (await prisma.$queryRaw`
        SELECT COUNT(*) as count FROM _prisma_migrations
      `) as Array<{ count: bigint | number }>;
      const countValue = rows?.[0]?.count;
      const count = typeof countValue === "bigint" ? Number(countValue) : Number(countValue ?? 0);
      migrationsApplied = Number.isFinite(count) ? count > 0 : null;
    } catch {
      migrationsApplied = null;
    }

    await prisma.$disconnect();

    return NextResponse.json({ ok: true, databaseUrlSet, db: { connected: true, migrationsApplied } });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        ok: false,
        databaseUrlSet,
        db: { connected: false },
        error: message,
      },
      { status: 500 },
    );
  }
}
