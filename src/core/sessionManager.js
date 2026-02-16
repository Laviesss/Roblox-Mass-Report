const fs = require('fs');
const Account = require('../models/Account');
const axios = require('axios');

class SessionManager {
    constructor() {
        this.isRender = process.env.RENDER === 'true' || !!process.env.RENDER;
    }

    async loadSessions() {
        let rawCookies = [];
        if (this.isRender) {
            console.log("[SessionManager] Mode: Render Cloud");
            const cloudCookies = process.env.CLOUDS_COOKIES || "";
            rawCookies = cloudCookies.split(/[,\n]/).map(c => c.trim()).filter(c => c.length > 0);
        } else {
            console.log("[SessionManager] Mode: Local PC");
            if (fs.existsSync('cookies.txt')) {
                const data = fs.readFileSync('cookies.txt', 'utf8');
                rawCookies = data.split('\n').map(c => c.trim()).filter(c => c.length > 0);
            }
        }

        for (const cookie of rawCookies) {
            try {
                const userInfo = await this.validateCookie(cookie);
                if (userInfo) {
                    await Account.findOneAndUpdate(
                        { userId: userInfo.id },
                        {
                            username: userInfo.name,
                            cookie: cookie,
                            status: 'Active',
                            lastUsed: new Date()
                        },
                        { upsert: true, new: true }
                    );
                }
            } catch (err) {
                console.error(`[SessionManager] Auth failed for a cookie: ${err.message}`);
            }
        }

        const activeCount = await Account.countDocuments({ status: 'Active' });
        console.log(`[SessionManager] Total Active Sessions in DB: ${activeCount}`);
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
        const count = await Account.countDocuments({ status: 'Active' });
        if (count === 0) return null;
        const random = Math.floor(Math.random() * count);
        return await Account.findOne({ status: 'Active' }).skip(random);
    }
}

module.exports = SessionManager;
