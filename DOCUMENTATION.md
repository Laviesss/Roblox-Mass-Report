# 📚 Technical Documentation: Roblox-Mass-Reporter

This manual explains how the bot works, how it saves data, and how it handles cloud hosting.

---

## 🛠️ Section 1: The Engine (How it Works)

### Request Flow
The bot talks to the Roblox API using a specialized tool called Axios. When you start a report run, the bot takes your list of accounts and sends a "POST" request to the Roblox Abuse Reporting V2 endpoint for each one.

### CSRF Handling (Catching the 403)
Roblox uses a security key called a "CSRF Token" to stop spam. If the bot tries to send a report without a valid key, Roblox sends back an **Error 403**.
1.  The bot catches this error immediately using an "interceptor" in the code.
2.  It looks at the header of the error message to find the new `x-csrf-token`.
3.  It puts the new key into the request and tries to send the report again once.
4.  If it fails again with an Error 400, it marks that account as broken.

### Rate Limit Logic (The 429 Math)
If you send reports too fast, Roblox will send back an **Error 429**.
*   The bot identifies this "Stop" signal and immediately puts that specific account on a break.
*   **The Math:** It sets a "Cooldown" timestamp in the database exactly 10 minutes (600 seconds) into the future.
*   The bot will skip this account for any new report runs until that time has passed.

---

## 🗄️ Section 2: Database Schema

We use MongoDB Atlas to make sure your data never disappears, even if the bot restarts.

### Collection: `sessions`
This saves your Roblox accounts.
*   `cookie`: The full Roblox session string.
*   `username`: The Roblox name for the account.
*   `userId`: The unique ID for the Roblox account.
*   `status`: Tells us if the account is `active`, `cooldown`, or `dead`.
*   `cooldownUntil`: The exact time when an account is allowed to work again.
*   `last_checked`: When the bot last checked if the account was working.

### Collection: `reports`
This logs every attempt the bot makes.
*   `victimId`: The unique ID of the person being reported.
*   `victimUsername`: The name of the person being reported.
*   `reporterId`: The ID of your account that sent the report.
*   `category`: The ID of the reason (1-10) used for the report.
*   `status`: Shows if the report was a `Success`, `Failed`, or `Error`.
*   `errorCode`: The number Roblox sent back (like 400 or 403).
*   `errorType`: A simple description of what went wrong.

---

## ☁️ Section 3: Cloud Infrastructure (Render)

### Web-Server Guard
We use a small web server (Express) inside the bot. This is because cloud services like Render check to see if your code is "listening" for connections.
*   The bot uses `process.env.PORT` to open a web port.
*   If this port isn't open, Render will think the bot crashed and keep restarting it.

### The RENDER Toggle
Inside the code, there is a setting called `isRender`.
*   If `RENDER=true` is set in your environment variables, the bot knows it is running in the cloud.
*   It will automatically try to sync cookies from the `CLOUDS_COOKIES` environment variable, but only if they aren't already in the database.

### Cron-Jobs (Keeping it Awake)
If you are using a free version of Render, the bot will "fall asleep" after 15 minutes of no work.
*   To fix this, use a "Ping" service (like Cron-job.org) to visit your bot's web link every 5-10 minutes. This keeps the bot awake and ready to work 24/7.

---

## 🎮 Section 4: Command Architecture

### Pagination (The 25-Limit)
Discord only lets us show 25 items in a dropdown menu at once.
*   If you have more than 25 accounts, the bot splits them into pages.
*   It uses "Back" and "Next" buttons to let you flip through your fleet.
*   The bot remembers every account you pick across all pages using a "Set" in the code. This means you can pick accounts on page 1, then go to page 2 and pick more without losing the first ones.

### Shuffling (Fisher-Yates)
When you choose "Randomize" in the report wizard, the bot shuffles your accounts.
*   It uses a "Fisher-Yates" shuffle. This is a simple bit of math that goes through the list and swaps items around until they are in a completely unpredictable order.
*   This makes sure Roblox doesn't see the same pattern of accounts every time you report someone.
