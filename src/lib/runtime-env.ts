import fs from "node:fs";
import path from "node:path";

const loadedFiles = new Set<string>();

function parseDotenv(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
}

function applyEnvFile(filePath: string): number {
  if (!fs.existsSync(filePath)) return 0;
  if (loadedFiles.has(filePath)) return 0;

  const parsed = parseDotenv(fs.readFileSync(filePath, "utf8"));
  let applied = 0;
  for (const [key, value] of Object.entries(parsed)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
      applied++;
    }
  }

  loadedFiles.add(filePath);
  return applied;
}

function getCandidates(): string[] {
  const cwd = process.cwd();
  const candidates: string[] = [];

  let current = cwd;
  for (let i = 0; i < 7; i++) {
    candidates.push(path.join(current, ".env"));
    candidates.push(path.join(current, ".builds", "config", ".env"));
    candidates.push(path.join(current, "public_html", ".builds", "config", ".env"));

    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return candidates;
}

export function ensureRuntimeEnv(requiredKeys: string[]): void {
  const missing = requiredKeys.filter((key) => !process.env[key]);
  if (missing.length === 0) return;

  for (const candidate of getCandidates()) {
    try {
      applyEnvFile(candidate);
    } catch {
      // Ignore invalid/unreadable files and keep searching.
    }
    if (requiredKeys.every((key) => Boolean(process.env[key]))) {
      break;
    }
  }
}
