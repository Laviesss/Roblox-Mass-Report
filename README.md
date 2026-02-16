# Roblox Mass Report (Node.js Version)

A modernized, high-performance Node.js implementation of the Roblox Mass Report tool, designed for stability and persistent operation using PM2.

## Prerequisites

- **Node.js:** v18.0.0 or higher (recommended: v22+)
- **PM2:** Process Manager 2

## Step 1: Installation

1. Clone the repository to your local PC.
2. Open a terminal in the project directory.
3. Install the required dependencies:
   ```bash
   npm install
   ```
4. Install PM2 globally (requires admin/sudo if not using a version manager):
   ```bash
   npm install pm2 -g
   ```

## Step 2: Configuration

1. **Environment Variables:**
   - Copy the `.env.example` file and rename it to `.env`.
   - Open `.env` and fill in the following details:
     - `VICTIM_USERNAME`: The Roblox username of the target.
     - `REPORT_COUNT`: Number of reports to send (set to `0` for infinite).
     - `REPORT_CATEGORY`: The ID of the report reason (1-9).
     - `COOLDOWN`: Seconds to wait between reports.

2. **Cookies:**
   - Add your Roblox `.ROBLOSECURITY` cookies to the `cookies.txt` file.
   - Place each cookie on a new line. It is highly recommended to use alternate accounts as mass reporting can lead to account actions.

## Step 3: Execution

Launch the bot using PM2 to ensure it runs persistently in the background:

1. **Start the bot:**
   ```bash
   pm2 start ecosystem.config.js
   ```
2. **Ensure persistence after reboot:**
   - Save the current process list:
     ```bash
     pm2 save
     ```
   - Generate the startup script:
     ```bash
     pm2 startup
     ```

## Step 4: Management

Manage your bot using these simple CLI commands:

- **Check Logs:** View real-time output and errors.
  ```bash
  pm2 logs roblox-bot-node
  ```
- **Monitor Performance:** Opens a dashboard to monitor CPU/Memory and status.
  ```bash
  pm2 monit
  ```
- **Stop the Bot:**
  ```bash
  pm2 stop roblox-bot-node
  ```
- **Restart the Bot:**
  ```bash
  pm2 restart roblox-bot-node
  ```

---

## Cross-Platform Considerations (Windows Users)

If you are running this on a Windows PC and want the bot to automatically start after a system reboot, it is recommended to use the `pm2-windows-startup` utility:

1. Install the utility:
   ```bash
   npm install pm2-windows-startup -g
   ```
2. Run the setup command:
   ```bash
   pm2-startup install
   ```
3. Save your processes as usual with `pm2 save`.

---

**Disclaimer:** This tool is for educational purposes only. Misuse of this tool may violate Roblox's Terms of Service and result in account termination.
