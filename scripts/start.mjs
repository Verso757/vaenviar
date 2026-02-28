import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const hostname = process.env.HOSTNAME ?? "0.0.0.0";

if (!Number.isFinite(port) || port <= 0) {
  console.error("[start] Invalid PORT:", process.env.PORT);
  process.exit(1);
}

console.log(`[start] Starting Next.js on ${hostname}:${port}`);

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptsDir, "..");

function parseDotenv(content) {
  const env = {};
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex <= 0) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function tryLoadEnvFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return false;
    const content = fs.readFileSync(filePath, "utf8");
    const parsed = parseDotenv(content);
    let applied = 0;
    for (const [key, value] of Object.entries(parsed)) {
      if (process.env[key] === undefined) {
        process.env[key] = value;
        applied++;
      }
    }
    console.log(`[start] Loaded env file: ${filePath} (applied ${applied} vars)`);
    return true;
  } catch (e) {
    console.warn(`[start] Failed to load env file: ${filePath}`, e);
    return false;
  }
}

function loadEnvIfNeeded() {
  // If the hosting platform doesn't inject env vars into runtime,
  // try reading them from common .env locations.
  if (process.env.DATABASE_URL) return;

  const candidates = [];

  // Search upward from rootDir for `.env` and `.builds/config/.env`.
  let current = rootDir;
  for (let i = 0; i < 7; i++) {
    candidates.push(path.join(current, ".env"));
    candidates.push(path.join(current, ".builds", "config", ".env"));
    candidates.push(path.join(current, "public_html", ".builds", "config", ".env"));
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  for (const candidate of candidates) {
    if (tryLoadEnvFile(candidate) && process.env.DATABASE_URL) return;
  }
}

loadEnvIfNeeded();

const nextBinCandidates = [
  path.join(rootDir, "node_modules", "next", "dist", "bin", "next"),
  path.join(rootDir, "node_modules", "next", "dist", "bin", "next.js"),
];

const nextBin = nextBinCandidates.find((candidate) => fs.existsSync(candidate));
if (!nextBin) {
  console.error("[start] Could not find Next.js binary in node_modules.");
  process.exit(1);
}

// Some hosting panels run `npm start` without running `npm run build`.
// Next.js requires a production build (the `.next` folder) to exist.
const buildIdPath = path.join(rootDir, ".next", "BUILD_ID");
if (!fs.existsSync(buildIdPath)) {
  console.log("[start] .next build not found; running `next build`...");
  const result = spawnSync(process.execPath, [nextBin, "build"], {
    stdio: "inherit",
    env: process.env,
    cwd: rootDir,
  });

  if (result.status !== 0) {
    console.error("[start] `next build` failed; aborting start.");
    process.exit(result.status ?? 1);
  }
}

const child = spawn(
  process.execPath,
  [nextBin, "start", "-H", hostname, "-p", String(port)],
  {
    stdio: "inherit",
    env: process.env,
    cwd: rootDir,
  },
);

child.on("exit", (code, signal) => {
  if (signal) {
    console.error("[start] Next.js exited due to signal", signal);
    process.exit(1);
  }
  process.exit(code ?? 1);
});
