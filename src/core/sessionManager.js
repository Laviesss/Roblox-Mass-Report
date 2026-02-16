const fs = require('fs');
const Account = require('../models/Account');
const axios = require('axios');

class SessionManager {
    constructor() {
        this.isRender = process.env.RENDER === 'true' || !!process.env.RENDER;
    }

    async loadSessions() {
        // 1. Initial import from environment/files if present
        let rawCookies = [];
        if (this.isRender) {
            const cloudCookies = process.env.CLOUDS_COOKIES || "";
            rawCookies = cloudCookies.split(/[,\n]/).map(c => c.trim()).filter(c => c.length > 0);
        } else {
            if (fs.existsSync('cookies.txt')) {
                const data = fs.readFileSync('cookies.txt', 'utf8');
                rawCookies = data.split('\n').map(c => c.trim()).filter(c => c.length > 0);
            }
        }

        if (rawCookies.length > 0) {
            console.log(`[SessionManager] Importing ${rawCookies.length} cookies from source...`);
            for (const cookie of rawCookies) {
                await this.addAccount(cookie);
            }
        }

        // 2. Primary source is now the Database
        const activeCount = await Account.countDocuments({ status: 'active' });
        console.log(`[SessionManager] Total active Sessions in DB: ${activeCount}`);
    }

    async addAccount(cookie) {
        try {
            const userInfo = await this.validateCookie(cookie);
            if (userInfo) {
                const account = await Account.findOneAndUpdate(
                    { userId: userInfo.id },
                    {
                        username: userInfo.name,
                        cookie: cookie,
                        status: 'active', // Lowercase consistency
                        last_checked: new Date()
                    },
                    { upsert: true, new: true }
                );
                console.log(`[SessionManager] Account synced: ${userInfo.name}`);
                return account;
            }
            return null;
        } catch (err) {
            console.error(`[SessionManager] Failed to add account: ${err.message}`);
            return null;
        }
    }

    async validateCookie(cookie) {
        try {
            const response = await axios.get("https://users.roblox.com/v1/users/authenticated", {
                headers: { "Cookie": `.ROBLOSECURITY=${cookie}` }
            });
            return response.data;
        } catch (err) {
            return null;
        }
    }

    async getRandomSession() {
        const count = await Account.countDocuments({ status: 'active' });
        if (count === 0) return null;
        const random = Math.floor(Math.random() * count);
        return await Account.findOne({ status: 'active' }).skip(random);
    }
}

module.exports = SessionManager;
