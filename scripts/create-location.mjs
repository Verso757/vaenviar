import { PrismaClient } from "@prisma/client";

function getArg(name) {
  const prefix = `--${name}=`;
  const found = process.argv.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
}

function requireArg(name) {
  const value = getArg(name);
  if (!value) {
    console.error(`Missing required argument: --${name}=...`);
    process.exit(1);
  }
  return value;
}

const prisma = new PrismaClient();

const code = requireArg("code").trim().toUpperCase();
const name = requireArg("name").trim();

const location = await prisma.location.upsert({
  where: { code },
  update: { name },
  create: { code, name },
  select: { id: true, code: true, name: true },
});

console.log("Location:", location);
await prisma.$disconnect();
