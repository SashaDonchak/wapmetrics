import fs from "node:fs";
import path from "node:path";

// --- Schema Definitions ---

export interface ProjectSettings {
  baseUrl: string;
  numberOfRuns?: number;
}

export interface BudgetTimings {
  "largest-contentful-paint"?: number;
  "cumulative-layout-shift"?: number;
  "interaction-to-next-paint"?: number;
  "total-blocking-time"?: number;
  "first-contentful-paint"?: number;
  [key: string]: number | undefined;
}

export interface Budget {
  timings?: BudgetTimings;
  // We can add resourceSizes, resourceCounts later
  resourceSizes?: Array<{
    resourceType: string;
    budget: number;
  }>;
  resourceCounts?: Array<{
    resourceType: string;
    budget: number;
  }>;
}

export interface RouteObject {
  path: string;
  budget?: string; // Reference to a named budget key
  // Future: headers, waitFor, etc.
}

export type Route = string | RouteObject;

export interface NormRc {
  settings: ProjectSettings;
  budgets?: {
    global?: Budget;
    [key: string]: Budget | undefined;
  };
  routes: Route[];
}

// --- Logic ---

export function loadConfig(configPath: string): NormRc {
  const resolvedPath = path.resolve(process.cwd(), configPath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Configuration file not found at ${resolvedPath}`);
  }

  try {
    const raw = fs.readFileSync(resolvedPath, "utf8");
    const config = JSON.parse(raw) as NormRc;

    // Basic validation
    if (!config.settings || !config.settings.baseUrl) {
      throw new Error("Invalid config: 'settings.baseUrl' is required");
    }
    if (!config.routes || !Array.isArray(config.routes)) {
      throw new Error("Invalid config: 'routes' must be an array");
    }

    return config;
  } catch (err) {
    throw new Error(`Failed to parse config file: ${(err as Error).message}`);
  }
}

// --- Transformation ---

export interface LighthouseRc {
  ci: {
    collect: {
      url: string[];
      numberOfRuns?: number;
      settings?: {
        preset?: "desktop" | "perf" | "experimental";
      };
      // Allow arbitrary LHCI collect options
      [key: string]: unknown;
    };
    assert?: {
      budgets?: Array<{
        path: string;
        timings?: Array<{ metric: string; budget: number }>;
        resourceSizes?: Array<{ resourceType: string; budget: number }>;
        resourceCounts?: Array<{ resourceType: string; budget: number }>;
      }>;
      // Allow arbitrary LHCI assert options
      [key: string]: unknown;
    };
    upload?: {
      target: string;
      outputDir: string;
      // Allow arbitrary LHCI upload options
      [key: string]: unknown;
    };
    // Allow other top-level LHCI keys (e.g. server)
    [key: string]: unknown;
  };
}

export function transformConfig(norm: NormRc): LighthouseRc {
  const { settings, budgets, routes } = norm;
  const baseUrl = settings.baseUrl.replace(/\/$/, "");

  // 1. Transform Routes
  const finalUrls: string[] = [];
  const routeSpecificBudgets: Array<{ path: string; budgetKey: string }> = [];

  for (const route of routes) {
    let urlPath: string;
    let budgetKey: string | undefined;

    if (typeof route === "string") {
      urlPath = route;
    } else {
      urlPath = route.path;
      budgetKey = route.budget;
    }

    // Resolve URL
    // If it's a full URL, keep it. Otherwise append to baseUrl.
    // Handling the case where route is just "/"
    const fullUrl = urlPath.startsWith("http")
      ? urlPath
      : `${baseUrl}${urlPath.startsWith("/") ? "" : "/"}${urlPath}`;

    finalUrls.push(fullUrl);

    if (budgetKey) {
      // Store the path relative to the site root for matching in LHCI budgets?
      // LHCI budgets 'path' property matches against the URL.
      // Usually it's a wildcard or exact match on the URL path.
      // We will use the urlPath (e.g. "/dashboard")
      routeSpecificBudgets.push({ path: urlPath, budgetKey });
    }
  }

  // 2. Transform Budgets
  const lhciBudgets: NonNullable<
    NonNullable<LighthouseRc["ci"]["assert"]>["budgets"]
  > = [];

  if (budgets) {
    // Helper to convert simple key-value timings to LHCI array format
    const toLhciTimings = (t: BudgetTimings) => {
      return Object.entries(t).map(([metric, budget]) => ({
        metric,
        budget: budget as number,
      }));
    };

    // Global budget
    if (budgets.global?.timings) {
      lhciBudgets.push({
        path: "*", // Applies to everything not more specifically matched
        timings: toLhciTimings(budgets.global.timings),
      });
    }

    // Route specific budgets
    for (const { path: routePath, budgetKey } of routeSpecificBudgets) {
      const budgetDef = budgets[budgetKey];
      if (budgetDef?.timings) {
        lhciBudgets.push({
          path: routePath, // e.g. "/dashboard"
          timings: toLhciTimings(budgetDef.timings),
        });
      } else {
        console.warn(
          `Warning: Route '${routePath}' references missing budget '${budgetKey}'`,
        );
      }
    }
  }

  // 3. Construct LHCI Config
  const rc: LighthouseRc = {
    ci: {
      collect: {
        url: finalUrls,
        numberOfRuns: settings.numberOfRuns || 3,
      },
      // Only include assert when we have budgets - LHCI fails with "No assertions to use" otherwise
      ...(lhciBudgets.length > 0 && {
        assert: {
          budgets: lhciBudgets,
        },
      }),
    },
  };

  return rc;
}
