# 📚 Technical Guide: Roblox-Mass-Reporter

This manual explains how the bot works, how it keeps you safe, and how to set it up.

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
3.  **The Result:** Every time that account works, it uses the **exact same** browser string. To Roblox, it looks like the account is always coming from the same device (like a specific version of Chrome on a Windows PC). This stops them from flagging you as a bot.

---

## 🛠️ 3. How to Set It Up

### A. Run it on your PC (Local)
1.  **Install Node.js:** Download it from nodejs.org (get version 18 or newer). Open your terminal and type `node -v` to make sure it worked.
2.  **The .env file:** Create a file named `.env` in the main folder. Put your keys in it like this:
    ```env
    DISCORD_TOKEN=your_bot_token
    CLIENT_ID=your_id
    MONGODB_URI=your_mongo_link
    ```
3.  **The Commands:**
    *   Type `npm install` to get the files ready.
    *   Type `node src/server.js` to start the bot.

### B. Run it in the Cloud (Render.com)
1.  **The Blueprint:** The `render.yaml` file is already set to the **Free Tier**. You don't need to touch it.
2.  **Connect:** Link your GitHub to Render and pick this project.
3.  **Environment:** On the Render dashboard, go to "Environment" and add these keys: `DISCORD_TOKEN`, `CLIENT_ID`, and `MONGODB_URI`.
4.  **Stay Awake:** Because it's free, Render will turn off the bot if it stays quiet.
    *   Go to **cron-job.org**.
    *   Make a job that visits your Render web link every 10 minutes. This keeps it running 24/7.

---

## 🕹️ 4. Command Breakdown

### /report
- It finds the person's ID.
- It gets the security token from Roblox.
- It picks a working proxy from your list.
- It uses the "Sticky" browser string for that account.
- It runs the reports one by one with the delay you picked.

### /accounts
- It shows every account you have saved.
- It checks if they are Ready, on Cooldown, or Broken.
- The **[Force Reset]** button clears all breaks so you can start again immediately.

### /upload_accounts
- The parser handles line-by-line cookies or comma lists.
- It checks every cookie with Roblox to make sure it's valid before saving.
