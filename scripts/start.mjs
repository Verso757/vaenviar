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
