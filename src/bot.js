require('dotenv').config();
const cheerio = require('cheerio');
const SessionManager = require('./sessionManager');

class RobloxBot {
    constructor() {
        this.sessionManager = new SessionManager();
        this.reasons = {
            1: { reason: "Inappropriate Language - Profanity & Adult Content", comments: ["he said slurs"] },
            2: { reason: "Asking for or Giving Private Information", comments: ["he asked for my password"] },
            3: { reason: "Bullying, Harassment, Discrimination", comments: ["he bullied me"] },
            4: { reason: "Dating", comments: ["hes oding"] },
            5: { reason: "Exploiting, Cheating, Scamming", comments: ["he is scammer"] },
            6: { reason: "Account Theft - Phishing, Hacking, Trading", comments: ["he hacked my account"] },
            7: { reason: "Inappropriate Content - Place, Image, Model", comments: ["he uploaded hentai"] },
            8: { reason: "Real Life Threats & Suicide Threats", comments: ["he threatened me"] },
            9: { reason: "Other rule violation", comments: ["he is doing offsite rule violations"] }
        };
    }

    async init() {
        await this.sessionManager.loadCookies();
    }

    async getUserId(username) {
        const response = await fetch("https://users.roblox.com/v1/usernames/users", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                usernames: [username],
                excludeBannedUsers: true
            })
        });
        const data = await response.json();
        if (data.data && data.data.length > 0) {
            return data.data[0].id;
        }
        throw new Error("User not found");
    }

    async getCsrfToken(cookie) {
        const response = await fetch("https://auth.roblox.com/v2/logout", {
            method: "POST",
            headers: {
                "Cookie": `.ROBLOSECURITY=${cookie}`
            }
        });
        return response.headers.get("x-csrf-token");
    }

    async getVerificationToken(cookie) {
        const response = await fetch("https://www.roblox.com/build/upload", {
            headers: {
                "Cookie": `.ROBLOSECURITY=${cookie}`,
                "Referer": "https://www.roblox.com"
            }
        });
        const html = await response.text();
        const $ = cheerio.load(html);
        const token = $('input[name="__RequestVerificationToken"]').val();
        const setCookie = response.headers.get("set-cookie");
        return { token, setCookie };
    }

    async sendReport(victimId, session, category, comment) {
        const cookie = session.cookie;
        const xCsrfToken = await this.getCsrfToken(cookie);
        const { token, setCookie } = await this.getVerificationToken(cookie);

        const body = new URLSearchParams();
        body.append("__RequestVerificationToken", token);
        body.append("ReportCategory", category);
        body.append("Comment", comment);
        body.append("Id", victimId);
        body.append("RedirectUrl", `https://www.roblox.com/users/${victimId}/profile`);
        body.append("PartyGuid", "");
        body.append("ConversationId", "");

        console.log(`[Bot] Sending report using session: ${SessionManager.formatSession(session)}`);

        const response = await fetch(`https://www.roblox.com/abusereport/userprofile?id=${victimId}`, {
            method: "POST",
            headers: {
                "Cookie": `.ROBLOSECURITY=${cookie}; ${setCookie}`,
                "X-CSRF-TOKEN": xCsrfToken,
                "Referer": "https://www.roblox.com",
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: body.toString()
        });

        return response;
    }

    async runMassReport(username, amount, categoryId, cooldown) {
        console.log(`[Bot] Fetching User ID for ${username}...`);
        let victimId;
        try {
            victimId = await this.getUserId(username);
        } catch (err) {
            console.error(`[Bot] Error: ${err.message}`);
            return;
        }
        console.log(`[Bot] Victim ID: ${victimId}`);

        const iterations = amount === 0 ? Infinity : amount;
        const category = this.reasons[categoryId] ? categoryId : 1;
        const comments = this.reasons[category].comments;

        for (let i = 0; i < iterations; i++) {
            const session = this.sessionManager.getRandomSession();
            if (!session) {
                console.error("[Bot] No authenticated sessions available!");
                break;
            }
            const comment = comments[Math.floor(Math.random() * comments.length)];

            try {
                const res = await this.sendReport(victimId, session, category, comment);
                if (res.status === 200) {
                    console.log(`[${i + 1}] Report Success | 200`);
                } else if (res.status === 429) {
                    console.log(`[${i + 1}] Rate Limited | 429. Waiting 10 minutes...`);
                    await new Promise(resolve => setTimeout(resolve, 600000));
                } else {
                    console.log(`[${i + 1}] Report Failed | ${res.status}`);
                }
            } catch (err) {
                console.error(`[${i + 1}] Error: ${err.message}`);
            }

            if (i < iterations - 1) {
                await new Promise(resolve => setTimeout(resolve, cooldown * 1000));
            }
        }
    }
}

module.exports = RobloxBot;
