# RMR | Exhaustive Technical Manual & Architecture Deep-Dive

## 1. Introduction
The **RMR (Roblox Mass Reporter)** is a professional-grade utility designed for high-concurrency, persistent, and stealthy abuse reporting on the Roblox platform. This manual provides an in-depth look at the architecture, the reporting engine, stealth mechanisms, and deployment strategies.

---

## 2. System Architecture

### 2.1 Technology Stack
- **Runtime:** Node.js v18.x (utilizing native `fetch` and advanced `async/await` patterns).
- **Database:** MongoDB Atlas (M0 Free Tier or higher). Used for session persistence, proxy management, and task queuing.
- **Process Manager:** PM2 for local persistence or Render for cloud hosting.
- **Communication:** Discord.js v14 for the primary Command & Control (C2) interface.

### 2.2 Data Models
- **Account:** Stores `.ROBLOSECURITY` cookies, linked User-Agents, and cooldown timestamps. This model ensures that account "health" is tracked across reboots.
- **Proxy:** Stores IP, Port, Protocol, and Latency data. It tracks the last time a proxy was used to ensure an even distribution of traffic.
- **UserAgent:** A pool of high-entropy browser strings collected from modern browser versions (Chrome, Firefox, Safari) to prevent fingerprinting.
- **Queue:** A persistent task list that allows the bot to resume operations after a crash or reboot. Each entry tracks the target, the current state, and the account assigned.
- **Report:** A ledger of historical reporting actions for auditing. It captures success/failure rates and error codes from the Roblox API.

---

## 3. The Reporting Engine (V2 API)

Roblox migrated to a "V2" Abuse Reporting API which is significantly more robust than previous iterations. RMR handles this through a multi-stage handshake.

### 3.1 CSRF Management
Roblox APIs require an `X-XSRF-TOKEN` (often referred to as CSRF). RMR handles this by:
1. Attempting a "dummy" request to the reporting endpoint (`/abuse-report`).
2. Catching the `403 Forbidden` response.
3. Extracting the token from the `x-csrf-token` response header.
4. Injecting that token into all subsequent requests in the burst.
5. The system periodically refreshes this token if it detects a 403 response during active reporting.

### 3.2 Deep Scraper Logic
RMR features a recursive scraper that allows for "Full Wipe" operations.
- **User Scraper:** Scrapes the user's public inventory via the Catalog API to find every asset they have created. It looks for Shirts, Pants, Decals, and Models.
- **Group Scraper:** Iterates through every game owned by a group. It then cascades into the Experience Scraper for each game found, while also scanning the Group Store for clothing items.
- **Experience Scraper:** Targets the Universe ID, then resolves all Place IDs (Start Places and Sub-places), Badges, and Gamepasses associated with that experience. This ensures that even if the main game is taken down, the associated monetized assets are also flagged.

---

## 4. Stealth & Disguise Suite

To prevent detection and shadowbanning, RMR employs several advanced techniques.

### 4.1 Proxy Waterfall Detective
Not all proxies are created equal. RMR's proxy engine performs a "Waterfall" check on every imported proxy:
- It tests the IP against `roblox.com` using **HTTPS**, then **SOCKS5**, then **SOCKS4**.
- It automatically detects the highest-performing protocol and saves it to the database.
- It calculates latency (ping) and stores it, allowing the engine to prioritize faster proxies during high-speed operations.
- Dead proxies are automatically flagged and can be purged via the `/proxies` dashboard.

### 4.2 Sticky User-Agents (Identity Marriage)
Static User-Agents are a major red flag. However, constantly changing User-Agents for the same account is also suspicious.
- RMR "marries" an account to a specific User-Agent upon first link.
- This identity is stored in MongoDB.
- Every time that account is used, it uses its "married" browser string, simulating a consistent device profile. This mimics a real user who typically accesses the site from the same browser.

### 4.3 Jitter and Cooldowns
- **Jitter:** Every request has a randomized "Jitter" delay (0.1s to 0.5s) added to the user-defined delay. This breaks the rhythmic pattern of automation that anti-bot systems look for.
- **Cooldowns:** Accounts are automatically placed on a 10-minute cooldown after a successful report to prevent "burst" detection on a single account. This helps maintain the longevity of your fleet.

---

## 5. Persistence & Reliability

### 5.1 Background Worker
RMR features an autonomous background worker that runs every 10 seconds. It scans the `target_queue` in MongoDB for any "Pending" tasks. If a task was interrupted by a server restart or a crash, the worker picks it up and continues from the exact point of failure. This makes the system "set and forget."

### 5.2 Memory Watcher (Anti-OOM)
On environments like Render (Free Tier), memory is capped at 512MB.
- RMR monitors its own `heapUsed` and `rss` memory.
- If memory usage exceeds 450MB, it triggers a "Graceful Exit."
- Since the queue is persistent in MongoDB, the process restarts (handled by PM2 or Render), clears its memory, and resumes the task without losing progress.

---

## 6. Discord Interface (C2)

The bot is controlled entirely through Discord Slash Commands, providing a sleek and modern Command & Control (C2) experience:
- `/report`: A 5-stage interactive wizard (Domain -> Scraper -> Reason -> Delay -> Fleet).
- `/accounts`: A dashboard for linking cookies and managing the fleet health.
- `/proxies`: Bulk upload and health check system with automated protocol detection.
- `/useragents`: Manage the identity pool used for browser fingerprinting.
- `/terminate`: Global kill-switch for all active loops.

---

## 7. Troubleshooting & Error Codes

When reviewing Audit Logs, you may see various HTTP status codes:
- **200 OK:** The report was successfully submitted and received by Roblox.
- **403 Forbidden:** Usually indicates a CSRF mismatch. RMR handles this automatically by refreshing the token.
- **429 Too Many Requests:** You are being rate-limited. Increase the delay in your `/report` command or add more accounts to your fleet.
- **401 Unauthorized:** The `.ROBLOSECURITY` cookie has expired or been invalidated. The account will be marked "Dead" in the dashboard.

## 8. Operational Guidelines
1. **Fleet Size:** A minimum of 5-10 accounts is recommended for effective mass reporting. The more accounts you have, the lower the risk to each individual account.
2. **Proxy Quality:** High-quality SOCKS5 proxies are significantly more effective than public HTTP proxies. Residential proxies are the "gold standard" for stealth.
3. **Delay Settings:** For maximum stealth, a delay of 5-10 seconds per report is recommended. For speed, 1-2 seconds is viable but increases the risk of rate-limiting.
4. **Audit Logs:** Always review the `.txt` audit log sent to your DMs after a mission. It contains the exact Roblox response codes and verification IDs, which are vital for tracking your success.

---
*RMR: RMR. Designed for speed, built for persistence.*
*© 2024 RMR Development Group. All Rights Reserved.*
