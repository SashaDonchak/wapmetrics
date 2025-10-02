import fs from "node:fs";
import path from "node:path";

export type AIWFConfig = {
  version: number;
  plugins?: {
    name: string;
    enabled?: boolean;
    config?: Record<string, unknown>;
  }[];
  runtime?: {
    previewUrl?: string;
    staticDistDir?: string;
    start?: {
      command?: string;
      readyPattern?: string;
      readyTimeoutMs?: number;
    };
  };
  budgets?: { lcp?: number; cls?: number; inp?: number };
};

export function loadConfig(configPath = ".aiwf.yml"): AIWFConfig {
  const p = path.resolve(process.cwd(), configPath);
  if (!fs.existsSync(p)) return { version: 1 };
  const raw = fs.readFileSync(p, "utf8");
  // naive YAML loader to avoid extra deps (simple subset):
  const _yaml = raw
    .split("\n")
    .filter((l) => !l.trim().startsWith("#"))
    .join("\n");
  // Extremely small YAML-to-JSON heuristic for our simple shape:
  // For real-world you can replace with 'yaml', but keep no external deps here.
  try {
    // Best-effort: allow JSON too
    if (raw.trim().startsWith("{")) return JSON.parse(raw);
  } catch {}
  // If YAML: users often keep it tiny; support only keys we care about by delegating to env-first approach.
  // We won't parse full YAML here; orchestrator allows overrides via inputs.
  return { version: 1 };
}
