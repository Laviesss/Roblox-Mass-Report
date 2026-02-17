# 📚 Technical Documentation: Roblox-Mass-Reporter

This manual explains how the bot works, how it keeps you safe, and how to set it up perfectly.

---

## 🌐 1. The Proxy Detective System (The Waterfall Test)

The bot has a built-in "detective" that figures out how your proxies work so you don't have to guess.

### The Waterfall Logic
When you add proxies, the bot doesn't always know what protocol they use (HTTP, SOCKS5, or SOCKS4). When you click **[🔄 Check All]**, the bot runs a "Waterfall" loop for every entry:
1.  **HTTP Try:** The bot first attempts a connection using the HTTP/HTTPS protocol.
2.  **SOCKS5 Try:** If HTTP fails, it immediately attempts a SOCKS5 connection.
3.  **SOCKS4 Try:** If both fail, it tries SOCKS4 as a last resort.
If all three protocols fail to reach Roblox within 5 seconds, the proxy is marked as **Dead**.

### Proxy Status Codes
*   **Active:** The proxy successfully connected to Roblox using one of the tested protocols.
*   **Dead:** The proxy failed all Waterfall tests (no response or refused connection).
*   **Timed Out:** The connection was too slow (over 5 seconds) to be reliable for mass reporting.

### Smart Proxy Parser
The upload modal is designed to be "Smart." You can paste a raw dump of text from your proxy provider. The bot uses a **Regular Expression (Regex)** to ignore junk text and only grab valid `IP:Port` patterns.

---

## 🎭 2. Fingerprinting & Sticky Identity

Roblox tracks your "fingerprint" to identify bots. We defeat this using browser identities.

### User-Agent Bulk Import
Use the `/useragents` command to add a list of fresh browser strings. A larger list makes your fleet more diverse and harder to track.

### Sticky Identity Logic
This is our most powerful stealth feature:
1.  **Assignment:** When you upload a Roblox account, the bot picks one random User-Agent from your database.
2.  **The Lock:** It saves that pair (Account + User-Agent) in MongoDB forever.
3.  **The Result:** Every time that account sends a report, it uses the **exact same** browser string. To Roblox, it looks like the account is always coming from the same "device." This prevents the account from being flagged for "suspicious identity changes."

---

## 🛠️ 3. Comprehensive Setup Guide

### A. PC (Local) Installation
1.  **Install Node.js:** Download the latest "LTS" version from [nodejs.org](https://nodejs.org/).
2.  **Check Version:** Open your terminal and type `node -v`. It must be v18.0.0 or higher.
3.  **Download Tools:** Open your terminal in the project folder and type `npm install`.
4.  **The .env file:** Create a file named `.env` in the main folder. Fill it in exactly like this:
    ```env
    DISCORD_TOKEN=your_bot_token
    CLIENT_ID=your_id
    MONGODB_URI=your_mongo_link
    ```
5.  **Start the Bot:** Type `node src/server.js` to begin.

### B. Render (Cloud) Installation
1.  **The Blueprint:** The `render.yaml` file is pre-configured for the **Free Tier**. No changes are needed.
2.  **GitHub Connection:** Connect your GitHub account to Render and select this project repository.
3.  **Environment Variables:** On the Render dashboard, add the following Secret Keys:
    *   `DISCORD_TOKEN`
    *   `CLIENT_ID`
    *   `MONGODB_URI`
4.  **Keeping it Awake:** Free Render apps go to sleep after 15 minutes.
    *   Go to **cron-job.org**.
    *   Create a job that "pings" your Render web URL (the one ending in .onrender.com) every 10 minutes. This keeps the bot awake 24/7.

---

## 🕹️ 4. Command & Interaction Flow

### The "Thinking" State (Defer Fix)
Heavy tasks like checking 100 proxies take time. To prevent "Application did not respond" errors, the bot uses a **Defer** system:
*   When you click a heavy button, the bot immediately tells Discord: "Wait, I am thinking."
*   This gives the bot **15 minutes** to finish the task instead of the standard 3-second limit.
*   Once the task is done, the bot edits its message with the final result.

### Command Technicals
*   **/report:** Sequence: Resolve Target ID -> CSRF Handshake -> Proxy Rotation -> User-Agent Injection -> Delayed Loop.
*   **/accounts:** Real-time dashboard that pulls fleet health from MongoDB. The **[Force Reset]** button clears all cooldowns at once.
*   **/proxies / /useragents:** Mirrors the accounts UI with pagination support. The parser handles messy text dumps automatically.
