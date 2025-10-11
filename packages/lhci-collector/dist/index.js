import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
const sh = (cmd, args, opts = {}) => new Promise((resolve) => {
    const p = spawn(cmd, args, { stdio: "inherit", ...opts });
    p.on("exit", (c) => resolve(c ?? 0));
});
export async function runLhci(opts) {
    fs.mkdirSync(opts.outDir, { recursive: true });
    const rcPath = path.resolve(process.cwd(), opts.lhrcPath);
    const rc = JSON.parse(fs.readFileSync(rcPath, "utf8"));
    const base = opts.baseUrl.replace(/\/$/, "");
    const urls = (rc?.ci?.collect?.url ?? opts.routes ?? []).map((u) => u.includes("$BASE_URL")
        ? u.replaceAll("$BASE_URL", base)
        : u.startsWith("http")
            ? u
            : `${base}${u.startsWith("/") ? "" : "/"}${u}`);
    rc.ci = rc.ci || {};
    rc.ci.collect = { ...(rc.ci.collect || {}), url: urls };
    rc.ci.upload = {
        target: "filesystem",
        outputDir: path.join(opts.outDir, "lhci"),
    };
    const tmpRc = path.join(opts.outDir, "lighthouserc.generated.json");
    fs.writeFileSync(tmpRc, JSON.stringify(rc, null, 2), "utf8");
    // Run LHCI and fail on non-zero exit
    const lhciExit = await sh("npx", ["-y", "@lhci/cli@0.15.x", "autorun", "--config", tmpRc], { cwd: process.cwd() });
    if (lhciExit !== 0) {
        throw new Error(`LHCI failed with exit code ${lhciExit}`);
    }
    // Build summary
    const reports = path.join(opts.outDir, "lhci");
    const files = fs.existsSync(reports)
        ? fs.readdirSync(reports).filter((f) => f.endsWith(".json"))
        : [];
    const summaries = [];
    for (const f of files) {
        const rpt = JSON.parse(fs.readFileSync(path.join(reports, f), "utf8"));
        const audits = rpt.audits || {};
        summaries.push({
            url: rpt.finalUrl,
            lcp: audits["largest-contentful-paint"]?.numericValue,
            cls: audits["cumulative-layout-shift"]?.numericValue,
            inp: audits["interaction-to-next-paint"]?.numericValue,
        });
    }
    fs.writeFileSync(path.join(opts.outDir, "lhci-summary.json"), JSON.stringify({ summaries, budgets: opts.budgets ?? {} }, null, 2));
}
export function makeManifest(params) {
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
