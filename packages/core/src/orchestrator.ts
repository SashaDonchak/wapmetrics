import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { setCheck, upsertStickyComment } from "./comment.js";
import { type AIWFConfig, loadConfig } from "./config.js";
import type { Finding, Plugin, Registry, RunContext } from "./sdk.js";

type Inputs = {
  githubToken: string;
  owner: string;
  repo: string;
  pr: number;
  sha: string;
  configPath?: string;
  pluginsOverride?: string; // "lhci,axe"
  previewUrl?: string;
  staticDistDir?: string;
  startCommand?: string;
  readyPattern?: string;
  budgets?: { lcp?: number; cls?: number; inp?: number };
  registry: Registry; // name -> dynamic import()
};

export async function runOrchestrator(i: Inputs) {
  // Load user config (best-effort; env inputs take precedence)
  const cfg: AIWFConfig = loadConfig(i.configPath ?? ".aiwf.yml");
  const enabledNamesFromCfg =
    cfg.plugins?.filter((p) => p.enabled !== false).map((p) => p.name) ?? [];
  const override = (i.pluginsOverride ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const selectedNames = override.length ? override : enabledNamesFromCfg;

  // Resolve runtime mode / baseUrl
  const baseUrl = i.previewUrl || undefined;
  const staticDistDir = i.staticDistDir || cfg.runtime?.staticDistDir;
  const startCommand = i.startCommand || cfg.runtime?.start?.command;
  const readyPattern =
    i.readyPattern ||
    cfg.runtime?.start?.readyPattern ||
    "ready|listening|started";

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aiwf-"));
  const cwd = process.cwd();

  // Merge budgets
  const budgets = Object.assign({}, cfg.budgets ?? {}, i.budgets ?? {});

  // Prepare plugin instances
  const loadPlugin = async (name: string): Promise<Plugin> => {
    const loader = i.registry[name];
    if (!loader) throw new Error(`Unknown plugin: ${name}`);
    const mod = await loader();
    return mod.default;
  };

  const toRun = selectedNames.length ? selectedNames : []; // no auto-detect in v1

  const sections: string[] = [];
  const allFindings: Finding[] = [];

  for (const name of toRun) {
    const plugin = await loadPlugin(name);
    const { defaults } = plugin.init();
    // Merge plugin-level config from cfg.plugins entry if present
    const fromCfg = cfg.plugins?.find((p) => p.name === name)?.config ?? {};
    const mergedConfig = { ...(defaults ?? {}), ...(fromCfg ?? {}) };

    const ctx: RunContext = {
      baseUrl,
      staticDistDir,
      startCommand,
      startReadyPattern: readyPattern,
      cwd,
      tempDir: path.join(tempDir, name),
      config: mergedConfig,
      env: process.env as Record<string, string>,
      budgets,
      github: {
        token: i.githubToken,
        owner: i.owner,
        repo: i.repo,
        pr: i.pr,
        sha: i.sha,
      },
    };

    fs.mkdirSync(ctx.tempDir, { recursive: true });

    if (plugin.prepare) await plugin.prepare(ctx);
    const { findings, artifacts } = await plugin.run(ctx);
    allFindings.push(...findings);

    if (plugin.summarize) {
      const { md } = await plugin.summarize({ findings, artifacts });
      if (md) sections.push(md.trim());
    } else {
      sections.push(`### ${name}\n\n_${findings.length} findings_`);
    }
  }

  // Render final comment
  const blockers = allFindings.filter(
    (f) => f.severity === "high" || f.severity === "critical",
  );
  const ok = blockers.length === 0;
  const header = `## ⚙️ AI Workflows\n**Status:** ${ok ? "✅ Passing" : "❌ Failing"}\n`;
  const body = [header, ...sections].join("\n\n");

  await upsertStickyComment({
    token: i.githubToken,
    owner: i.owner,
    repo: i.repo,
    pr: i.pr,
    body,
    marker: "<!-- aiwf-sticky -->",
  });

  await setCheck({
    token: i.githubToken,
    owner: i.owner,
    repo: i.repo,
    sha: i.sha,
    title: "AI Workflows",
    summary: body,
    success: ok,
  });

  return { ok, findings: allFindings, comment: body };
}
