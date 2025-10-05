export type Severity = "info" | "low" | "medium" | "high" | "critical";

export interface Finding {
  id: string;
  plugin: string;
  severity: Severity;
  title: string;
  message: string;
  route?: string;
  file?: string;
  docsUrl?: string;
  tags?: string[];
  suggestion?: string;
  meta?: Record<string, unknown>;
}

export type PluginCapabilities = {
  needsBaseUrl?: boolean;
  needsStaticDir?: boolean;
  needsLocalServer?: boolean;
  parallelSafe?: boolean;
};

export interface PluginInit {
  name: string;
  version: string;
  capabilities: PluginCapabilities;
  defaults?: Record<string, unknown>;
}

export interface RunContext {
  baseUrl?: string;
  staticDistDir?: string;
  startCommand?: string;
  startReadyPattern?: string;
  cwd: string;
  tempDir: string;
  config: Record<string, unknown>;
  env: Record<string, string | undefined>;
  budgets?: { lcp?: number; cls?: number; inp?: number };
  github?: {
    token: string;
    owner: string;
    repo: string;
    pr: number;
    sha: string;
  };
}

export interface Plugin {
  init(): PluginInit;
  detect?(ctx: RunContext): Promise<boolean> | boolean;
  prepare?(ctx: RunContext): Promise<void>;
  run(ctx: RunContext): Promise<{ findings: Finding[]; artifacts?: string[] }>;
  summarize?(input: {
    findings: Finding[];
    artifacts?: string[];
  }): Promise<{ md?: string }>;
}

export type Registry = Record<string, () => Promise<{ default: Plugin }>>;
