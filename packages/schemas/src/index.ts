export type RouteConfig = string | { path: string; budget?: string };

export type BudgetConfig = {
  lcp?: number;
  cls?: number;
  inp?: number;
  tbt?: number;
};

export type Manifest = {
  version: 1;
  owner?: string;
  repo?: string;
  pr?: number;
  sha?: string;
  plugins: {
    lhci?: {
      baseUrl: string;
      numberOfRuns?: number;
      routes: RouteConfig[];
      budgets?: Record<string, BudgetConfig>;
    };
  };
  createdAt: string;
};

export type LhciSummaryItem = {
  url: string;
  lcp?: number;
  cls?: number;
  inp?: number;
  tbt?: number;
  htmlReportPath?: string;
};

export type BundleLayout = {
  manifest: Manifest;
  lhci: {
    summary: LhciSummaryItem[];
  };
};

export const ManifestSchema = {
  $id: "https://schemas.wapmetrics.dev/manifest.schema.json",
  type: "object",
  additionalProperties: false,
  required: ["version", "plugins", "createdAt"],
  properties: {
    version: { const: 1 },
    owner: { type: "string" },
    repo: { type: "string" },
    pr: { type: "number" },
    sha: { type: "string" },
    plugins: {
      type: "object",
      additionalProperties: true,
      properties: {
        lhci: {
          type: "object",
          additionalProperties: false,
          required: ["baseUrl", "routes"],
          properties: {
            baseUrl: { type: "string" },
            numberOfRuns: { type: "number" },
            routes: {
              type: "array",
              minItems: 1,
              items: {
                oneOf: [
                  { type: "string" },
                  {
                    type: "object",
                    required: ["path"],
                    properties: {
                      path: { type: "string" },
                      budget: { type: "string" },
                    },
                  },
                ],
              },
            },
            budgets: {
              type: "object",
              additionalProperties: {
                type: "object",
                properties: {
                  lcp: { type: "number" },
                  cls: { type: "number" },
                  inp: { type: "number" },
                  tbt: { type: "number" },
                },
              },
            },
          },
        },
      },
    },
    createdAt: { type: "string" },
  },
} as const;

export const LhciSummarySchema = {
  $id: "https://schemas.wapmetrics.dev/lhci-summary.schema.json",
  type: "object",
  additionalProperties: false,
  required: ["summaries"],
  properties: {
    summaries: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["url"],
        properties: {
          url: { type: "string" },
          lcp: { type: "number" },
          cls: { type: "number" },
          inp: { type: "number" },
          tbt: { type: "number" },
          htmlReportPath: { type: "string" },
        },
      },
    },
  },
} as const;

export type IngestRequest = {
  owner: string;
  repo: string;
  pr?: number | string;
  sha: string;
};
