import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const databaseUrlSet = Boolean(process.env.DATABASE_URL);
  const nodeVersion = process.version;

  if (!databaseUrlSet) {
    return NextResponse.json(
      {
        ok: false,
        databaseUrlSet,
        nodeVersion,
        db: { connected: false },
        hint: "Set DATABASE_URL in the deployment environment and redeploy/restart.",
      },
      { status: 500 },
    );
  }

  try {
    const { PrismaClient, Prisma } = await import("@prisma/client");
    const prisma = new PrismaClient();

    const prismaClientVersion = Prisma.prismaVersion.client;

    await prisma.$queryRaw`SELECT 1`;

    // Sanity checks for the auth path (login + home page).
    let userCount: number | null = null;
    let sessionCount: number | null = null;
    try {
      userCount = await prisma.user.count();
    } catch {
      userCount = null;
    }
    try {
      sessionCount = await prisma.session.count();
    } catch {
      sessionCount = null;
    }

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

    return NextResponse.json({
      ok: true,
      databaseUrlSet,
      nodeVersion,
      prismaClientVersion,
      db: { connected: true, migrationsApplied, userCount, sessionCount },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[health] DB check failed", error);
    return NextResponse.json(
      {
        ok: false,
        databaseUrlSet,
        nodeVersion,
        db: { connected: false },
        error: message,
      },
      { status: 500 },
    );
  }
}
