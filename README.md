# 🤖 Roblox-Mass-Reporter (v3.1)

[![Deployment: Render](https://img.shields.io/badge/Deployment-Render-00b3b0?style=for-the-badge&logo=render)](https://render.com)
[![Persistence: MongoDB](https://img.shields.io/badge/Persistence-MongoDB-47A248?style=for-the-badge&logo=mongodb)](https://www.mongodb.com/)
[![Runtime: Node.js](https://img.shields.io/badge/Runtime-Node.js-339933?style=for-the-badge&logo=node.js)](https://nodejs.org/)

**Roblox-Mass-Reporter** is a professional, industrial-grade automation suite. Now updated to support **Database-First Account Management**, removing the need for local cookie files.

---

## 🚀 Quick Start (Local Deployment)

1.  **Install Dependencies:**
    ```bash
    npm install
    ```
2.  **Configure Environment:**
    Create a `.env` file with `MONGODB_URI`, `DISCORD_TOKEN`, and `CLIENT_ID`.
3.  **Start the Suite:**
    ```bash
    pm2 start ecosystem.config.js
    ```
4.  **Add Accounts:**
    Use the Discord slash command: `/add_account [cookie]` to link your accounts directly to the database.

---

## 🛠️ Core Capabilities

*   **DB-First Management:** Accounts are stored in MongoDB. No more `cookies.txt` required.
*   **Auth-Wall Bypass:** Automated 2026-Ready CSRF token refreshing.
*   **Intelligent Rate Limiting:** 429 detection with per-account database cooldowns.
*   **Hybrid Hosting:** Seamless transition between Local PC and Render Cloud.

---

## 📚 Documentation

For a full breakdown of all **10 Discord Commands** and setup guides, refer to:

👉 **[View Full Documentation (DOCUMENTATION.md)](./DOCUMENTATION.md)**
