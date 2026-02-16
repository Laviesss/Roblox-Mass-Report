const fs = require('fs');

class SessionManager {
    constructor() {
        this.sessions = []; // Array of objects: { cookie, username, userId }
        this.isRender = process.env.RENDER === 'true' || !!process.env.RENDER;
    }

    async loadCookies() {
        let rawCookies = [];
        if (this.isRender) {
            console.log("[SessionManager] Detected Render Cloud environment.");
            const cloudCookies = process.env.CLOUDS_COOKIES || "";
            if (cloudCookies.includes('\n')) {
                rawCookies = cloudCookies.split('\n').map(c => c.trim()).filter(c => c.length > 0);
            } else if (cloudCookies.includes(',')) {
                rawCookies = cloudCookies.split(',').map(c => c.trim()).filter(c => c.length > 0);
            } else if (cloudCookies.length > 0) {
                rawCookies = [cloudCookies.trim()];
            }
        } else {
            console.log("[SessionManager] Detected Local PC environment.");
            try {
                if (fs.existsSync('cookies.txt')) {
                    const data = fs.readFileSync('cookies.txt', 'utf8');
                    rawCookies = data.split('\n').map(c => c.trim()).filter(c => c.length > 0);
                } else {
                    console.warn("[SessionManager] cookies.txt not found.");
                }
            } catch (err) {
                console.error("[SessionManager] Error reading cookies.txt:", err.message);
            }
        }

        console.log(`[SessionManager] Found ${rawCookies.length} raw cookies. Authenticating...`);

        for (const cookie of rawCookies) {
            try {
                const userInfo = await this.authenticateCookie(cookie);
                if (userInfo) {
                    this.sessions.push({
                        cookie: cookie,
                        username: userInfo.name,
                        userId: userInfo.id
                    });
                    console.log(`[SessionManager] Authenticated session: ${userInfo.name} (${userInfo.id})`);
                }
            } catch (err) {
                console.error(`[SessionManager] Failed to authenticate a cookie: ${err.message}`);
            }
        }

        console.log(`[SessionManager] Successfully loaded ${this.sessions.length} active sessions.`);
    }

    async authenticateCookie(cookie) {
        const response = await fetch("https://users.roblox.com/v1/users/authenticated", {
            headers: {
                "Cookie": `.ROBLOSECURITY=${cookie}`
            }
        });
        if (response.ok) {
            return await response.json();
        }
        return null;
    }

    getRandomSession() {
        if (this.sessions.length === 0) return null;
        return this.sessions[Math.floor(Math.random() * this.sessions.length)];
    }

    // Helper to log session info without showing cookie
    static formatSession(session) {
        if (!session) return "N/A";
        return `${session.username} (${session.userId})`;
    }
}

module.exports = SessionManager;
