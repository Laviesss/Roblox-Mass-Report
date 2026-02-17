const Account = require('../models/Account');
const UserAgent = require('../models/UserAgent');
const axios = require('axios');

class SessionManager {
    constructor() {
        this.isRender = process.env.RENDER === 'true' || !!process.env.RENDER;
    }

    async loadSessions() {
        // 1. Initial import from environment variables
        if (this.isRender) {
            const cloudCookies = (process.env.CLOUDS_COOKIES || "").split(/[,\n]/).map(c => c.trim()).filter(c => c.length > 50);

            if (cloudCookies.length > 0) {
                console.log(`[RMR] Checking ${cloudCookies.length} environment cookies...`);
                // Use a small concurrency limit or just check if already in DB
                for (const cookie of cloudCookies) {
                    // Quick check if cookie already exists in DB to avoid redundant API calls on every boot
                    const exists = await Account.findOne({ cookie: cookie });
                    if (!exists) {
                        await this.addAccount(cookie);
                    }
                }
            }
        }

        const activeCount = await Account.countDocuments({ status: 'active' });
        console.log(`[RMR] Total active Sessions in DB: ${activeCount}`);
    }

    async addAccount(cookie) {
        try {
            const userInfo = await this.validateCookie(cookie);
            if (userInfo) {
                // Sticky User-Agent Marriage Logic
                const existing = await Account.findOne({ userId: userInfo.id });
                let userAgent = existing?.userAgent;

                if (!userAgent) {
                    const uaPool = await UserAgent.find({});
                    if (uaPool.length > 0) {
                        userAgent = uaPool[Math.floor(Math.random() * uaPool.length)].ua;
                    } else {
                        userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
                    }
                }

                return await Account.findOneAndUpdate(
                    { userId: userInfo.id },
                    {
                        username: userInfo.name,
                        cookie: cookie,
                        status: 'active',
                        userAgent: userAgent,
                        last_checked: new Date()
                    },
                    { upsert: true, new: true }
                );
            }
            return null;
        } catch (err) {
            console.error(`[RMR] Failed to add account: ${err.message}`);
            return null;
        }
    }

    async validateCookie(cookie) {
        try {
            const response = await axios.get("https://users.roblox.com/v1/users/authenticated", {
                headers: { "Cookie": `.ROBLOSECURITY=${cookie}` }
            });
            return response.data;
        } catch (err) { return null; }
    }

    async getRandomSession() {
        const count = await Account.countDocuments({ status: 'active' });
        if (count === 0) return null;
        const random = Math.floor(Math.random() * count);
        return await Account.findOne({ status: 'active' }).skip(random);
    }
}

module.exports = SessionManager;
