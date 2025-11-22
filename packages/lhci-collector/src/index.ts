import type { SpawnOptions } from "node:child_process";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { LhciSummaryItem, Manifest } from "@wapmetrics/schemas";

const sh = (cmd: string, args: string[], opts: SpawnOptions = {}) =>
  new Promise<number>((resolve) => {
    const p = spawn(cmd, args, { stdio: "inherit", ...opts });
    p.on("exit", (c) => resolve(c ?? 0));
  });

export type RunOptions = {
  baseUrl: string; // e.g., http://127.0.0.1:3000

  routes?: string[]; // fallback if rc has no urls
  lhrcPath: string; // path to .lighthouserc.json
  outDir: string; // where to write reports
  budgets?: { lcp?: number; cls?: number; inp?: number; tbt?: number };
};

export async function runLhci(opts: RunOptions) {
  fs.mkdirSync(opts.outDir, { recursive: true });

  const rcPath = path.resolve(process.cwd(), opts.lhrcPath);
  const rc = JSON.parse(fs.readFileSync(rcPath, "utf8"));

  const base = opts.baseUrl.replace(/\/$/, "");
  const urls: string[] = (rc?.ci?.collect?.url ?? opts.routes ?? []).map(
    (u: string) =>
      u.includes("$BASE_URL")
        ? u.replaceAll("$BASE_URL", base)
        : u.startsWith("http")
          ? u
          : `${base}${u.startsWith("/") ? "" : "/"}${u}`,
  );

  rc.ci = rc.ci || {};
  rc.ci.collect = { ...(rc.ci.collect || {}), url: urls };
  rc.ci.upload = {
    target: "filesystem",
    outputDir: path.join(opts.outDir, "lhci"),
  };

  // Extract budgets from RC if not provided in opts
  if (!opts.budgets || Object.keys(opts.budgets).length === 0) {
    const rcBudgets = rc.ci?.assert?.budgets;
    if (Array.isArray(rcBudgets)) {
      // Try to find a global budget or the first one
      const globalBudget =
        rcBudgets.find((b: any) => b.path === "/" || b.path === "*") ||
        rcBudgets[0];
      if (globalBudget?.timings) {
        opts.budgets = opts.budgets || {};
        for (const t of globalBudget.timings) {
          if (t.metric === "largest-contentful-paint") opts.budgets.lcp = t.budget;
          if (t.metric === "cumulative-layout-shift") opts.budgets.cls = t.budget;
          if (t.metric === "interaction-to-next-paint") opts.budgets.inp = t.budget;
          if (t.metric === "total-blocking-time") opts.budgets.tbt = t.budget;
        }
      }
    }
  }

  const tmpRc = path.join(opts.outDir, "lighthouserc.generated.json");
  fs.writeFileSync(tmpRc, JSON.stringify(rc, null, 2), "utf8");

  // Run LHCI and fail on non-zero exit
  const lhciExit = await sh(
    "npx",
    ["-y", "@lhci/cli@0.15.x", "autorun", "--config", tmpRc],
    { cwd: process.cwd() },
  );
  if (lhciExit !== 0) {
    throw new Error(`LHCI failed with exit code ${lhciExit}`);
  }

  fs.unlinkSync(tmpRc);

  // Build summary
  const reports = path.join(opts.outDir, "lhci");
  const files = fs.existsSync(reports)
    ? fs.readdirSync(reports).filter((f) => f.endsWith(".json") && f.startsWith("lhci-report-"))
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
}

export function makeManifest(params: {
  routes: string[];
  budgets?: { lcp?: number; cls?: number; inp?: number; tbt?: number };
  owner?: string;
  repo?: string;
  pr?: number;
  sha?: string;
}): Manifest {
  return {
    version: 1,
    owner: params.owner,
    repo: params.repo,
    pr: params.pr,
    sha: params.sha,
    routes: params.routes,
    env: { preset: "mobile" },
    collectors: { lhci: true },
    budgets: params.budgets,
    createdAt: new Date().toISOString(),
  };
}
