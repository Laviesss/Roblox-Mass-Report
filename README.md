# 🤖 Roblox-Mass-Reporter - Local PC Deployment Guide

This guide provides a streamlined setup for running the modernized Node.js Roblox-Mass-Reporter on a local PC using **PM2** (Process Manager 2) for persistence and management.

## 📋 Prerequisites

*   **Node.js:** v18.0.0 or higher is required.
*   **MongoDB Atlas:** A valid MongoDB URI for data persistence.
*   **Discord Developer Account:** For bot token and client ID.

---

## 🚀 Step 1: Installation

Open your terminal in the project root directory and run the following commands:

```bash
# Install project dependencies
npm install

# Install PM2 globally (requires admin/sudo if not using NVM)
npm install pm2 -g
```

---

## ⚙️ Step 2: Configuration

1.  Locate the `.env.example` file in the root directory.
2.  Create a new file named `.env` and copy the contents from `.env.example`.
3.  Fill in the required environment variables:

```env
DISCORD_TOKEN=your_discord_bot_token_here
CLIENT_ID=your_discord_client_id_here
MONGODB_URI=your_mongodb_atlas_uri_here
PORT=3000
```

*Note: Do NOT share your `.env` file or commit it to version control. It contains sensitive credentials.*

---

## ⚡ Step 3: Execution

Launch the bot using the pre-configured PM2 ecosystem file. This ensures the bot runs in the background and auto-restarts on failure.

```bash
# Start the bot
pm2 start ecosystem.config.js

# Save the process list to restart on reboot
pm2 save

# (Optional) Generate startup script to start PM2 on system boot
pm2 startup
```

---

## 🛠️ Step 4: Management

Use these single-word terminal commands to monitor and manage your bot:

| Command | Description |
| :--- | :--- |
| `pm2 logs` | View real-time application logs and errors. |
| `pm2 monit` | Open an interactive dashboard to monitor CPU/Memory. |
| `pm2 status` | Check if the bot is online, stopped, or erroring. |
| `pm2 stop Roblox-Mass-Reporter` | Stop the bot execution. |
| `pm2 restart Roblox-Mass-Reporter` | Restart the bot. |

---

## 🪟 Windows Users: Persistent Startup

If you want the bot to automatically start after your PC reboots, follow these steps on Windows:

1.  Open PowerShell as Administrator.
2.  Install the windows startup helper:
    ```bash
    npm install pm2-windows-startup -g
    pm2-startup install
    ```
3.  After starting the bot with `pm2 start ecosystem.config.js`, run:
    ```bash
    pm2 save
    ```

---

## 📚 Features & Usage

*   **Interactive /accounts:** Add your `.ROBLOSECURITY` cookies securely via Discord Modals.
*   **Advanced Scraper:** Use `/scrape` to gather rich intelligence on targets.
*   **Mass Reporting:** Execute high-performance reports via `/report` with automated CSRF handling.
*   **Real-time Dashboard:** Monitor activity via the built-in web interface (default: `http://localhost:3000`).

For detailed command usage and technical specifications, refer to `DOCUMENTATION.md`.
