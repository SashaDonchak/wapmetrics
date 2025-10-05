#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { Octokit } from "@octokit/rest";

const token = process.env.INPUT_GITHUB_TOKEN || process.env.GITHUB_TOKEN;
if (!token) {
  console.error("Missing github-token");
  process.exit(1);
}

const reportsDir = process.env.CWV_REPORTS_DIR || "lhci-reports";
const rcPath = process.env.CWV_RC_PATH || ".lighthouserc.json";

// Load budgets from rc assertions so we don’t hardcode
const rc = fs.existsSync(rcPath)
  ? JSON.parse(fs.readFileSync(rcPath, "utf8"))
  : {};
const a = rc?.ci?.assert?.assertions || {};
const budgets = {
  lcp: a["largest-contentful-paint"]?.[1]?.maxNumericValue ?? 2500,
  cls: a["cumulative-layout-shift"]?.[1]?.maxNumericValue ?? 0.1,
  inp: a["interaction-to-next-paint"]?.[1]?.maxNumericValue ?? 200,
};

// Collect JSON reports
const files = fs.existsSync(reportsDir)
  ? fs.readdirSync(reportsDir).filter((f) => f.endsWith(".json"))
  : [];
if (!files.length) {
  console.warn(`No LHCI JSON reports found in ${reportsDir}`);
  process.exit(0);
}

const best = { lcp: Infinity, cls: Infinity, inp: Infinity };
for (const f of files) {
  const rpt = JSON.parse(fs.readFileSync(path.join(reportsDir, f), "utf8"));
  const audits = rpt.audits || {};
  const m = {
    lcp: audits["largest-contentful-paint"]?.numericValue,
    cls: audits["cumulative-layout-shift"]?.numericValue,
    inp: audits["interaction-to-next-paint"]?.numericValue,
  };
  if (m.lcp && m.lcp < best.lcp) best.lcp = m.lcp;
  if (m.cls && m.cls < best.cls) best.cls = m.cls;
  if (m.inp && m.inp < best.inp) best.inp = m.inp;
}
const pass = (v, b) => v !== Infinity && v <= b;
const ok =
  pass(best.lcp, budgets.lcp) &&
  pass(best.cls, budgets.cls) &&
  pass(best.inp, budgets.inp);
const fmtMs = (ms) =>
  ms == null || ms === Infinity ? "—" : `${(ms / 1000).toFixed(2)}s`;

const artifactsNote = `Artifacts saved in \`${path.relative(process.cwd(), reportsDir) || reportsDir}\``;

const bodyMd = `
## ⚡ Core Web Vitals (mobile)
**Status:** ${ok ? "✅ Passing" : "❌ Failing"}

| Metric | Best Value | Budget | Status |
|---|---:|---:|:--:|
| LCP | ${fmtMs(best.lcp)} | ${(budgets.lcp / 1000).toFixed(2)}s | ${pass(best.lcp, budgets.lcp) ? "✅" : "❌"} |
| CLS | ${best.cls === Infinity ? "—" : best.cls.toFixed(3)} | ${budgets.cls.toFixed(3)} | ${pass(best.cls, budgets.cls) ? "✅" : "❌"} |
| INP | ${fmtMs(best.inp)} | ${(budgets.inp / 1000).toFixed(2)}s | ${pass(best.inp, budgets.inp) ? "✅" : "❌"} |

<sub>Config: <code>.lighthouserc.json</code> • ${artifactsNote}</sub>
`.trim();

const marker = "<!-- cwv-sticky -->";
const commentBody = `${marker}\n${bodyMd}`;

const octokit = new Octokit({ auth: token });
const [owner, repo] = (process.env.GITHUB_REPOSITORY || "").split("/");
const pr =
  process.env.PR_NUMBER ||
  (process.env.GITHUB_REF || "").match(/refs\/pull\/(\d+)\/merge/)?.[1] ||
  process.env.GITHUB_REF_NAME; // fallback (Actions v4 exposes number differently in some contexts)

if (!owner || !repo || !pr) {
  console.error("Cannot resolve PR context. Ensure this runs on pull_request.");
  process.exit(1);
}

// Upsert sticky comment
const comments = await octokit.issues.listComments({
  owner,
  repo,
  issue_number: pr,
  per_page: 100,
});
const prev = comments.data.find((c) => c.body?.includes(marker));
if (prev) {
  await octokit.issues.updateComment({
    owner,
    repo,
    comment_id: prev.id,
    body: commentBody,
  });
} else {
  await octokit.issues.createComment({
    owner,
    repo,
    issue_number: pr,
    body: commentBody,
  });
}

// Create a neat check run
const sha = process.env.GITHUB_SHA;
await octokit.checks.create({
  owner,
  repo,
  name: "Core Web Vitals",
  head_sha: sha,
  status: "completed",
  conclusion: ok ? "success" : "failure",
  output: { title: "Core Web Vitals", summary: bodyMd },
});

console.log(`Posted CWV summary — ${ok ? "pass" : "fail"}`);
process.exit(ok ? 0 : 2);
