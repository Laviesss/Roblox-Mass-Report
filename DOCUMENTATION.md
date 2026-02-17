# 📚 User Manual: Roblox-Mass-Reporter

This document explains how the bot works and what each part does in simple language.

---

## 🛠️ Core Features

### 1. Smart Reporting Engine
The bot doesn't just send reports blindly. It has "brains" to handle common problems:
*   **Wait and Retry:** If Roblox tells the bot to wait (CSRF errors), it waits 2 seconds and tries again automatically.
*   **Break Detection:** If an account's session is broken (Error 400), the bot marks it as "Broken" and stops using it so it doesn't waste time.
*   **Rate Limits:** If the bot is sending reports too fast, it will automatically put that account on "Cooldown" and switch to a different one.

### 2. Interactive Reporting (/report)
Reporting a user is now a simple 5-step process:
1.  **Check Target:** See the person's profile, how old their account is, and if they are online.
2.  **Pick Reason:** Choose from 10 clear reasons like "Bullying" or "Scamming".
3.  **Set Speed:** Decide how many seconds to wait between reports (1s to 15s).
4.  **Pick Accounts:** Select exactly which accounts from your database you want to use. You can scroll through pages if you have many.
5.  **Choose Style:** Run them in order or randomize them to be less predictable.

### 3. History Dashboard (/reports)
Keep track of what your bot has been doing:
*   **Stats:** See total successful reports and how many accounts are currently broken or waiting.
*   **Recent History:** Look at the last 15 people reported.
*   **Failed Reports:** See exactly which reports failed so you can fix your accounts.
*   **Search:** Type a username to see every time the bot has reported that specific person.

---

## 🛡️ Security & Safety

*   **Kill Switch:** Use `/terminate` at any time to instantly stop all active reporting loops.
*   **Private Info:** The bot uses Discord "Modals" for adding accounts. This means your cookies are never typed into a public chat where others can see them.
*   **Safe Logs:** The bot never prints your full cookies in the logs. It only shows usernames or IDs to keep you safe.

---

## 🚀 Pro Tips

*   **Use Delays:** Don't always use the 1-second delay. Using 5s or 10s makes the reporting look more natural and helps avoid rate limits.
*   **Monitor Logs:** Use `pm2 logs` on your computer to see real-time progress and detailed error messages if something isn't working.
*   **Check Accounts:** Regularly use `/reports` to see if any of your accounts have been marked as "Broken". You'll need to replace those cookies using the `/accounts` menu.
