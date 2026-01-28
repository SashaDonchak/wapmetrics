# @wapmetrics/config

Configuration schemas and utilities for WAPMetrics.

## Usage

This package provides the schema and transformation logic for `normrc.json` configuration files.

### Configuration Examples

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

Includes device settings, global budgets, and route-specific budget overrides.

```json
{
  "settings": {
    "baseUrl": "http://localhost:3000",
    "device": "desktop",
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
