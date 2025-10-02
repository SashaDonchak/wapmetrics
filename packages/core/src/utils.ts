import { spawn } from "node:child_process";
import crypto from "node:crypto";

export const hash = (s: string) =>
  crypto.createHash("sha1").update(s).digest("hex").slice(0, 12);

type Opts = Record<string, unknown>;

export function spawnp(
  cmd: string,
  args: string[],
  opts: Opts = {},
): Promise<number> {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { stdio: "inherit", ...opts });
    p.on("exit", (code) => resolve(code ?? 0));
  });
}

export const isTruthy = (v: unknown) =>
  v === true || v === "true" || v === 1 || v === "1";
