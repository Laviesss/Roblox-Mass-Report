# 📖 Roblox-Mass-Reporter Technical Documentation (v3.2)

Welcome to the comprehensive guide for the **Roblox-Mass-Reporter**. This document details the database-first architecture and unified command suite.

---

## 🏛️ System Architecture

### 1. Database-First Management (Interactive)
The suite has moved away from file-based account management. While it can still perform an initial import from `cookies.txt` or `CLOUDS_COOKIES`, the **MongoDB Database** is now the primary source of truth.
*   **Interactive Dashboard:** Use `/accounts` to manage your account pool via an interactive Discord UI.
*   **Security:** Cookies are stored safely in your MongoDB cluster and never logged.
*   **Persistence:** Accounts persist across all restarts and deployments.

### 2. The Auth-Wall Bypass (CSRF Interceptor)
Roblox requires an `X-CSRF-TOKEN` for sensitive requests. This suite uses an **Axios Interceptor**:
*   When a request fails with a `403 Forbidden` error, the suite automatically extracts the new token from the response headers and retries the request.

---

## ⌨️ Discord Command Guide

The suite features 9 integrated slash commands.

### Tactical & Management
*   **`/accounts`**: (NEW) Opens the **Account Management Dashboard**. From here, you can view health stats, filter account views, and click the **"Add New Account"** button to open a secure cookie input Modal.
*   **`/report [username] [amount] [category]`**: Resolves the target and adds them to the persistent report queue.
*   **`/terminate`**: Global Kill Switch. Aborts all active tasks and clears the queue.

### Intelligence Commands
*   **`/inventory_check [username]`**: Calculates the **Total RAP (Recent Average Price)** of a user's limited collectibles.
*   **`/scrape [username]`**: Fetches Account Age, Bio, and ID.
*   **`/check_target [username]`**: Rapid profile validation.

### System Commands
*   **`/status`**: System uptime, active tasks, and session counts.
*   **`/logs`**: Shows the last 10 successful activities from the DB.
*   **`/slowmode [seconds]`**: Adjusts engine loop delays.

---

## 🚀 Deployment & Usage

### 1. Setup
*   Clone the repo and run `npm install`.
*   Setup your `.env` file with your **MongoDB Atlas** URI.

### 2. Running
*   **Local:** `pm2 start ecosystem.config.js`
*   **Cloud (Render):** Connect your repo; it will detect `render.yaml`.

### 3. Populating Accounts
Instead of editing `cookies.txt`, simply run `/accounts` in Discord and click **"Add New Account"**. A modal will pop up allowing you to paste your cookie securely.

---
**Security:** Full credentials are never logged. The suite uses `Credential Masking` and ephemeral Discord responses to ensure absolute safety.
