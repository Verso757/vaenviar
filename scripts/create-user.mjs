import bcrypt from "bcryptjs";
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

const email = requireArg("email").trim().toLowerCase();
const name = requireArg("name").trim();
const password = requireArg("password");
const role = (getArg("role") ?? "EMPLOYEE").trim().toUpperCase();
const locationCode = getArg("locationCode")?.trim();

const allowedRoles = new Set(["ADMIN", "EMPLOYEE", "GUARD"]);
if (!allowedRoles.has(role)) {
  console.error(`Invalid role: ${role}. Allowed: ADMIN|EMPLOYEE|GUARD`);
  process.exit(1);
}

let locationId = null;
if (locationCode) {
  const location = await prisma.location.findUnique({ where: { code: locationCode } });
  if (!location) {
    console.error(`Location not found for code: ${locationCode}`);
    process.exit(1);
  }
  locationId = location.id;
}

const passwordHash = await bcrypt.hash(password, 12);

const user = await prisma.user.create({
  data: {
    email,
    name,
    passwordHash,
    role,
    locationId,
  },
  select: {
    id: true,
    email: true,
    name: true,
    role: true,
  },
});

console.log("Created user:", user);
await prisma.$disconnect();
