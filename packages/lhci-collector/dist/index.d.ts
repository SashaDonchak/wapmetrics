import type { Manifest } from "@wapmetrics/schemas";
export type RunOptions = {
    baseUrl: string;
    routes?: string[];
    lhrcPath: string;
    outDir: string;
    budgets?: {
        lcp?: number;
        cls?: number;
        inp?: number;
    };
};
export declare function runLhci(opts: RunOptions): Promise<void>;
export declare function makeManifest(params: {
    routes: string[];
    budgets?: {
        lcp?: number;
        cls?: number;
        inp?: number;
    };
    owner?: string;
    repo?: string;
    pr?: number;
    sha?: string;
}): Manifest;
