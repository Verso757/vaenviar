import { NextResponse } from "next/server";
import { ensureRuntimeEnv } from "@/lib/runtime-env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  ensureRuntimeEnv(["DATABASE_URL"]);

  const databaseUrlRaw = process.env.DATABASE_URL ?? "";
  const databaseUrlSet = databaseUrlRaw.length > 0;
  const nodeVersion = process.version;

  const databaseUrlLength = databaseUrlRaw.length;
  let databaseUrlInfo:
    | {
        protocol?: string;
        host?: string;
        port?: string;
        database?: string;
        username?: string;
        passwordSet?: boolean;
        passwordLength?: number;
        parseError?: string;
      }
    | null = null;

  if (databaseUrlSet) {
    try {
      const url = new URL(databaseUrlRaw);
      databaseUrlInfo = {
        protocol: url.protocol,
        host: url.hostname,
        port: url.port,
        database: url.pathname?.replace(/^\//, "") || "",
        username: url.username,
        passwordSet: Boolean(url.password),
        passwordLength: url.password?.length ?? 0,
      };
    } catch (e) {
      databaseUrlInfo = {
        parseError: e instanceof Error ? e.message : String(e),
      };
    }
  }

  if (!databaseUrlSet) {
    return NextResponse.json(
      {
        ok: false,
        databaseUrlSet,
        databaseUrlLength,
        databaseUrlInfo,
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
    let writeTest: { ok: boolean; error?: string } | null = null;
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

    // Optional write permission test (INSERT/DELETE) since login creates a Session.
    try {
      const firstUser = await prisma.user.findFirst({ select: { id: true } });
      if (!firstUser) {
        writeTest = { ok: false, error: "No users found to run write test." };
      } else {
        const tokenHash = `health_${Date.now()}_${Math.random().toString(16).slice(2)}`;
        const created = await prisma.session.create({
          data: {
            tokenHash,
            userId: firstUser.id,
            expiresAt: new Date(Date.now() + 60_000),
          },
          select: { id: true },
        });
        await prisma.session.delete({ where: { id: created.id } });
        writeTest = { ok: true };
      }
    } catch (e) {
      writeTest = { ok: false, error: e instanceof Error ? e.message : String(e) };
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
      databaseUrlLength,
      databaseUrlInfo,
      nodeVersion,
      prismaClientVersion,
      db: { connected: true, migrationsApplied, userCount, sessionCount, writeTest },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[health] DB check failed", error);
    return NextResponse.json(
      {
        ok: false,
        databaseUrlSet,
        databaseUrlLength,
        databaseUrlInfo,
        nodeVersion,
        db: { connected: false },
        error: message,
      },
      { status: 500 },
    );
  }
}
