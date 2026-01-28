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
      assertions?: Record<
        string,
        ["error" | "warn" | "off", { maxNumericValue: number }]
      >;
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

  // 2. Transform Budgets to LHCI Assertions format
  // Note: LHCI "budgets" only supports resource sizes/counts, NOT timing metrics
  // For timing metrics like LCP, CLS, etc., we must use "assertions" format
  const lhciAssertions: Record<
    string,
    ["error" | "warn", { maxNumericValue: number }]
  > = {};

  if (budgets?.global?.timings) {
    for (const [metric, value] of Object.entries(budgets.global.timings)) {
      if (value !== undefined) {
        lhciAssertions[metric] = ["warn", { maxNumericValue: value }];
      }
    }
  }

  // TODO: Route-specific budgets would need matchingUrlPattern in assertion config
  // For now, we only support global budgets for simplicity

  const hasAssertions = Object.keys(lhciAssertions).length > 0;

  // 3. Construct LHCI Config
  const rc: LighthouseRc = {
    ci: {
      collect: {
        url: finalUrls,
        numberOfRuns: settings.numberOfRuns || 3,
      },
      // Only include assert when we have assertions - LHCI fails with "No assertions to use" otherwise
      ...(hasAssertions && {
        assert: {
          assertions: lhciAssertions,
        },
      }),
    },
  };

  return rc;
}
