#!/usr/bin/env node
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import process from "node:process";
import url from "node:url";

const workspace = process.env.GITHUB_WORKSPACE || process.cwd();
const get = (k, d=undefined) => process.env[`INPUT_${k}`.toUpperCase()] || d;

const token = get("GITHUB_TOKEN");
if (!token) {
  console.error("Missing input: github-token");
  process.exit(1);
}

const rcPath = path.resolve(workspace, get("LHRC_PATH", ".lighthouserc.json"));
if (!fs.existsSync(rcPath)) {
  console.error(`.lighthouserc.json not found at ${rcPath}`);
  process.exit(1);
}

const previewUrl = get("PREVIEW_URL");          // preferred
const staticDir = get("STATIC_DIST_DIR");       // fallback 1
const startCmd  = get("START_COMMAND");         // fallback 2
const readyPat  = get("READY_PATTERN") || "ready|listening|started";
const routesStr = get("ROUTES");                // optional override

// Load repo rc and create a temp copy we can mutate
const origRc = JSON.parse(fs.readFileSync(rcPath, "utf8"));
const rc = JSON.parse(JSON.stringify(origRc)); // deep clone

// Ensure upload target is filesystem for artifacts
rc.ci = rc.ci || {};
rc.ci.upload = rc.ci.upload || { target: "filesystem", outputDir: "./lhci-reports" };
const reportsDir = path.resolve(workspace, rc.ci.upload.outputDir);

// Resolve routes/urls
let urls = Array.isArray(rc?.ci?.collect?.url) ? [...rc.ci.collect.url] : [];
if (routesStr) {
  // override URLs using routes list (expects path-only like /, /pricing)
  const routes = routesStr.split(",").map(s => s.trim()).filter(Boolean);
  urls = routes;
}

// Mode selection
let mode = null;
let baseUrl = null;

if (previewUrl) {
  mode = "preview";
  baseUrl = previewUrl.replace(/\/$/, "");
  // Replace $BASE_URL in urls; if urls are path-only, prefix them.
  urls = urls.map(u => u.includes("$BASE_URL")
    ? u.replaceAll("$BASE_URL", baseUrl)
    : u.startsWith("http") ? u : `${baseUrl}${u.startsWith("/") ? "" : "/"}${u}`);
  rc.ci.collect = { ...(rc.ci.collect||{}), url: urls };
} else if (staticDir) {
  mode = "static";
  rc.ci.collect = { ...(rc.ci.collect||{}), staticDistDir: staticDir, url: urls };
} else if (startCmd) {
  mode = "local";
  baseUrl = "http://127.0.0.1:3000"; // default; users put $BASE_URL in rc
  urls = urls.map(u => u.includes("$BASE_URL")
    ? u.replaceAll("$BASE_URL", baseUrl)
    : u);
  rc.ci.collect = {
    ...(rc.ci.collect || {}),
    startServerCommand: startCmd,
    startServerReadyPattern: readyPat,
    startServerReadyTimeout: rc?.ci?.collect?.startServerReadyTimeout ?? 120000,
    url: urls
  };
} else {
  // No mode hints; assume rc already has usable collect config
  mode = "rc-only";
}

// Write temp rc
const tmpDir = path.resolve(workspace, ".lhci-tmp");
await fsp.mkdir(tmpDir, { recursive: true });
const tmpRcPath = path.join(tmpDir, "lighthouserc.generated.json");
await fsp.writeFile(tmpRcPath, JSON.stringify(rc, null, 2), "utf8");

// Run LHCI (don’t fail pipeline here; we’ll judge via assertions later)
const run = (cmd, args, opts={}) => new Promise((resolve) => {
  const p = spawn(cmd, args, { stdio: "inherit", ...opts });
  p.on("exit", (code) => resolve(code ?? 0));
});

console.log(`Mode: ${mode}`);
console.log(`Running LHCI with ${tmpRcPath}`);
const code = await run("npx", ["-y", "@lhci/cli@0.15.x", "autorun", "--config", tmpRcPath], { cwd: workspace });
if (code !== 0) {
  console.warn(`LHCI exited with code ${code} (continuing to post summary)`);
}

// Call commenter
const commentScript = path.join(path.dirname(url.fileURLToPath(import.meta.url)), "comment.mjs");
process.env.CWV_REPORTS_DIR = reportsDir;
process.env.CWV_RC_PATH = tmpRcPath;
process.env.INPUT_MODE = mode;
const code2 = await run("node", [commentScript], { cwd: workspace });
process.exit(code2);
