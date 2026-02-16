# 📖 Roblox-Mass-Reporter Technical Documentation

Welcome to the comprehensive guide for the **Roblox-Mass-Reporter (v3.0)**. This document explains the internal architecture, command functionality, and setup procedures for this industrial-grade suite.

---

## 🏛️ System Architecture

The suite is built on a **Hybrid Hosting Architecture**, meaning it can detect its environment and adjust its behavior accordingly.

### 1. The Persistence Layer (MongoDB)
Unlike traditional scripts that store data in memory, this suite uses **MongoDB Atlas**.
*   **Accounts:** Stores `.ROBLOSECURITY` cookies, identifying information, and cooldown status.
*   **Queue:** Stores pending report tasks. If the bot crashes or the server restarts, it resumes exactly where it left off.
*   **Reports:** A historical log of every successful action taken by the suite.

### 2. The Auth-Wall Bypass (CSRF Interceptor)
Roblox requires an `X-CSRF-TOKEN` for sensitive requests. This suite uses an **Axios Interceptor**:
*   When a request fails with a `403 Forbidden` error, the suite automatically extracts the new token from the response headers.
*   It then updates the internal headers and **immediately retries** the failed request. This happens silently in the background.

### 3. Rate Limit Mitigation (429 Handling)
When the suite detects a `429 Too Many Requests` response:
1.  It extracts the `Retry-After` header.
2.  It marks the specific account in the database as "Cooled Down" until a specific timestamp.
3.  The **Reporting Engine** then rotates to the next available account in your pool.

---

## ⌨️ Discord Command Guide

The suite features 9 integrated slash commands divided into three categories.

### Tactical Commands
*   **`/report [username] [amount] [category]`**: The primary entry point. Resolves the username to a UserID and adds them to the **Persistent Database Queue**.
*   **`/terminate`**: The **Emergency Kill Switch**. Uses `AbortController` to instantly kill every active reporting loop across the entire engine and clears the pending queue in the DB.

### Intelligence Commands
*   **`/inventory_check [username]`**: A specialized command that queries the Roblox Collectibles API. it calculates the **Total RAP (Recent Average Price)** of the user's limited items and returns the sum.
*   **`/scrape [username]`**: Fetches deep intelligence including Account Creation Date, Bio/Description, and exact UserID.
*   **`/check_target [username]`**: Performs a rapid profile validation check to ensure the target is still active/unbanned.

### System Commands
*   **`/accounts`**: Displays a real-time "Health Grid" of your account pool. Shows which accounts are active, which are in cooldown, and their authenticated usernames.
*   **`/status`**: Telemetry command. Shows system uptime, active task count, and total authenticated session count.
*   **`/logs`**: Queries the database for the last 10 successful activities, providing a snapshot of recent operations.
*   **`/slowmode [seconds]`**: Adjusts the internal engine loop delay (Simulated logic for fine-tuning throughput).

---

## ⚙️ Environment Configuration

The suite relies on a `.env` file for all sensitive configuration.

| Variable | Description |
| :--- | :--- |
| `MONGODB_URI` | Your MongoDB Atlas connection string. **Crucial for persistence.** |
| `DISCORD_TOKEN` | Your Discord Bot token from the Developer Portal. |
| `CLIENT_ID` | Your Discord Bot Application ID. |
| `RENDER` | Set to `true` if deploying on Render.com Cloud. |
| `CLOUDS_COOKIES` | (Cloud Only) A comma or newline separated list of cookies. |

---

## 🚀 Deployment Guide

### Local Deployment (PM2)
Best for running on your local machine (HP Laptop, etc.) with a `cookies.txt` file.
1.  Run `npm install`.
2.  Start with `pm2 start ecosystem.config.js`.
3.  Use `pm2 logs Roblox-Mass-Reporter` to monitor performance.

### Cloud Deployment (Render)
Best for 24/7 uptime without keeping your PC on.
1.  Connect your repo to Render.com.
2.  Render will auto-provision the Web Service using `render.yaml`.
3.  Add your secrets in the Render "Environment" dashboard.

---

**Security Check:** This suite uses **Credential Masking**. The full `.ROBLOSECURITY` cookie is never logged to the console or the Discord channel. Only Usernames and IDs are used for identification.
