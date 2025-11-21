import fsp from "node:fs/promises";
import path from "node:path";
import * as core from "@actions/core";
import { context } from "@actions/github";
import { makeManifest, runLhci } from "@wapmetrics/lhci-collector";
import type { Manifest } from "@wapmetrics/schemas";
import { uploadArtifact } from "@wapmetrics/uploader";
import * as tar from "tar";

async function main() {
  const baseUrl = core
    .getInput("base-url", { required: true })
    .replace(/\/$/, "");
  const routes = core
    .getInput("routes", { required: true })
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const lhrcPath = core.getInput("lhrc-path") || ".lighthouserc.json";
  const budgets = core.getInput("budgets")
    ? JSON.parse(core.getInput("budgets"))
    : {};
  const outTgz = core.getInput("out") || ".wapmetrics/wapmetrics-run.tgz";
  const token = core.getInput("token");
  const apiUrl = core.getInput("api-url");

  const tmp = path.join(process.cwd(), ".wapmetrics/tmp");
  await fsp.mkdir(tmp, { recursive: true });

  await runLhci({ baseUrl, routes, lhrcPath, outDir: tmp, budgets });

  const payload = context.payload as
    | { pull_request?: { number?: number } }
    | undefined;
  const prNumber = payload?.pull_request?.number ?? Number(process.env.PR_NUMBER || 0);
  const manifest: Manifest = makeManifest({
    routes,
    budgets,
    owner: context.repo.owner,
    repo: context.repo.repo,
    pr: prNumber,
    sha: process.env.GITHUB_SHA,
  });
  await fsp.writeFile(
    path.join(tmp, "manifest.json"),
    JSON.stringify(manifest, null, 2),
    "utf8",
  );

  await fsp.mkdir(path.dirname(outTgz), { recursive: true });
  await tar.create({ gzip: true, file: outTgz, cwd: tmp }, ["."]);
  core.setOutput("artifact-path", outTgz);

  core.info(`WAPMetrics artifacts packaged at ${outTgz}`);

  if (token) {
    core.info("Uploading artifacts to WAPMetrics...");
    try {
      await uploadArtifact({
        token,
        apiUrl,
        bundlePath: outTgz,
        owner: context.repo.owner,
        repo: context.repo.repo,
        sha: process.env.GITHUB_SHA || "unknown",
        pr: prNumber,
      });
      core.info("Upload successful!");
    } catch (error) {
      core.error(`Upload failed: ${(error as Error).message}`);
      throw error;
    }
  }
}

main().catch((err) => core.setFailed((err as Error).message));
