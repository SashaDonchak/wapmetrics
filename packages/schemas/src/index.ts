export type Manifest = {
  version: 1;
  owner?: string;
  repo?: string;
  pr?: number;
  sha?: string;
  routes: string[];
  env?: { preset?: string; chromium?: string };
  collectors: { lhci: boolean };
  budgets?: { lcp?: number; cls?: number; inp?: number };
  createdAt: string;
};

export type LhciSummaryItem = {
  url: string;
  lcp?: number;
  cls?: number;
  inp?: number;
  tbt?: number;
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
  required: ["version", "routes", "collectors", "createdAt"],
  properties: {
    version: { const: 1 },
    owner: { type: "string" },
    repo: { type: "string" },
    pr: { type: "number" },
    sha: { type: "string" },
    routes: { type: "array", items: { type: "string" }, minItems: 1 },
    env: {
      type: "object",
      additionalProperties: true,
      properties: {
        preset: { type: "string" },
        chromium: { type: "string" },
      },
    },
    collectors: {
      type: "object",
      additionalProperties: false,
      required: ["lhci"],
      properties: { lhci: { type: "boolean" } },
    },
    budgets: {
      type: "object",
      additionalProperties: false,
      properties: {
        lcp: { type: "number" },
        cls: { type: "number" },
        inp: { type: "number" },
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

