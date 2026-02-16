# 📖 Roblox-Mass-Reporter Technical Manual (v3.2)

This documentation provides an exhaustive breakdown of the features, commands, and logic architecture powering the **Roblox-Mass-Reporter**.

---

## 🏛️ Core Architecture

### 1. The Atlas-First Philosophy
The suite has moved away from local files like `cookies.txt`.
*   **Source of Truth:** All account sessions and task queues are stored in **MongoDB Atlas**.
*   **Security:** Cookies are never written to disk. They are added via the **Secure Modal** and retrieved directly by the engine from the database.
*   **Synchronization:** If you run multiple instances (e.g., local and cloud), they stay perfectly synced via the shared Atlas cluster.

### 2. The Interactive Command Center
The `/accounts` command triggers a component-based UI.
*   **Embed Stats:** Live counts of Total, active, cooldown, and dead sessions.
*   **Select Menu Filtering:** Filter the view to specifically see "Active Only" or "Dead Only" accounts.
*   **Modal Trigger:** The "Add New Account" button launches a native Discord popup for secure data entry.

---

## ⌨️ Command Intelligence

### Tactical & Operational
*   **`/accounts`**: The heart of the suite. View health and add accounts.
*   **`/report [username] [amount] [category]`**:
    *   Resolves username to ID via Users API.
    *   Creates a persistent task in the `Queue` collection.
    *   Reporting loop picks up the task immediately.
*   **`/terminate`**:
    *   Sends a `controller.abort()` signal to every active report loop.
    *   Marks the DB queue item as 'Terminated'.
    *   Stops all network activity instantly.

### Intelligence Gathering
*   **`/inventory_check [username]`**:
    *   Scans the **Roblox Collectibles API**.
    *   Identifies all limited items.
    *   Sums the **RAP (Recent Average Price)** to determine target value.
*   **`/scrape [username]`**:
    *   Extracts account creation date, bio, and exact UserID.
*   **`/check_target [username]`**:
    *   Validates if a target profile is still active or if account actions have already been taken.

### System Management
*   **`/status`**: Real-time telemetry showing uptime, active threads, and DB connectivity.
*   **`/logs`**: Fetch the most recent successful reporting entries from the history collection.
*   **`/slowmode [seconds]`**: Adjusts the delay between requests to fine-tune rate-limit evasion.

---

## 🧠 Mitigation Logic

### 1. The Auth Wall Bypass
Roblox uses an `X-CSRF-TOKEN` handshake.
*   **Problem:** Tokens expire and requests fail with 403.
*   **Fix:** The suite uses an **Axios Response Interceptor**. If a 403 occurs, it pulls the new token from the response header, updates the client, and retries the request automatically.

### 2. Rate Limit (429) Handling
*   **Action:** When a `429 Too Many Requests` is detected, the suite extracts the `Retry-After` time.
*   **DB Update:** The specific account is flagged with a `cooldownUntil` timestamp.
*   **Rotation:** The suite instantly swaps to the next available account in your pool that is not in cooldown.

### 3. Ghost Queue Prevention
*   **Problem:** Process crashes lose pending tasks.
*   **Fix:** Every task is a MongoDB document. Upon restart, the engine queries for items with status `Pending` or `In Progress` and resumes them automatically.

---

## 🛡️ Security Protocols

*   **Credential Masking:** Raw cookies are never displayed in logs or Discord. Only usernames/IDs appear.
*   **Ephemeral Responses:** The "Add Account" modal and results are sent as **Ephemeral Messages**, meaning only the user who triggered the command can see the sensitive interaction.
*   **Git Hardening:** `.gitignore` is configured to prevent accidental leakage of `.env` or legacy data files.

---
**Build v3.2.0** - Refactored by Automation Architect
