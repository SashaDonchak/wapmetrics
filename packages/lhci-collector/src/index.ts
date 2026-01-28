import type { SpawnOptions } from "node:child_process";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { loadConfig, transformConfig } from "@wapmetrics/config";
import type { LhciSummaryItem, Manifest } from "@wapmetrics/schemas";

const sh = (cmd: string, args: string[], opts: SpawnOptions = {}) =>
  new Promise<number>((resolve) => {
    const p = spawn(cmd, args, { stdio: "inherit", ...opts });
    p.on("exit", (c) => resolve(c ?? 0));
  });

export type RunOptions = {
  configPath: string; // path to normrc.json
  outDir: string; // where to write reports
};

export async function runLhci(opts: RunOptions): Promise<{
  routes: string[];
  preset: string;
  budgets?: { lcp?: number; cls?: number; inp?: number; tbt?: number };
}> {
  fs.mkdirSync(opts.outDir, { recursive: true });

  // Load NormRc configuration
  const norm = loadConfig(opts.configPath);

  // 2. Transform to LHCI Config
  const rc = transformConfig(norm);

  // Set output directory for LHCI
  rc.ci.upload = {
    target: "filesystem",
    outputDir: path.join(opts.outDir, "lhci"),
  };

  const tmpRc = path.join(opts.outDir, "lighthouserc.generated.json");
  fs.writeFileSync(tmpRc, JSON.stringify(rc, null, 2), "utf8");

  // 3. Run LHCI - skip assert phase if no budgets defined
  const hasBudgets = rc.ci.assert?.budgets && rc.ci.assert.budgets.length > 0;
  const lhciArgs = ["-y", "@lhci/cli@0.15.x", "autorun", "--config", tmpRc];

  // If no budgets, skip the assert step to avoid "No assertions to use" error
  if (!hasBudgets) {
    lhciArgs.push("--steps=collect,upload");
  }

  const lhciExit = await sh("npx", lhciArgs, { cwd: process.cwd() });

  if (lhciExit !== 0) {
    throw new Error(`LHCI failed with exit code ${lhciExit}`);
  }

  fs.unlinkSync(tmpRc);

  // 4. Build summary
  const reports = path.join(opts.outDir, "lhci");
  const files = fs.existsSync(reports)
    ? fs
        .readdirSync(reports)
        .filter((f) => f.endsWith(".json") && f !== "manifest.json")
    : [];
  const summaries: LhciSummaryItem[] = [];
  for (const f of files) {
    const rpt = JSON.parse(fs.readFileSync(path.join(reports, f), "utf8"));
    const audits = rpt.audits || {};
    summaries.push({
      url: rpt.finalUrl,
      lcp: audits["largest-contentful-paint"]?.numericValue,
      cls: audits["cumulative-layout-shift"]?.numericValue,
      inp: audits["interaction-to-next-paint"]?.numericValue,
      tbt: audits["total-blocking-time"]?.numericValue,
    });
  }
  fs.writeFileSync(
    path.join(opts.outDir, "lhci-summary.json"),
    JSON.stringify({ summaries }, null, 2),
  );

  // Return used config values for manifest
  const usedRoutes = rc.ci.collect.url;
  const usedPreset = rc.ci.collect.settings?.preset || "mobile";

  // Re-extract simple budgets for manifest if possible, or just pass what we have
  // The manifest expects a specific simple structure.
  // We'll return the global budget values if they exist in the NormRc
  const manifestBudgets = norm.budgets?.global?.timings
    ? {
        lcp: norm.budgets.global.timings["largest-contentful-paint"],
        cls: norm.budgets.global.timings["cumulative-layout-shift"],
        inp: norm.budgets.global.timings["interaction-to-next-paint"],
        tbt: norm.budgets.global.timings["total-blocking-time"],
      }
    : undefined;

  return { routes: usedRoutes, preset: usedPreset, budgets: manifestBudgets };
}

export function makeManifest(params: {
  routes: string[];
  budgets?: { lcp?: number; cls?: number; inp?: number; tbt?: number };
  owner?: string;
  repo?: string;
  pr?: number;
  sha?: string;
  preset?: string;
}): Manifest {
  return {
    version: 1,
    owner: params.owner,
    repo: params.repo,
    pr: params.pr,
    sha: params.sha,
    plugins: {
      lhci: {
        routes: params.routes,
        env: { preset: params.preset || "mobile" },
        budgets: params.budgets,
      },
    },
    createdAt: new Date().toISOString(),
  };
}
