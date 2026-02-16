# Roblox-Mass-Reporter (v3.0) - Fatal Error Mitigation Build

A professional, industrial-grade Node.js suite for Roblox automation. Designed to bypass Auth Walls, handle Rate Limits gracefully, and manage distributed task queues.

## 🛠️ Logic Architecture

1.  **Auth Wall Fix (CSRF Interceptor):** Automated 403-retry logic in `src/core/robloxClient.js`.
2.  **Ghost Queue Fix (Database Persistence):** MongoDB Atlas integration for persistent target management.
3.  **Rate Limit Blindness (429 Handling):** Per-account cooldown DB flagging with automatic rotation.
4.  **Payload Modernization (V2 API):** Full support for modern JSON-based abuse reporting.
5.  **Kill Switch:** Integrated `AbortController` linked to the `/terminate` command.

## ⌨️ Command Suite

- `/report`: Unified mass report entry.
- `/inventory_check`: Calculates total RAP from Collectibles API.
- `/terminate`: Immediate global abort of all active loops.
- `/status`: Real-time system health telemetry.
- `/accounts`: Health grid of active/cooled-down sessions.
- `/scrape`: Targeted user intelligence.
- `/logs`: Database activity history.
- `/slowmode`: Real-time delay adjustment.
- `/check_target`: Profile validation.

## 🚀 Deployment

- **Cloud:** Render.com (Detects `render.yaml`).
- **Local:** PM2 (`pm2 start ecosystem.config.js`).

---
**Security:** Full credentials are never logged. Sessions are authenticated via API before pool entry.
