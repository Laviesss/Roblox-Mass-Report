# 🤖 Roblox-Mass-Reporter

A professional multi-account reporting suite built for stability and ease of use. It automates the process of sending reports across multiple sessions while handling complex obstacles like rate limits and security checks.

---

## 🚀 Quick Setup (5 Steps)

1.  **Clone & Install:** Download the project and run `npm install`.
2.  **Database:** Create a free cluster on MongoDB Atlas and get your connection link.
3.  **Bot Token:** Create a bot on the Discord Developer Portal and invite it to your server.
4.  **Configure:** Copy `.env.example` to `.env` and fill in your keys.
5.  **Launch:**
    *   **Local:** Run `pm2 start ecosystem.config.js`.
    *   **Cloud:** Connect your repo to Render.com and apply the blueprint.

---

## ⚙️ Environment Keys

You need these in your `.env` file:
*   `DISCORD_TOKEN`: Your bot's secret key.
*   `CLIENT_ID`: Your bot's ID.
*   `MONGODB_URI`: Your database connection link.
*   `PORT`: Default is 3000 (used for cloud health checks).

---

## 📚 Technical Manual

For exhaustive details on how the engine works, database schemas, and command architecture:

👉 **[View Full Documentation (DOCUMENTATION.md)](./DOCUMENTATION.md)**
