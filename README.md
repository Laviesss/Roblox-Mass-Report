# Roblox Management Suite (v2.0)

A comprehensive, hybrid-hosted multi-account system for Roblox automation and mass reporting. **100% Node.js Architecture.**

## 🚀 Key Features

- **Hybrid Hosting:** Seamlessly switch between Local PC (PM2) and Render Cloud.
- **Persistence:** MongoDB Atlas integration for reporting history and target queue.
- **2026-Ready Auth:** Automated CSRF token handling with Axios interceptors.
- **Discord Integration:** 9 tactical and intelligence slash commands.
- **Web Dashboard:** Real-time UI with Socket.io updates and activity graphs.

## 🛠️ Architecture

- **Entry Point:** `src/server.js`
- **Core Engine:** `src/core/reportingEngine.js`
- **Database Layer:** Mongoose (MongoDB)
- **Frontend:** HTML5, Socket.io, Chart.js

## 📦 Setup & Installation

### Local PC (PM2)
1. Install MongoDB locally.
2. Run `npm install`.
3. Configure `.env` and `cookies.txt`.
4. Start via PM2:
   ```bash
   pm2 start ecosystem.config.js
   ```

### Render Cloud
1. Connect GitHub repo to Render.
2. The `render.yaml` blueprint will provision the Web Service.
3. Configure Environment Secrets in Render Dashboard:
   - `MONGODB_URI`
   - `DISCORD_TOKEN`
   - `CLIENT_ID`
   - `CLOUDS_COOKIES`

## ⌨️ Discord Commands

- `/report`: Add target to mass report queue.
- `/status`: System uptime and account health.
- `/terminate`: Immediate abort of all tasks.
- `/accounts`: Health grid of active sessions.
- `/logs`: Database activity history.
- `/scrape`: Fetch intelligence on target user.
- `/slowmode`: Adjust reporting delay.
- `/inventory_check`: Collectibles check.
- `/check_target`: Profile status check.

---

**Security Notice:** `cookies.txt` and `.env` are automatically ignored by Git. Never share your `.ROBLOSECURITY` cookies.
