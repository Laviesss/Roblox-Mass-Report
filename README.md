# Roblox Mass Report Suite (Hybrid Version)

A modernized, high-performance Node.js suite designed for both local PC deployment and Render Cloud hosting. It includes a unified Express dashboard and Discord bot integration.

## Prerequisites

- **Node.js:** v18.0.0 or higher (recommended: v22+)
- **PM2:** Process Manager 2 (for local deployment)

---

## Deployment Options

### Option A: Local PC Deployment (via PM2)

1. **Installation:**
   ```bash
   npm install
   npm install pm2 -g
   ```
2. **Configuration:**
   - Create a `.env` file (see `.env.example`).
   - Add Roblox cookies to `cookies.txt` (one per line).
3. **Execution:**
   - Start the bot:
     ```bash
     pm2 start ecosystem.config.js
     ```
   - Ensure persistence after reboot:
     ```bash
     pm2 save
     pm2 startup
     ```
4. **Management:**
   - **Check Logs:** `pm2 logs roblox-bot-node`
   - **Monitor:** `pm2 monit`
   - **Stop:** `pm2 stop roblox-bot-node`

**Windows Users:** If you want the bot to persist after a PC reboot, it is recommended to use `pm2-windows-startup`.

---

### Option B: Render Cloud Deployment

1. **Blueprint Setup:**
   - Connect your GitHub repository to [Render](https://render.com).
   - Render will automatically detect the `render.yaml` file.
2. **Environment Variables:**
   - Set `CLOUDS_COOKIES` in the Render dashboard (comma or newline separated).
   - Set `DISCORD_TOKEN` for bot integration.
   - Set `RENDER` to `true`.
3. **Custom Domain & DNS:**
   - To use a custom domain, add it in the Render "Settings" tab.
   - Update your DNS provider's records:
     - **CNAME Record:** Point `yourcustomdomain.com` to `roblox-mass-report-suite.onrender.com`.
     - **Alias/A Record:** For root domains, use Render's provided IP addresses.

---

## Security & Safety

- **Cookie Masking:** The suite never logs full cookies. Only Username/ID authenticated via Roblox API are shown in the logs.
- **Git Safety:** `cookies.txt` and `.env` are included in `.gitignore` to prevent accidental credential leaks.

---

**Disclaimer:** This tool is for educational purposes only. Misuse of this tool may violate Roblox's Terms of Service and result in account termination.
