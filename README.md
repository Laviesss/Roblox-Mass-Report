# 🤖 Roblox-Mass-Reporter (v3.2) - Atlas Interactive Build

[![Deployment: Render](https://img.shields.io/badge/Deployment-Render-00b3b0?style=for-the-badge&logo=render)](https://render.com)
[![Persistence: MongoDB](https://img.shields.io/badge/Persistence-MongoDB-47A248?style=for-the-badge&logo=mongodb)](https://www.mongodb.com/)
[![Runtime: Node.js](https://img.shields.io/badge/Runtime-Node.js-339933?style=for-the-badge&logo=node.js)](https://nodejs.org/)

**Roblox-Mass-Reporter** is a professional-grade automation suite designed for high-performance multi-account management. This build introduces a fully **Cloud-First Atlas Architecture**, replacing local cookie files with an interactive, secure Discord-based management system.

---

## 🚀 Deployment Options

### Option A: Local Deployment (PC/Server)
Ideal for running on your own hardware using **PM2** for persistence.

1.  **Install Runtimes:** Ensure you have Node.js v18+ and MongoDB Atlas URI ready.
2.  **Clone & Install:**
    ```bash
    npm install
    ```
3.  **Configure Environment:**
    Create a `.env` file with your `MONGODB_URI`, `DISCORD_TOKEN`, and `CLIENT_ID`.
4.  **Start via PM2:**
    ```bash
    pm2 start ecosystem.config.js
    ```
5.  **Initialize Accounts:** Use `/accounts` in Discord to add your sessions securely.

### Option B: Cloud Deployment (Render.com)
The most stable option for 24/7 persistent automation.

1.  **Connect Repo:** Link your repository to **Render**.
2.  **Blueprint Detection:** Render will automatically detect the `render.yaml` file.
3.  **Secrets:** Provide your `.env` variables in the Render "Environment" dashboard.
4.  **Deploy:** Click **Deploy Blueprint**. The system handles port binding and initialization automatically.

---

## 🛠️ Key Industrial Features

*   **Interactive Dashboard:** Manage your account pool via `/accounts` with real-time health stats and filters.
*   **Secure Modal Workflow:** Add accounts via a private Discord Modal window—zero local file IO.
*   **Auth-Wall Fix:** Axios interceptor for automated **2026-Ready CSRF** retries.
*   **429 Mitigation:** Intelligent account rotation with database-driven cooldown timestamps.
*   **Persistent Queue:** Tasks are stored in MongoDB; restarts or crashes never lose progress.
*   **Emergency Kill Switch:** Global `/terminate` linked to `AbortController` signals.

---

## 📚 Technical Manual

For exhaustive details on the **9 Discord Commands**, internal API logic, and security protocols, refer to:

👉 **[View Full Documentation (DOCUMENTATION.md)](./DOCUMENTATION.md)**

---
**Disclaimer:** This tool is for educational purposes only. Users are responsible for complying with the Terms of Service of any platforms accessed.
