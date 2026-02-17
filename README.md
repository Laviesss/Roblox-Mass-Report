# 🤖 Roblox-Mass-Reporter - Easy Guide

This tool lets you use multiple Roblox accounts to report people who break the rules. It works on your computer or in the cloud, and you control it through Discord.

## 📋 What you need first

*   **Node.js:** (Version 18 or newer) - You need this to run the code.
*   **MongoDB Atlas:** A free online database to save your accounts and history.
*   **Discord Bot:** You need to create a bot on the Discord Developer Portal.

---

## 🚀 Option 1: Run it on your PC (Local)

Open your terminal (like Command Prompt or PowerShell) in this folder and type:

### 1. Install it
```bash
# Download the project files
npm install

# Install PM2 (This keeps the bot running even if it crashes)
npm install pm2 -g
```

### 2. Set it up
1.  Find the file named `.env.example`.
2.  Make a copy of it and name the new file `.env`.
3.  Open the `.env` file and fill in your info:
    *   `DISCORD_TOKEN`: Your bot token.
    *   `CLIENT_ID`: Your bot's client ID.
    *   `MONGODB_URI`: Your MongoDB link.

### 3. Start it
```bash
# Start the bot
pm2 start ecosystem.config.js

# Make sure it starts automatically if your computer restarts
pm2 save
pm2 startup
```

---

## ☁️ Option 2: Run it in the Cloud (Render.com)

If you want the bot to run 24/7 without keeping your PC on, follow these steps:

1.  **Upload to GitHub:** Put your bot code into a private repository on GitHub.
2.  **Connect to Render:** Log in to [Render.com](https://render.com) and click **"New +"** then **"Blueprint"**.
3.  **Link Repo:** Select your GitHub repository.
4.  **Add Secrets:** In the Render dashboard, go to the **"Environment"** tab and add these variables:
    *   `DISCORD_TOKEN`: Your bot token.
    *   `CLIENT_ID`: Your bot's client ID.
    *   `MONGODB_URI`: Your MongoDB connection string.
5.  **Deploy:** Click **"Apply"**. Render will use the `render.yaml` file to set everything up automatically!

---

## 🛠️ How to manage the bot (Local PC)

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
