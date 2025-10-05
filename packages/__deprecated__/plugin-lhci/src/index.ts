import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type {
  Finding,
  Plugin,
  PluginInit,
  RunContext,
  Severity,
} from "@aiwf/core";

const H = (s: string) =>
  crypto.createHash("sha1").update(s).digest("hex").slice(0, 12);

const plugin: Plugin = {
  init(): PluginInit {
    return {
      name: "lhci",
      version: "0.1.0",
      capabilities: { needsBaseUrl: true, parallelSafe: true },
      defaults: { lhrcPath: ".lighthouserc.json" },
    };
  },

  async run(ctx: RunContext) {
    if (!ctx.baseUrl) throw new Error("LHCI requires baseUrl");
    const rcPath = path.resolve(
      ctx.cwd,
      String((ctx.config as any)?.lhrcPath ?? ".lighthouserc.json"),
    );
    const rc = JSON.parse(fs.readFileSync(rcPath, "utf8"));

    // Replace $BASE_URL or prefix path-only routes
    const urls = (rc?.ci?.collect?.url ?? []).map((u: string) =>
      u.includes("$BASE_URL")
        ? u.replaceAll("$BASE_URL", ctx.baseUrl!)
        : u.startsWith("http")
          ? u
          : `${ctx.baseUrl}${u.startsWith("/") ? "" : "/"}${u}`,
    );

    rc.ci = rc.ci || {};
    rc.ci.collect = { ...(rc.ci.collect || {}), url: urls };
    const outDir = path.join(ctx.tempDir, "lhci-reports");
    rc.ci.upload = { target: "filesystem", outputDir: outDir };

    fs.mkdirSync(ctx.tempDir, { recursive: true });
    const tmpRc = path.join(ctx.tempDir, "lighthouserc.generated.json");
    fs.writeFileSync(tmpRc, JSON.stringify(rc, null, 2), "utf8");

    // Run LHCI
    await new Promise<void>((resolve) => {
      const p = spawn(
        "npx",
        ["-y", "@lhci/cli@0.15.x", "autorun", "--config", tmpRc],
        { stdio: "inherit", cwd: ctx.cwd },
      );
      p.on("exit", () => resolve());
    });

    // Parse reports -> Findings
    const files = fs.existsSync(outDir)
      ? fs.readdirSync(outDir).filter((f) => f.endsWith(".json"))
      : [];
    const findings: Finding[] = [];
    for (const f of files) {
      const rpt = JSON.parse(fs.readFileSync(path.join(outDir, f), "utf8"));
      const audits = rpt.audits || {};
      const lcp = audits["largest-contentful-paint"]?.numericValue;
      const cls = audits["cumulative-layout-shift"]?.numericValue;
      const inp = audits["interaction-to-next-paint"]?.numericValue;
      const budgets = ctx.budgets ?? {};
      const route =
        (rpt.finalUrl as string | undefined)?.replace(ctx.baseUrl!, "") || "/";

      const push = (title: string, msg: string, sev: Severity) =>
        findings.push({
          id: H(title + route + msg),
          plugin: "lhci",
          severity: sev,
          title,
          message: msg,
          route,
          tags: ["performance", "cwv"],
          docsUrl: "https://web.dev/vitals/",
        });

      if (budgets.lcp && lcp && lcp > budgets.lcp)
        push(
          "LCP over budget",
          `LCP ${(lcp / 1000).toFixed(2)}s > ${(budgets.lcp / 1000).toFixed(2)}s`,
          "high",
        );
      if (budgets.cls && cls && cls > budgets.cls)
        push(
          "CLS over budget",
          `CLS ${cls.toFixed(3)} > ${budgets.cls.toFixed(3)}`,
          "high",
        );
      if (budgets.inp && inp && inp > budgets.inp)
        push(
          "INP over budget",
          `INP ${(inp / 1000).toFixed(2)}s > ${(budgets.inp / 1000).toFixed(2)}s`,
          "high",
        );
    }

    return { findings, artifacts: [outDir] };
  },

  async summarize({ findings }: { findings: Finding[] }) {
    if (!findings.length)
      return {
        md: "### Lighthouse (Core Web Vitals)\n\n✅ No budget violations.",
      };
    const rows = findings
      .map(
        (f: Finding) =>
          `| ${f.route ?? "/"} | ${f.title} | ${f.message} | ${f.severity.toUpperCase()} |`,
      )
      .join("\n");
    const md = `### Lighthouse (Core Web Vitals)\n\n| Route | Issue | Detail | Severity |\n|---|---|---|---|\n${rows}`;
    return { md };
  },
};

export default plugin;
