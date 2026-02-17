# 📚 Complete Architectural Manual: Universal Takedown System

This manual explains the inner workings of the Roblox Management Suite. It covers the stealth engine, cloud infrastructure, and the universal reporting logic.

---

## ☁️ 1. Cloud Infrastructure & Persistence (The Engine)

The bot is built to work on the **Render Free Tier** without needing any paid plans. We do this by managing resources very carefully.

### A. Render Configuration (The Blueprint)
*   **The Blueprint Fix:** The `render.yaml` file tells Render exactly how to build and run the bot. It is hard-coded to use the **Free** plan for every service.
*   **Express Port Binding:** Render monitors the bot to see if it is "alive." We use a small web server (Express) that listens on `0.0.0.0:${PORT}`. If the bot doesn't answer this "handshake" within 60 seconds, Render will reboot it.
*   **Memory Watcher:** The Free Tier gives us 512MB of RAM. If the bot uses more than 450MB during a massive scrape, it will automatically pause its work, save everything to MongoDB, and restart itself to clear the memory.

### B. MongoDB "Resume" Logic
*   **Target Queueing:** We never store your targets in the bot's temporary memory. Every ID found (Games, Assets, Badges) is written into the `target_queue` collection in your database.
*   **Fault Tolerance:** If Render reboots the bot, it checks the `target_queue` as soon as it starts up. If it finds unfinished work, it resumes automatically and picks up exactly where it stopped.

---

## 🌐 2. Proxies & User-Agents (Stealth & Identity)

To keep your accounts safe, the bot uses a "Disguise Kit." This makes every account look like a unique person on a real computer.

### A. The Proxy "Waterfall" Detective
When you upload proxies, the bot doesn't trust the labels you give them. It runs a **Triple-Stage Protocol Test**:
1.  **Stage 1 (HTTP/HTTPS):** It tries to visit Roblox using the proxy as a standard web agent. If it works, it stops and marks the proxy as HTTP.
2.  **Stage 2 (SOCKS5):** If HTTP fails, it tries the SOCKS5 protocol. This is much better for bypassing strict blocks.
3.  **Stage 3 (SOCKS4):** If both fail, it makes one last try with the older SOCKS4 protocol.
If all three fail, the proxy is marked as **Dead**. You can clean these out by clicking the [ 🗑️ Purge Dead ] button.

### B. Sticky User-Agent "Marriage"
*   **The Fingerprint Bank:** You upload a list of browser strings (like Chrome on Windows or Safari on Mac) via the `/useragents` command.
*   **The Marriage Logic:** When you add a Roblox account, the bot picks one random browser string from your list and saves it directly into that account’s database file.
*   **The Result:** That account will **always** use that same browser identity. To Roblox, it looks like that "person" is always using the same laptop, which prevents them from flagging the account as a bot.

---

## 🕹️ 3. The Universal /report Command Center

The `/report` command is a high-speed takedown machine with four stages:

### Stage 1: Multi-Category Selection
You first pick what you want to target:
*   **User Profile:** For banning a specific person.
*   **Marketplace Asset:** For shirts, pants, hats, and models.
*   **Experience (Game):** For places and game worlds.
*   **Group Entity:** For wiping an entire clothing or game studio.

### Stage 2: The "Deep Scraper" Engine
If you choose "Full Wipe," the bot finds everything linked to your target:
*   **Games:** It finds the lobby, every level (linked places), all Badges, and all Gamepasses.
*   **Groups:** It scrapes the entire Group Store and every game they own.
*   **Users:** It searches the creator’s inventory for every public item they’ve made.

### Stage 3: Success Proof & Evidence
The bot doesn't just send a request and hope it worked. It validates the response:
*   **Response Validation:** It captures the raw data from Roblox's server.
*   **Log ID:** For every successful report, it generates a "Verification ID."
*   **Proof Ticker:** The progress bar shows a live feed of which items were successfully hit and verified.

### Stage 4: Automated Execution Loop
Once you hit [START], the bot begins:
1.  **CSRF Handshake:** It sends a dummy request to get a security token from Roblox.
2.  **Identity Rotation:** It pulls an account, injects its "Sticky" browser string, and picks a fresh proxy.
3.  **Human Jitter:** It adds a random amount of time (offsets) to your delay so the speed isn't perfectly consistent.
4.  **429 Handling:** If Roblox says "Too Many Requests," the bot puts that account on a 10-minute break and swaps in a fresh one immediately.

---

## 📄 4. The Audit Log

After a massive run (especially for 100+ items), the bot sends you a record of the damage.

### The Automated Audit Report
*   **Post-Operation DM:** Once the queue is empty, the bot will DM you a `.txt` file.
*   **The Contents:** It shows every Target ID, the Outcome (Success/Fail), the exact Response Code from Roblox, and which Account/Proxy was used.
*   **The Clean-Up:** After sending the log, the bot wipes the temporary data to keep your database lean.

---

## ⌨️ 5. UI & Interaction Rules

*   **Deferral is Law:** Every button you click tells the bot to "Wait and Think." This prevents the "Application Did Not Respond" error.
*   **Unified Look:** Every menu (/proxies, /useragents, /accounts) looks and acts the same way.
*   **Live Progress:** The report dashboard updates every 5 seconds with a visual progress bar [ 🟦🟦🟦⬜️⬜️ ] and a live count of successes.
