# 📚 User Guide: Roblox-Mass-Reporter

This guide explains how the bot works in simple language.

---

## 🛠️ Main Features

### 1. The Fleet Manager (/accounts)
This is where you see your accounts.
*   **Ready:** These accounts are good to go and can report right now.
*   **On Break:** These accounts hit a "Rate Limit" (meaning they sent reports too fast). The bot puts them on a 10-minute break automatically.
*   **Dead (Token Error):** These accounts have broken cookies. You'll need to add them again with a fresh cookie.
*   **Force Reset:** If you want all your accounts to start working again immediately (ignoring their breaks), click the "Force Reset" button.

### 2. The Report Wizard (/report)
Reporting is now a 5-step process:
1.  **Check Target:** The bot shows you the person's profile and if they are online to make sure you have the right target.
2.  **Pick Reason:** Choose why you are reporting them from a list of 10 reasons.
3.  **Choose Speed:** Pick how many seconds to wait between each report (1s to 15s).
4.  **Pick Your Fleet:** Choose exactly which accounts you want to use. You can pick one, a few, or all of them.
5.  **Run Order:** Decide if the accounts should go in order (Sequential) or be mixed up (Randomize).

### 3. Connection Guard
Roblox often tries to block automated tools with "CSRF" errors.
*   The bot is smart: if it hits this error, it grabs the new key, waits for the delay you picked, and tries again once more.
*   If an account still can't connect after the retry, the bot skips it and marks it as "Broken" in the database so it doesn't slow down the rest of your run.

### 4. History Ledger (/reports)
Check what the bot has been doing lately:
*   **History Ledger:** A list of the last 20 reports, showing who was reported and which of your accounts did it.
*   **Failure Audit:** A specific list of reports that didn't work. This helps you see if certain accounts are broken.

---

## 🚀 Pro Tips

*   **Don't Rush:** Using a 5-second or 10-second delay is usually safer than 1 second. It makes the reporting look more "human" to Roblox.
*   **Keep Cookies Fresh:** If an account shows "Token Error", it means the cookie has expired or been logged out. Just add it again using the "Add New Account" button in `/accounts`.
*   **Check the Dashboard:** The bot has a simple web dashboard where you can see live progress if you're running it on a server.
