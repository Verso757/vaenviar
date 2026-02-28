import { PrismaClient } from "@prisma/client";
import { ensureRuntimeEnv } from "@/lib/runtime-env";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export function getPrisma(): PrismaClient {
  ensureRuntimeEnv(["DATABASE_URL"]);

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }

  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient();
  }

  return globalForPrisma.prisma;
}
