---
'ai.matey.http.core': minor
'ai.matey.http': minor
---

Production HTTP endpoints: built-in `/health` + `/health/ready` + `/health/live`, Prometheus
`/metrics`, OpenAI-compatible `/v1/embeddings`, per-route rate limits via `RouteConfig.rateLimit`,
and a zero-dependency WebSocket streaming subpath (`ai.matey.http/websocket`).
