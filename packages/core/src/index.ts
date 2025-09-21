export type Severity = "info" | "low" | "medium" | "high" | "critical";
export type Tool = "lighthouse" | "axe" | "bundle" | "cwv" | "security" | "custom";
export interface Finding {
  id: string;
  tool: Tool;
  severity: Severity;
  title: string;
  message: string;
  file?: string;
  startLine?: number;
  endLine?: number;
  docsUrl?: string;
  tags?: string[];
  suggestion?: string;
  meta?: Record<string, unknown>;
}
export const hash = (s: string) =>
  crypto.createHash("sha1").update(s).digest("hex").slice(0, 12);
import crypto from "node:crypto";
