# 📚 Technical Guide: Roblox-Mass-Reporter

This manual explains how the bot works, how it keeps you safe, and how to set it up perfectly.

---

## 🌐 1. The Proxy Detective System

The bot has a built-in "detective" that figures out how your proxies work so you don't have to.

### The Process
When you add proxies, the bot doesn't always know what type they are. It runs a "Waterfall" check to find out:
1.  **HTTP Check:** It first tries a basic web connection.
2.  **SOCKS5 Check:** If that fails, it tries SOCKS5.
3.  **SOCKS4 Check:** If both fail, it tries SOCKS4 as a last resort.
If all three fail, the bot marks the proxy as "Dead" so it doesn't waste your time.

### Adding Proxies
Use the `/proxies` command to upload your list.
*   **Smart Parser:** You can upload a `.txt` file or just paste the list. The bot uses a smart search to find the IP and Port even if there is extra text in the way.
*   **Cleanup:** Use the **[Check Proxies]** button to test every proxy for speed and type. Use **[Remove Dead]** to delete the ones that don't work.

---

## 🎭 2. User-Agents & Fingerprinting

Roblox tries to block bots by looking at their "fingerprint." We use browser strings (User-Agents) to make your accounts look like real people.

### Bulk Import
Use the `/useragents` command to add a list of browser strings. You can get these from any modern browser list online.

### Sticky Identity
This is the secret to staying hidden:
1.  **The Pair:** When you add a Roblox account, the bot gives it a random browser string from your list.
2.  **The Lock:** It saves that pair in the database forever.
3.  **The Result:** Every time that account works, it uses the **exact same** browser string. To Roblox, it looks like the account is always coming from the same device.

---

## 🛠️ 3. Setup: PC (Local) Deployment

For local setup, we use **PM2** (Process Manager 2). This ensures the bot stays running even if your computer restarts or the app crashes.

### Step 1: Installation
1.  **Install Node.js:** Download it from nodejs.org (get version 18 or newer).
2.  **Check Version:** Open your terminal and type `node -v` to make sure it worked.
3.  **Download project tools:**
    ```bash
    npm install
    ```
4.  **Install PM2 Globally:**
    ```bash
    npm install pm2 -g
    ```

### Step 2: Configuration
Create a file named `.env` in the main folder and fill it in:
```env
DISCORD_TOKEN=your_bot_token
CLIENT_ID=your_id
MONGODB_URI=your_mongo_link
```

### Step 3: Execution
Run these commands in order to start and save your bot:
```bash
# Start the bot using the config file
pm2 start ecosystem.config.js

# Save the list so it restarts on reboot
pm2 save

# (Optional) Setup PM2 to start when your PC turns on
pm2 startup
```

### Step 4: Management & Commands
Use these commands in your terminal to manage the bot:

| Command | What it does |
| :--- | :--- |
| `pm2 logs` | See exactly what the bot is doing right now. |
| `pm2 monit` | Open a dashboard to see CPU and RAM usage. |
| `pm2 status` | Check if the bot is online or has errors. |
| `pm2 stop Roblox-Mass-Reporter` | Turn the bot off. |
| `pm2 restart Roblox-Mass-Reporter` | Refresh the bot. |

### Step 5: Windows Users (Persistent Startup)
If you want the bot to start automatically when Windows boots:
1.  Open PowerShell as **Administrator**.
2.  Run: `npm install pm2-windows-startup -g`
3.  Run: `pm2-startup install`
4.  Run: `pm2 save`

---

## ☁️ 4. Setup: Cloud (Render.com)

1.  **The Blueprint:** The `render.yaml` file is already set to the **Free Tier**.
2.  **Connect:** Link your GitHub to Render and pick this project.
3.  **Environment:** Add these keys: `DISCORD_TOKEN`, `CLIENT_ID`, and `MONGODB_URI`.
4.  **Stay Awake:** Because it's free, Render will turn off the bot if it stays quiet.
    *   Go to **cron-job.org**.
    *   Make a job that visits your Render web link every 10 minutes. This keeps it running 24/7.

---

## 🕹️ 5. Command Technical Breakdown

### /report
- **ID Find:** Converts username to Roblox ID.
- **CSRF Handshake:** Grabs the security token.
- **Proxy/UA Injection:** Pairs the account with its "Sticky" identity and a fresh proxy.
- **Loop:** Runs reports with your selected delay.

### /accounts
- Pulls fleet status from MongoDB.
- Calculates [Ready], [On Break], or [Broken] in real-time.
- The **[Force Reset]** button manually clears all breaks.
