# 🤖 Roblox-Mass-Reporter (v3.0)

[![Deployment: Render](https://img.shields.io/badge/Deployment-Render-00b3b0?style=for-the-badge&logo=render)](https://render.com)
[![Persistence: MongoDB](https://img.shields.io/badge/Persistence-MongoDB-47A248?style=for-the-badge&logo=mongodb)](https://www.mongodb.com/)
[![Runtime: Node.js](https://img.shields.io/badge/Runtime-Node.js-339933?style=for-the-badge&logo=node.js)](https://nodejs.org/)

**Roblox-Mass-Reporter** is a professional, industrial-grade automation suite designed for multi-account management and intelligent task execution. Built with a "Fatal Error Mitigation" philosophy, it bypasses traditional automation walls using advanced interceptors and persistent database queueing.

---

## 🚀 Quick Start (Local Deployment)

To run the bot locally on your PC (e.g., HP Laptop) with persistent management:

1.  **Install Dependencies:**
    ```bash
    npm install
    ```
2.  **Configure Environment:**
    Create a `.env` file and fill in your `MONGODB_URI` (Atlas), `DISCORD_TOKEN`, and `CLIENT_ID`.
3.  **Start via PM2:**
    ```bash
    pm2 start ecosystem.config.js
    ```
4.  **Monitor Status:**
    ```bash
    pm2 logs Roblox-Mass-Reporter
    ```

---

## 🛠️ Core Capabilities

*   **Auth-Wall Bypass:** Automated 2026-Ready CSRF token refreshing.
*   **Intelligent Rate Limiting:** 429 detection with per-account database cooldowns.
*   **Hybrid Hosting:** Seamless transition between Local PC and Render Cloud.
*   **Persistence Layer:** MongoDB Atlas backed target queue—never lose a task on restart.
*   **V2 API Support:** Full integration with the modern Roblox Abuse Reporting protocol.

---

## 📚 Documentation

For a full breakdown of all **9 Discord Commands**, internal logic, security features, and advanced setup guides, please refer to:

👉 **[View Full Documentation (DOCUMENTATION.md)](./DOCUMENTATION.md)**

---

**Disclaimer:** This tool is for educational purposes only. Users are responsible for complying with the Terms of Service of any platforms accessed.
