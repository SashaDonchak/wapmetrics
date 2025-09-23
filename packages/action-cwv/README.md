# Core Web Vitals (LHCI) — Action

Runs Lighthouse CI using your repo's `.lighthouserc.json`, then posts a sticky PR comment + a check.

## Inputs
- `github-token` **required**
- `lhrc-path` defaults to `.lighthouserc.json`
- One of:
  - `preview-url` (preferred)
  - `static-dist-dir`
  - `start-command` (+ `ready-pattern`)

Optional: `routes` to override URLs in rc (comma-separated paths).

## Modes
1. **External preview**: set `preview-url` (e.g., Vercel/Netlify PR URL)
2. **Static**: set `static-dist-dir` (LHCI will serve it)
3. **Local**: set `start-command`/`ready-pattern` (LHCI will start the server)

## Output
- Sticky PR comment (updates on new commits)
- "Core Web Vitals" Check (success/failure)
- LHCI JSON/HTML artifacts (if workflow uploads them)
