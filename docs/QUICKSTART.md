# Quickstart — LHCI Collector (public)

This repo contains the **open-source collector** and a **GitHub Action** that:
- runs Lighthouse CI (LHCI) against your app,
- writes slim JSON artifacts,
- packages them into a single `wapmetrics-run.tgz`.

## Minimal usage
1) Your app must run in CI, e.g. `http://127.0.0.1:3000`.
2) Add `.lighthouserc.json` with `$BASE_URL` placeholders (example in this repo).
3) Add a workflow that:
   - builds & starts your app,
   - runs the action:

```yaml
- uses: your-org/wapmetrics-collector-action@v1
  with:
    base-url: http://127.0.0.1:3000
    routes: "/,/pricing"
    lhrc-path: .lighthouserc.json
    budgets: '{"lcp":2500,"cls":0.1,"inp":200}'
```


