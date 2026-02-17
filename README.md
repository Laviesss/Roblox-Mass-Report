# 🤖 Roblox-Mass-Reporter - Easy Setup Guide

This tool helps you manage multiple Roblox accounts and report users who break the rules. It runs on your computer and is controlled through Discord.

## 📋 What you need before starting

*   **Node.js:** (Version 18 or newer) - This runs the code.
*   **MongoDB Atlas:** A free online database to save your accounts and reports.
*   **Discord Bot:** You'll need to create a bot on the Discord Developer Portal.

---

## 🚀 Step 1: Install it

Open your terminal (like Command Prompt or PowerShell) in this folder and type:

```bash
# Install the project files
npm install

# Install PM2 (This keeps the bot running even if it crashes)
npm install pm2 -g
```

---

## ⚙️ Step 2: Set it up

1.  Find the file named `.env.example`.
2.  Make a copy of it and name the new file `.env`.
3.  Open the `.env` file and fill in your info:

```env
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_bot_client_id_here
MONGODB_URI=your_mongodb_link_here
PORT=3000
```

---

## ⚡ Step 3: Start the Bot

To start the bot and keep it running in the background, type:

```bash
# Start the bot
pm2 start ecosystem.config.js

# Make sure it starts automatically if your computer restarts
pm2 save
pm2 startup
```

---

## 🛠️ How to manage the bot

Use these simple commands in your terminal:

*   `pm2 logs` — See what the bot is doing right now (and check for errors).
*   `pm2 status` — See if the bot is online.
*   `pm2 stop Roblox-Mass-Reporter` — Turn the bot off.
*   `pm2 restart Roblox-Mass-Reporter` — Restart the bot.

---

## 🎮 Discord Commands

Once the bot is online, use these in Discord:

*   `/report` — Start the multi-step setup to report someone. You'll pick a target, a reason, a delay, and which accounts to use.
*   `/reports` — See how the bot is performing and check recent history.
*   `/accounts` — Add or manage your Roblox accounts.
*   `/terminate` — Stop everything immediately if something goes wrong.

---

## 🪟 Note for Windows Users

If you want the bot to start by itself when you turn on your PC:
1. Open PowerShell as Administrator.
2. Type: `npm install pm2-windows-startup -g`
3. Type: `pm2-startup install`
4. Type: `pm2 save`
