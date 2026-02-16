require('dotenv').config();
const fs = require('fs');
const cheerio = require('cheerio');

const VICTIM_USERNAME = process.env.VICTIM_USERNAME;
const REPORT_COUNT = parseInt(process.env.REPORT_COUNT) || 0;
const REPORT_CATEGORY = parseInt(process.env.REPORT_CATEGORY) || 1;
const COOLDOWN = parseInt(process.env.COOLDOWN) || 5;

const REASONS = {
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

async function getUserId(username) {
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

async function getCsrfToken(cookie) {
    const response = await fetch("https://auth.roblox.com/v2/logout", {
        method: "POST",
        headers: {
            "Cookie": `.ROBLOSECURITY=${cookie}`
        }
    });
    return response.headers.get("x-csrf-token");
}

async function getVerificationToken(cookie) {
    const response = await fetch("https://www.roblox.com/build/upload", {
        headers: {
            "Cookie": `.ROBLOSECURITY=${cookie}`,
            "Referer": "https://www.roblox.com"
        }
    });
    const html = await response.text();
    const $ = cheerio.load(html);
    const token = $('input[name="__RequestVerificationToken"]').val();

    // Also need the cookie returned by this request
    const setCookie = response.headers.get("set-cookie");

    return { token, setCookie };
}

async function sendReport(victimId, cookie, category, comment) {
    const xCsrfToken = await getCsrfToken(cookie);
    const { token, setCookie } = await getVerificationToken(cookie);

    const body = new URLSearchParams();
    body.append("__RequestVerificationToken", token);
    body.append("ReportCategory", category);
    body.append("Comment", comment);
    body.append("Id", victimId);
    body.append("RedirectUrl", `https://www.roblox.com/users/${victimId}/profile`);
    body.append("PartyGuid", "");
    body.append("ConversationId", "");

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

async function main() {
    if (!VICTIM_USERNAME) {
        console.error("VICTIM_USERNAME not set in .env");
        process.exit(1);
    }

    let cookies = [];
    try {
        const data = fs.readFileSync('cookies.txt', 'utf8');
        cookies = data.split('\n').map(c => c.trim()).filter(c => c.length > 0);
    } catch (err) {
        console.error("Error reading cookies.txt:", err.message);
        process.exit(1);
    }

    if (cookies.length === 0) {
        console.error("No cookies found in cookies.txt");
        process.exit(1);
    }

    console.log(`[>] Fetching User ID for ${VICTIM_USERNAME}...`);
    let victimId;
    try {
        victimId = await getUserId(VICTIM_USERNAME);
        console.log(`[>] Victim ID: ${victimId}`);
    } catch (err) {
        console.error(`[!] Error: ${err.message}`);
        process.exit(1);
    }

    const iterations = REPORT_COUNT === 0 ? Infinity : REPORT_COUNT;
    const category = REASONS[REPORT_CATEGORY] ? REPORT_CATEGORY : 1;
    const comments = REASONS[category].comments;

    console.log(`[>] Starting mass report for ${VICTIM_USERNAME} (${iterations} times)...`);

    for (let i = 0; i < iterations; i++) {
        const cookie = cookies[Math.floor(Math.random() * cookies.length)];
        const comment = comments[Math.floor(Math.random() * comments.length)];

        try {
            const res = await sendReport(victimId, cookie, category, comment);
            if (res.status === 200) {
                console.log(`[${i + 1}] Report Success | 200`);
            } else if (res.status === 429) {
                console.log(`[${i + 1}] Rate Limited | 429. Waiting 10 minutes...`);
                await new Promise(resolve => setTimeout(resolve, 600000));
            } else {
                console.log(`[${i + 1}] Report Failed | ${res.status} ${res.statusText}`);
            }
        } catch (err) {
            console.error(`[${i + 1}] Error: ${err.message}`);
        }

        if (i < iterations - 1) {
            await new Promise(resolve => setTimeout(resolve, COOLDOWN * 1000));
        }
    }

    console.log("[>] Finished Mass Report.");
}

main().catch(err => {
    console.error("Fatal Error:", err);
    process.exit(1);
});
