# 🤖 RMR | Roblox Mass Reporter

**RMR (Roblox Mass Reporter)** is a modernized, professional-grade takedown tool built for Node.js. It features advanced stealth capabilities, a deep-scraping engine, and a persistent background worker.

## 🚀 Key Features
- **Modern Node.js V18+:** Fast, asynchronous, and reliable.
- **V2 Abuse API:** Uses the latest Roblox reporting endpoints.
- **Deep Scraper:** Automatically finds and reports all linked assets/games for a target.
- **Stealth Suite:** Proxy Waterfalling (HTTP/SOCKS) and Sticky User-Agents.
- **Persistence:** MongoDB Atlas integration for persistent queues and fleet management.
- **Hybrid Hosting:** Ready for Render (Cloud) or PM2 (Local PC).

## 🛠️ Quick Start (Local PC)

### 1. Requirements
- **Node.js v18** or higher.
- **MongoDB Atlas** (Free Tier is fine).
- **Discord Bot Token**.

### 2. Setup
1. Clone this repository.
2. Install dependencies:
   ```bash
   npm install
   npm install pm2 -g
   ```
3. Create a `.env` file based on the environment variables needed (see Documentation).

### 3. Launch with PM2
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## 📊 Management
- `pm2 logs`: View real-time logs.
- `pm2 monit`: Monitor CPU/Memory.
- `/report`: Launch the takedown wizard in Discord.

---
*Disclaimer: This tool is for educational purposes only.*
