import type { SpawnOptions } from "node:child_process";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { loadConfig, type NormRc, transformConfig } from "@wapmetrics/config";
import type {
  BudgetConfig,
  LhciSummaryItem,
  Manifest,
  RouteConfig,
} from "@wapmetrics/schemas";

const sh = (cmd: string, args: string[], opts: SpawnOptions = {}) =>
  new Promise<number>((resolve) => {
    const p = spawn(cmd, args, { stdio: "inherit", ...opts });
    p.on("exit", (c) => resolve(c ?? 0));
  });

export type RunOptions = {
  configPath: string; // path to normrc.json
  outDir: string; // where to write reports
};

export type RunResult = {
  config: NormRc;
};

export async function runLhci(opts: RunOptions): Promise<RunResult> {
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

  // 3. Run LHCI - skip assert phase if no assertions defined
  const hasAssertions =
    rc.ci.assert?.assertions && Object.keys(rc.ci.assert.assertions).length > 0;
  const lhciArgs = ["-y", "@lhci/cli@0.15.x", "autorun", "--config", tmpRc];

  // If no assertions, skip the assert step to avoid "No assertions to use" error
  if (!hasAssertions) {
    lhciArgs.push("--steps=collect,upload");
  }

  const lhciExit = await sh("npx", lhciArgs, { cwd: process.cwd() });

  if (lhciExit !== 0) {
    throw new Error(`LHCI failed with exit code ${lhciExit}`);
  }

  fs.unlinkSync(tmpRc);

  // 4. Build summary from representative runs only
  const lhciDir = path.join(opts.outDir, "lhci");
  const lhciManifestPath = path.join(lhciDir, "manifest.json");

  type LhciManifestEntry = {
    url: string;
    isRepresentativeRun: boolean;
    htmlPath: string;
    jsonPath: string;
  };

  const lhciManifest: LhciManifestEntry[] = fs.existsSync(lhciManifestPath)
    ? JSON.parse(fs.readFileSync(lhciManifestPath, "utf8"))
    : [];

  // Filter for representative runs only
  const representativeRuns = lhciManifest.filter((e) => e.isRepresentativeRun);

  // Build summary from representative runs
  const summaries: LhciSummaryItem[] = [];
  for (const entry of representativeRuns) {
    const reportPath = path.join(lhciDir, entry.jsonPath);
    const rpt = JSON.parse(fs.readFileSync(reportPath, "utf8"));
    const audits = rpt.audits || {};

    summaries.push({
      url: rpt.finalUrl,
      lcp: audits["largest-contentful-paint"]?.numericValue,
      cls: audits["cumulative-layout-shift"]?.numericValue,
      inp: audits["interaction-to-next-paint"]?.numericValue,
      tbt: audits["total-blocking-time"]?.numericValue,
      htmlReportPath: entry.htmlPath,
    });
  }

  fs.writeFileSync(
    path.join(opts.outDir, "lhci-summary.json"),
    JSON.stringify({ summaries }, null, 2),
  );

  // Clean up: remove non-representative files to keep tarball small
  const allFiles = fs.readdirSync(lhciDir);
  const representativeHtmlFiles = new Set(
    representativeRuns.map((r) => r.htmlPath),
  );

  for (const file of allFiles) {
    // Keep representative HTML files, delete everything else
    if (file === "manifest.json") continue; // Keep LHCI manifest for reference
    if (representativeHtmlFiles.has(file)) continue; // Keep representative HTML

    // Delete JSON reports and non-representative HTML
    fs.unlinkSync(path.join(lhciDir, file));
  }

  return { config: norm };
}

/**
 * Convert NormRc budgets to manifest budget format
 */
function transformBudgets(
  normBudgets: NormRc["budgets"],
): Record<string, BudgetConfig> | undefined {
  if (!normBudgets) return undefined;

  const result: Record<string, BudgetConfig> = {};

  for (const [key, budget] of Object.entries(normBudgets)) {
    if (!budget?.timings) continue;

    result[key] = {
      lcp: budget.timings["largest-contentful-paint"],
      cls: budget.timings["cumulative-layout-shift"],
      inp: budget.timings["interaction-to-next-paint"],
      tbt: budget.timings["total-blocking-time"],
    };
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * Convert NormRc routes to manifest route format
 */
function transformRoutes(normRoutes: NormRc["routes"]): RouteConfig[] {
  return normRoutes.map((route) => {
    if (typeof route === "string") {
      return route;
    }
    return {
      path: route.path,
      budget: route.budget,
    };
  });
}

export function makeManifest(params: {
  config: NormRc;
  owner?: string;
  repo?: string;
  pr?: number;
  sha?: string;
}): Manifest {
  const { config, owner, repo, pr, sha } = params;

  return {
    version: 1,
    owner,
    repo,
    pr,
    sha,
    plugins: {
      lhci: {
        baseUrl: config.settings.baseUrl,
        numberOfRuns: config.settings.numberOfRuns,
        routes: transformRoutes(config.routes),
        budgets: transformBudgets(config.budgets),
      },
    },
    createdAt: new Date().toISOString(),
  };
}
