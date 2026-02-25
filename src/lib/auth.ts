import crypto from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getPrisma } from "@/lib/db";

const SESSION_COOKIE_NAME = "vaenviar_session";
const SESSION_DAYS = 30;

function sha256Base64Url(input: string): string {
  return crypto.createHash("sha256").update(input).digest("base64url");
}

function getSessionExpiry(): Date {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DAYS);
  return expiresAt;
}

export async function createSessionForUser(userId: string): Promise<void> {
  const prisma = getPrisma();
  const rawToken = crypto.randomBytes(32).toString("base64url");
  const tokenHash = sha256Base64Url(rawToken);
  const expiresAt = getSessionExpiry();

  try {
    await prisma.session.create({
      data: {
        tokenHash,
        userId,
        expiresAt,
      },
    });
  } catch (error) {
    console.error("[auth] Failed to create session", {
      userId,
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  const cookieStore = await cookies();
  cookieStore.set({
    name: SESSION_COOKIE_NAME,
    value: rawToken,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function getCurrentUser() {
  const prisma = getPrisma();
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!rawToken) return null;

  const tokenHash = sha256Base64Url(rawToken);

  let session;
  try {
    session = await prisma.session.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
  } catch (error) {
    console.error("[auth] Failed to load session", {
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }

  if (!session) return null;
  if (session.expiresAt <= new Date()) {
    await prisma.session.delete({ where: { tokenHash } }).catch(() => undefined);
    cookieStore.delete(SESSION_COOKIE_NAME);
    return null;
  }

  return session.user;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function logoutCurrentSession(): Promise<void> {
  const prisma = getPrisma();
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (rawToken) {
    const tokenHash = sha256Base64Url(rawToken);
    await prisma.session.delete({ where: { tokenHash } }).catch(() => undefined);
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
}
