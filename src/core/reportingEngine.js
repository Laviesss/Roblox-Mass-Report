const createRobloxClient = require('./robloxClient');
const SessionManager = require('./sessionManager');
const Account = require('../models/Account');
const Report = require('../models/Report');
const Queue = require('../models/Queue');
const Proxy = require('../models/Proxy');
const UserAgent = require('../models/UserAgent');
const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const axios = require('axios');

class ReportingEngine {
    constructor() {
        this.sessionManager = new SessionManager();
        this.activeControllers = new Map();
        this.io = null;
        this.reasonMap = {
            "lang": { id: 1, reason: "InappropriateLanguage", tags: ["profanity"], label: "Inappropriate Language" },
            "privacy": { id: 2, reason: "PrivateInformation", tags: ["pii"], label: "Private Information" },
            "bullying": { id: 3, reason: "Bullying", tags: ["harassment"], label: "Bullying & Harassment" },
            "dating": { id: 4, reason: "Dating", tags: ["dating"], label: "Dating" },
            "cheating": { id: 5, reason: "Scamming", tags: ["scam"], label: "Cheating & Scamming" },
            "theft": { id: 6, reason: "AccountTheft", tags: ["phishing"], label: "Account Theft" },
            "content": { id: 7, reason: "InappropriateContent", tags: ["adult"], label: "Inappropriate Content" },
            "threats": { id: 8, reason: "Threats", tags: ["violence"], label: "Real Life Threats" },
            "maturity": { id: 9, reason: "OtherRuleViolation", tags: ["other"], label: "Inaccurate Maturity" },
            "other": { id: 10, reason: "OtherRuleViolation", tags: ["other"], label: "Other Rule Violation" }
        };
        this.startMemoryWatcher();
    }

    startMemoryWatcher() {
        setInterval(async () => {
            const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024;
            if (memoryUsage > 450) {
                console.warn(`[RMR] High Memory Alert: ${memoryUsage.toFixed(2)}MB. Flushing cache and restarting...`);
                process.exit(1);
            }
        }, 30000);
    }

    setSocketIO(io) { this.io = io; }

    log(message) {
        console.log(`[RMR] ${message}`);
        if (this.io) this.io.emit('log', message);
    }

    async init() { await this.sessionManager.loadSessions(); }

    async forceResetCooldowns() { await Account.updateMany({}, { $set: { status: 'active', cooldownUntil: null } }); }

    async getNextProxy() {
        const proxy = await Proxy.findOne({ status: 'active' }).sort({ lastChecked: 1 });
        if (proxy) { proxy.lastChecked = new Date(); await proxy.save(); }
        return proxy;
    }

    async checkProxyWaterfall(host, port) {
        const protocols = ['http', 'socks5', 'socks4'];
        for (const proto of protocols) {
            try {
                let agent;
                const { HttpsProxyAgent } = require('https-proxy-agent');
                const { SocksProxyAgent } = require('socks-proxy-agent');
                if (proto === 'http') agent = new HttpsProxyAgent(`http://${host}:${port}`);
                else if (proto === 'socks5') agent = new SocksProxyAgent(`socks5://${host}:${port}`);
                else if (proto === 'socks4') agent = new SocksProxyAgent(`socks4://${host}:${port}`);
                const start = Date.now();
                await axios.get('https://www.roblox.com/home', { httpsAgent: agent, timeout: 5000, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' } });
                return { protocol: proto, latency: Date.now() - start };
            } catch (err) { continue; }
        }
        return null;
    }

    async processQueue() {
        const item = await Queue.findOne({ status: 'Pending' }).sort({ createdAt: 1 });
        if (!item) return;

        const account = await Account.findOne({
            status: 'active',
            $or: [{ cooldownUntil: null }, { cooldownUntil: { $lte: new Date() } }]
        });

        if (!account) return;

        item.status = 'In Progress';
        await item.save();

        this.log(`Resuming task: ${item.targetName} (${item.targetId}) using ${account.username}`);

        const proxy = await this.getNextProxy();
        const client = createRobloxClient(account.cookie, account.userAgent, proxy);

        try {
            let csrf = null;
            try {
                const res = await client.post("https://apis.roblox.com/abuse-reporting/v2/abuse-report", {});
                csrf = res.headers['x-csrf-token'];
            } catch (err) {
                csrf = err.response?.headers['x-csrf-token'];
            }

            const mapping = this.reasonMap[item.reasonKey || "other"] || this.reasonMap["other"];

            const res = await client.post(
                "https://apis.roblox.com/abuse-reporting/v2/abuse-report",
                { "reportReason": mapping.reason, "comment": "Automation detected terms of service violation.", "tags": mapping.tags, "id": item.targetId },
                { headers: { 'x-csrf-token': csrf } }
            );

            item.responseCode = res.status;
            item.responseBody = res.data;
            item.accountUsed = account.username;
            item.proxyUsed = proxy ? `${proxy.host}:${proxy.port}` : 'None';

            if (res.status === 200 && res.data.success) {
                item.status = 'Success';
                item.verificationId = `VER-${Math.floor(Math.random() * 1000000)}`;
                this.log(`Resumed task Success: ${item.targetName}`);

                await Report.create({ victimUsername: item.targetName, victimId: item.targetId, status: 'Success', timestamp: new Date() });
            } else if (res.status === 429) {
                item.status = 'Pending';
                account.status = 'cooldown';
                account.cooldownUntil = new Date(Date.now() + 600000);
                await account.save();
            } else {
                item.status = 'Failed';
                await Report.create({ victimUsername: item.targetName, victimId: item.targetId, status: 'Failed', errorType: `Code ${res.status}`, timestamp: new Date() });
            }
        } catch (err) {
            item.status = 'Failed';
            item.responseCode = err.response?.status || 500;
            await Report.create({ victimUsername: item.targetName, victimId: item.targetId, status: 'Failed', errorType: err.message, timestamp: new Date() });
        }

        await item.save();
    }

    async performDiscovery(targetId, type) {
        let targets = [];
        let summary = "";

        if (type === 'GAME') {
            targets = await this.scrapeGameExhaustive(targetId);
            summary = `Identified Universe, Sub-places, Badges, and Gamepasses.`;
        } else if (type === 'GROUP') {
            targets = await this.scrapeGroupExhaustive(targetId);
            summary = `Mapped all Group Games, Store Items, and linked Assets.`;
        } else if (type === 'BAN') {
            targets = await this.scrapeUserExhaustive(targetId);
            summary = `Inventoried all created items, games, and profile components.`;
        } else {
            targets = [{ id: targetId, name: 'Marketplace Asset', type: 'ASSET' }];
            summary = `Targeted single marketplace item.`;
        }

        return { targets, summary };
    }

    async scrapeGameExhaustive(universeId) {
        const targets = [];
        try {
            const universeRes = await axios.get(`https://games.roblox.com/v1/universes/${universeId}`);
            const data = universeRes.data;
            targets.push({ id: data.rootPlaceId, name: `${data.name} (Root)`, type: 'GAME' });

            const placesRes = await axios.get(`https://games.roblox.com/v1/universes/${universeId}/places?limit=100`);
            placesRes.data.data.forEach(p => {
                if (p.id !== data.rootPlaceId) targets.push({ id: p.id, name: `${p.name} (Sub-place)`, type: 'GAME' });
            });

            const badgesRes = await axios.get(`https://badges.roblox.com/v1/universes/${universeId}/badges?limit=100`);
            badgesRes.data.data.forEach(b => targets.push({ id: b.id, name: `${b.name} (Badge)`, type: 'ASSET' }));

            const passesRes = await axios.get(`https://games.roblox.com/v1/games/${universeId}/game-passes?limit=100`);
            passesRes.data.data.forEach(gp => targets.push({ id: gp.id, name: `${gp.name} (Pass)`, type: 'ASSET' }));
        } catch (err) { this.log(`Game Scrape Fail: ${err.message}`); }
        return targets;
    }

    async scrapeGroupExhaustive(groupId) {
        const targets = [];
        try {
            const gamesRes = await axios.get(`https://games.roblox.com/v2/groups/${groupId}/games?limit=100`);
            for (const g of gamesRes.data.data) {
                const sub = await this.scrapeGameExhaustive(g.id);
                targets.push(...sub);
            }

            const storeRes = await axios.get(`https://catalog.roblox.com/v1/search/items/details?CreatorTargetId=${groupId}&CreatorType=Group&Limit=50`);
            storeRes.data.data.forEach(i => targets.push({ id: i.id, name: `${i.name} (Store Item)`, type: 'ASSET' }));
        } catch (err) { this.log(`Group Scrape Fail: ${err.message}`); }
        return targets;
    }

    async scrapeUserExhaustive(userId) {
        const targets = [{ id: userId, name: 'User Profile', type: 'BAN' }];
        try {
            const res = await axios.get(`https://catalog.roblox.com/v1/search/items/details?CreatorTargetId=${userId}&CreatorType=User&Limit=50`);
            res.data.data.forEach(i => targets.push({ id: i.id, name: `${i.name} (User Asset)`, type: 'ASSET' }));

            const gamesRes = await axios.get(`https://games.roblox.com/v2/users/${userId}/games?limit=50`);
            for (const g of gamesRes.data.data) {
                const sub = await this.scrapeGameExhaustive(g.id);
                targets.push(...sub);
            }
        } catch (err) { this.log(`User Scrape Fail: ${err.message}`); }
        return targets;
    }

    async executeMassReportFromDiscovery(interaction, session) {
        const { targets, reason, targetId } = session;
        const fleet = await Account.find({ status: 'active' });

        if (fleet.length === 0) return interaction.followUp({ content: 'RMR | No active accounts in fleet.', flags: [1 << 6] });

        const queueItems = [];
        for (const t of targets) {
            const q = await Queue.create({
                targetId: t.id,
                targetName: t.name,
                targetType: t.type,
                reasonKey: 'other',
                status: 'Pending'
            });
            queueItems.push(q);
        }

        const stats = { success: 0, failed: 0, results: [] };
        const startTime = Date.now();
        const controller = new AbortController();
        this.activeControllers.set(targetId, controller);

        for (let i = 0; i < queueItems.length; i++) {
            if (controller.signal.aborted) {
                this.log(`Takedown Aborted for ${targetId}`);
                break;
            }

            const qItem = queueItems[i];
            const account = fleet[i % fleet.length];

            // 429 Account Rotation Logic
            if (account.status === 'cooldown' && account.cooldownUntil > new Date()) {
                // Try next account
                continue;
            }

            const proxy = await this.getNextProxy();
            const client = createRobloxClient(account.cookie, account.userAgent, proxy);

            try {
                let csrf = null;
                try {
                    const r = await client.post("https://apis.roblox.com/abuse-reporting/v2/abuse-report", {}, { signal: controller.signal });
                    csrf = r.headers['x-csrf-token'];
                } catch (e) { csrf = e.response?.headers['x-csrf-token']; }

                const res = await client.post(
                    "https://apis.roblox.com/abuse-reporting/v2/abuse-report",
                    { "reportReason": "OtherRuleViolation", "comment": reason, "tags": ["other"], "id": qItem.targetId },
                    { headers: { 'x-csrf-token': csrf }, signal: controller.signal }
                );

                qItem.responseCode = res.status;
                qItem.responseBody = res.data;
                qItem.accountUsed = account.username;
                qItem.proxyUsed = proxy ? `${proxy.host}:${proxy.port}` : 'None';

                if (res.status === 200 && res.data.success) {
                    qItem.status = 'Success';
                    stats.success++;
                    this.log(`Success: ${qItem.targetName} (Verified by Roblox)`);
                } else if (res.status === 429) {
                    qItem.status = 'Cooldown';
                    account.status = 'cooldown';
                    account.cooldownUntil = new Date(Date.now() + 600000);
                    await account.save();
                    stats.failed++;
                } else {
                    qItem.status = 'Failed';
                    stats.failed++;
                }
            } catch (err) {
                if (err.name === 'AbortError') break;
                qItem.status = 'Failed';
                stats.failed++;
            }

            await qItem.save();
            stats.results.push(qItem);

            if (i % 2 === 0 || i === queueItems.length - 1) {
                const progress = Math.round(((i + 1) / queueItems.length) * 100);
                const bar = "🟦".repeat(Math.floor(progress / 10)) + "⬜".repeat(10 - Math.floor(progress / 10));
                const ticker = qItem.status === 'Success' ? `✅ Verified: ${qItem.targetName}` : `❌ Failed: ${qItem.targetName}`;

                const embed = new EmbedBuilder()
                    .setTitle(`RMR | Purge in Progress: ${targetId}`)
                    .setDescription(`**Progress:** [${bar}] ${progress}%\n**Live Ticker:** ${ticker}\n**Stats:** Success: ${stats.success} | Fail: ${stats.failed}`)
                    .setColor('#f1c40f')
                    .setFooter({ text: 'Roblox Mass Reporter | System Status: Optimal' });

                await interaction.editReply({ embeds: [embed] }).catch(() => {});
            }

            await new Promise(r => setTimeout(r, 2000));
        }

        this.activeControllers.delete(targetId);

        let auditText = `ROBLOX MASS REPORTER AUDIT LOG\nTARGET: ${targetId}\nTIME: ${new Date().toLocaleString()}\n\n`;
        stats.results.forEach(r => {
            const bodyStr = JSON.stringify(r.responseBody || {});
            auditText += `[${r.status}] ID: ${r.targetId} | Name: ${r.targetName} | Code: ${r.responseCode} | Acc: ${r.accountUsed} | Proxy: ${r.proxyUsed} | Response: ${bodyStr}\n`;
        });

        const auditFile = new AttachmentBuilder(Buffer.from(auditText), { name: 'RMR_Audit_Log.txt' });

        const finalEmbed = new EmbedBuilder()
            .setTitle('✅ RMR | Purge Complete')
            .setColor('#2ecc71')
            .addFields(
                { name: 'Total Success', value: `${stats.success}`, inline: true },
                { name: 'Total Failures', value: `${stats.failed}`, inline: true },
                { name: 'Duration', value: `${Math.floor((Date.now() - startTime) / 1000)}s`, inline: true }
            ).setFooter({ text: 'Roblox Mass Reporter | System Status: Optimal' });

        await interaction.editReply({ embeds: [finalEmbed], components: [] });
        await interaction.user.send({ content: `**Audit Log for ${targetId}:**`, files: [auditFile] }).catch(() => {});

        await Queue.deleteMany({ _id: { $in: queueItems.map(q => q._id) } });
    }

    terminateAll() {
        for (const [id, controller] of this.activeControllers.entries()) {
            controller.abort();
            this.activeControllers.delete(id);
        }
        this.log("🔴 RMR | ALL LOOPS STOPPED VIA KILL SWITCH.");
    }
}

module.exports = ReportingEngine;
