# Norm — Web app Performance Monitoring

## Configuration (`normrc.json`)

Norm uses a `normrc.json` file to configure your Lighthouse runs.

### Examples

#### Minimal Configuration

```json
{
  "settings": {
    "baseUrl": "http://localhost:3000"
  },
  "routes": ["/"]
}
```

#### Full Configuration

```json
{
  "settings": {
    "baseUrl": "http://localhost:3000",
    "numberOfRuns": 5
  },
  "budgets": {
    "global": {
      "timings": {
        "largest-contentful-paint": 2500,
        "cumulative-layout-shift": 0.1
      }
    },
    "strict-performance": {
      "timings": {
        "largest-contentful-paint": 1000,
        "total-blocking-time": 200
      }
    }
  },
  "routes": [
    "/",
    "/about",
    {
      "path": "/dashboard",
      "budget": "strict-performance"
    }
  ]
}
```
