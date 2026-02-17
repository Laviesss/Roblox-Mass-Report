# 🤖 Roblox-Mass-Reporter - Easy Guide

This tool lets you use multiple Roblox accounts to report people who break the rules. It works on your computer and you control it through Discord.

## 📋 What you need first

*   **Node.js:** (Version 18 or newer) - You need this to run the code.
*   **MongoDB Atlas:** A free online database to save your accounts and history.
*   **Discord Bot:** You need to create a bot on the Discord Developer Portal.

---

## 🚀 Step 1: Install it

Open your terminal (like Command Prompt or PowerShell) in this folder and type:

```bash
# Download the project files
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

To start the bot and keep it running even if you close the window, type:

```bash
# Start the bot
pm2 start ecosystem.config.js

# Make sure it starts automatically if your computer restarts
pm2 save
pm2 startup
```

---

## 🛠️ How to manage the bot

Use these simple words in your terminal:

*   `pm2 logs` — See exactly what the bot is doing (and see if there are errors).
*   `pm2 status` — See if the bot is online or offline.
*   `pm2 stop Roblox-Mass-Reporter` — Turn the bot off.
*   `pm2 restart Roblox-Mass-Reporter` — Refresh the bot.

---

## 🎮 Commands you can use in Discord

*   `/report` — Start the step-by-step wizard to report someone. It will ask for the target, the reason, the speed, and which accounts to use.
*   `/accounts` — See your fleet of accounts. You can see who is ready, who is on break, and who is broken. You can also add new accounts here.
*   `/reports` — See a history of the last 20 reports and check for failures.
*   `/terminate` — Stop everything immediately if you need to.

---

## 🪟 If you use Windows

If you want the bot to start automatically when you turn on your PC:
1. Open PowerShell as an Administrator.
2. Type: `npm install pm2-windows-startup -g`
3. Type: `pm2-startup install`
4. Type: `pm2 save`
