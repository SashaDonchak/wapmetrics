export type Manifest = {
    version: 1;
    owner?: string;
    repo?: string;
    pr?: number;
    sha?: string;
    routes: string[];
    env?: {
        preset?: string;
        chromium?: string;
    };
    collectors: {
        lhci: boolean;
    };
    budgets?: {
        lcp?: number;
        cls?: number;
        inp?: number;
    };
    createdAt: string;
};
export type LhciSummaryItem = {
    url: string;
    lcp?: number;
    cls?: number;
    inp?: number;
};
export type BundleLayout = {
    manifest: Manifest;
    lhci: {
        summary: LhciSummaryItem[];
    };
};
export declare const ManifestSchema: {
    readonly $id: "https://schemas.aiwf.dev/manifest.schema.json";
    readonly type: "object";
    readonly additionalProperties: false;
    readonly required: readonly ["version", "routes", "collectors", "createdAt"];
    readonly properties: {
        readonly version: {
            readonly const: 1;
        };
        readonly owner: {
            readonly type: "string";
        };
        readonly repo: {
            readonly type: "string";
        };
        readonly pr: {
            readonly type: "number";
        };
        readonly sha: {
            readonly type: "string";
        };
        readonly routes: {
            readonly type: "array";
            readonly items: {
                readonly type: "string";
            };
            readonly minItems: 1;
        };
        readonly env: {
            readonly type: "object";
            readonly additionalProperties: true;
            readonly properties: {
                readonly preset: {
                    readonly type: "string";
                };
                readonly chromium: {
                    readonly type: "string";
                };
            };
        };
        readonly collectors: {
            readonly type: "object";
            readonly additionalProperties: false;
            readonly required: readonly ["lhci"];
            readonly properties: {
                readonly lhci: {
                    readonly type: "boolean";
                };
            };
        };
        readonly budgets: {
            readonly type: "object";
            readonly additionalProperties: false;
            readonly properties: {
                readonly lcp: {
                    readonly type: "number";
                };
                readonly cls: {
                    readonly type: "number";
                };
                readonly inp: {
                    readonly type: "number";
                };
            };
        };
        readonly createdAt: {
            readonly type: "string";
        };
    };
};
export declare const LhciSummarySchema: {
    readonly $id: "https://schemas.aiwf.dev/lhci-summary.schema.json";
    readonly type: "object";
    readonly additionalProperties: false;
    readonly required: readonly ["summaries"];
    readonly properties: {
        readonly summaries: {
            readonly type: "array";
            readonly items: {
                readonly type: "object";
                readonly additionalProperties: false;
                readonly required: readonly ["url"];
                readonly properties: {
                    readonly url: {
                        readonly type: "string";
                    };
                    readonly lcp: {
                        readonly type: "number";
                    };
                    readonly cls: {
                        readonly type: "number";
                    };
                    readonly inp: {
                        readonly type: "number";
                    };
                };
            };
        };
        readonly budgets: {
            readonly type: "object";
            readonly additionalProperties: false;
            readonly properties: {
                readonly lcp: {
                    readonly type: "number";
                };
                readonly cls: {
                    readonly type: "number";
                };
                readonly inp: {
                    readonly type: "number";
                };
            };
        };
    };
};
