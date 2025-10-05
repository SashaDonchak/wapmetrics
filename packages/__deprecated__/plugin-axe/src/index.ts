declare module "playwright";
declare module "@axe-core/playwright";

import crypto from "node:crypto";
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
      name: "axe",
      version: "0.1.0",
      capabilities: { needsBaseUrl: true, parallelSafe: true },
      defaults: { routes: ["/"] },
    };
  },

  async run(ctx: RunContext) {
    if (!ctx.baseUrl) throw new Error("axe requires baseUrl");
    // Dynamic imports to avoid compile-time dependency on Playwright packages
    const { chromium } = await import("playwright");
    const { AxeBuilder } = await import("@axe-core/playwright");

    const cfg = ctx.config as { routes?: string[] };
    const routes = cfg?.routes ?? ["/"];
    const findings: Finding[] = [];
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      const axe = new AxeBuilder({ page: page });
      for (const route of routes) {
        const url = route.startsWith("http")
          ? route
          : `${ctx.baseUrl}${route.startsWith("/") ? "" : "/"}${route}`;
        await page.goto(url, { waitUntil: "load" });
        axe.options({
          runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] },
        });
        const res = await axe.analyze();
        for (const v of res.violations) {
          const sev: Severity =
            v.impact === "critical" || v.impact === "serious"
              ? "high"
              : "medium";
          findings.push({
            id: H(route + v.id),
            plugin: "axe",
            severity: sev,
            title: `A11y: ${v.id}`,
            message: v.help ?? "",
            route,
            docsUrl: v.helpUrl,
            tags: ["accessibility", "wcag"],
            suggestion: v.nodes?.[0]?.failureSummary,
          });
        }
      }
    } finally {
      await browser.close();
    }
    return { findings };
  },

  async summarize({ findings }: { findings: Finding[] }) {
    const byRoute = new Map<string, number>();
    for (const f of findings)
      byRoute.set(f.route ?? "/", (byRoute.get(f.route ?? "/") ?? 0) + 1);
    const rows =
      Array.from(byRoute.entries())
        .map(([r, n]) => `| ${r} | ${n} violations |`)
        .join("\n") || "| (none) | 0 |";
    const md = `### Accessibility (axe)\n\n| Route | Violations |\n|---|---:|\n${rows}`;
    return { md };
  },
};

export default plugin;
