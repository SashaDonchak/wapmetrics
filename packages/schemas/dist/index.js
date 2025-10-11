export const ManifestSchema = {
    $id: "https://schemas.aiwf.dev/manifest.schema.json",
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
};
export const LhciSummarySchema = {
    $id: "https://schemas.aiwf.dev/lhci-summary.schema.json",
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
                },
            },
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
    },
};
