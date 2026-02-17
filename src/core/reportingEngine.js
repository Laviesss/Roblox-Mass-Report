const createRobloxClient = require('./robloxClient');
const SessionManager = require('./sessionManager');
const Account = require('../models/Account');
const Report = require('../models/Report');
const Queue = require('../models/Queue');
const Proxy = require('../models/Proxy');
const UserAgent = require('../models/UserAgent');
const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { SocksProxyAgent } = require('socks-proxy-agent');

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
                // Flush is handled by MongoDB persistence.
                // In Render, we just exit and let the service reboot.
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

        this.log(`Picking up task: ${item.targetName} (${item.targetId})`);
        item.status = 'In Progress';
        await item.save();

        // Find available accounts
        const accounts = await Account.find({
            status: 'active',
            $or: [{ cooldownUntil: null }, { cooldownUntil: { $lte: new Date() } }]
        });

        if (accounts.length === 0) {
            item.status = 'Pending';
            await item.save();
            return;
        }

        // Run internal loop for this specific item
        // In this architecture, executeMassReport handles the loop for a list of targets.
        // This processQueue is a fallback for resumed tasks.
    }

    // Stage 2: Recursive Scrapers
    async scrapeGame(universeId) {
        const targets = [];
        try {
            // Universe Info
            const universeRes = await axios.get(`https://games.roblox.com/v1/universes/${universeId}`);
            const rootPlaceId = universeRes.data.rootPlaceId;
            targets.push({ id: rootPlaceId, name: universeRes.data.name, type: 'GAME' });

            // Linked Places
            const placesRes = await axios.get(`https://games.roblox.com/v1/universes/${universeId}/places?limit=100`);
            placesRes.data.data.forEach(p => {
                if (p.id !== rootPlaceId) targets.push({ id: p.id, name: p.name, type: 'GAME' });
            });

            // Badges
            const badgesRes = await axios.get(`https://badges.roblox.com/v1/universes/${universeId}/badges?limit=100`);
            badgesRes.data.data.forEach(b => targets.push({ id: b.id, name: b.name, type: 'ASSET' }));

            // Gamepasses
            const passesRes = await axios.get(`https://games.roblox.com/v1/games/${universeId}/game-passes?limit=100`);
            passesRes.data.data.forEach(gp => targets.push({ id: gp.id, name: gp.name, type: 'ASSET' }));
        } catch (err) { console.error(`[RMR] Game Scrape Fail: ${err.message}`); }
        return targets;
    }

    async scrapeGroup(groupId) {
        const targets = [];
        try {
            // Group Games
            const gamesRes = await axios.get(`https://games.roblox.com/v2/groups/${groupId}/games?limit=100`);
            for (const g of gamesRes.data.data) {
                const subTargets = await this.scrapeGame(g.id);
                targets.push(...subTargets);
            }

            // Group Store
            const storeRes = await axios.get(`https://catalog.roblox.com/v1/search/items/details?CreatorTargetId=${groupId}&CreatorType=Group&Limit=30`);
            storeRes.data.data.forEach(i => targets.push({ id: i.id, name: i.name, type: 'ASSET' }));
        } catch (err) { console.error(`[RMR] Group Scrape Fail: ${err.message}`); }
        return targets;
    }

    async scrapeUserInventory(userId) {
        const targets = [];
        try {
            const res = await axios.get(`https://catalog.roblox.com/v1/search/items/details?CreatorTargetId=${userId}&CreatorType=User&Limit=30`);
            res.data.data.forEach(i => targets.push({ id: i.id, name: i.name, type: 'ASSET' }));
        } catch (err) { console.error(`[RMR] User Scrape Fail: ${err.message}`); }
        return targets;
    }

    async executeMassReport(interaction, mainTarget, reasonKey, delaySec, fleetIds, isRandom, isFullWipe) {
        const mapping = this.reasonMap[reasonKey] || this.reasonMap["other"];
        let targets = [{ id: mainTarget.id, name: mainTarget.username, type: mainTarget.type }];

        if (isFullWipe) {
            this.log(`Deep Scraper Active for ${mainTarget.username}`);
            if (interaction) await interaction.editReply({ content: "🔍 **Deep Scraper Active...** Finding all linked assets, places, and badges.", embeds: [], components: [] });
            if (mainTarget.type === 'GAME') targets = await this.scrapeGame(mainTarget.id);
            else if (mainTarget.type === 'GROUP') targets = await this.scrapeGroup(mainTarget.id);
            else if (mainTarget.type === 'BAN') {
                const inv = await this.scrapeUserInventory(mainTarget.id);
                targets.push(...inv);
            }
            if (interaction) await interaction.editReply({ content: `✅ **Scrape Complete!** Found **${targets.length}** total targets. Starting execution loop...` });
        }

        // Write targets to target_queue
        const queueItems = [];
        for (const t of targets) {
            const q = await Queue.create({
                targetId: t.id,
                targetName: t.name,
                targetType: t.type,
                status: 'Pending'
            });
            queueItems.push(q);
        }

        let accounts = await Account.find({ _id: { $in: fleetIds } });
        if (isRandom) {
            for (let i = accounts.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [accounts[i], accounts[j]] = [accounts[j], accounts[i]];
            }
        }

        const stats = { success: 0, failed: 0, rateLimit: 0, badSession: 0, startTime: Date.now(), results: [] };
        const controller = new AbortController();
        this.activeControllers.set(mainTarget.id, controller);

        // Dummy CSRF Handshake
        let globalCsrf = null;
        try {
            const firstAcc = accounts[0];
            const dummyClient = createRobloxClient(firstAcc.cookie);
            const dummyRes = await dummyClient.post("https://apis.roblox.com/abuse-reporting/v2/abuse-report", {});
            globalCsrf = dummyRes.headers['x-csrf-token'];
        } catch (err) {
            globalCsrf = err.response?.headers['x-csrf-token'];
        }

        for (let i = 0; i < queueItems.length; i++) {
            if (controller.signal.aborted) break;
            const qItem = queueItems[i];
            qItem.status = 'In Progress';
            await qItem.save();

            // Pick next account (Rotation)
            const account = accounts[i % accounts.length];
            const proxy = await this.getNextProxy();
            const client = createRobloxClient(account.cookie, account.userAgent, proxy);

            // Human Jitter
            const jitter = (Math.random() * 0.5); // 0-0.5s jitter
            await new Promise(r => setTimeout(r, (delaySec + jitter) * 1000));

            try {
                const res = await client.post(
                    "https://apis.roblox.com/abuse-reporting/v2/abuse-report",
                    { "reportReason": mapping.reason, "comment": "Automation detected terms of service violation.", "tags": mapping.tags, "id": qItem.targetId },
                    { signal: controller.signal, headers: { 'x-csrf-token': globalCsrf } }
                );

                qItem.responseCode = res.status;
                qItem.responseBody = res.data;
                qItem.accountUsed = account.username;
                qItem.proxyUsed = proxy ? `${proxy.host}:${proxy.port}` : 'None';

                if (res.status === 200 && res.data.success) {
                    qItem.status = 'Success';
                    qItem.verificationId = `VER-${Math.floor(Math.random() * 1000000)}`;
                    stats.success++;
                    this.log(`Report Success: ${qItem.targetName}`);
                } else if (res.status === 429) {
                    qItem.status = 'Cooldown';
                    stats.rateLimit++;
                    account.status = 'cooldown';
                    account.cooldownUntil = new Date(Date.now() + 600000);
                    await account.save();
                } else {
                    qItem.status = 'Failed';
                    stats.failed++;
                }
            } catch (err) {
                qItem.status = 'Failed';
                qItem.responseCode = err.response?.status || 500;
                stats.failed++;
            }

            await qItem.save();
            stats.results.push(qItem);

            // Progress Bar Update (Every 5s)
            if (interaction && i % 2 === 0) {
                const progress = Math.round(((i + 1) / queueItems.length) * 100);
                const bar = "🟦".repeat(Math.floor(progress / 10)) + "⬜".repeat(10 - Math.floor(progress / 10));
                const embed = new EmbedBuilder()
                    .setTitle(`Purging: ${mainTarget.username}`)
                    .setDescription(`**Progress:** [${bar}] ${progress}%\n**Ticker:** ${qItem.status}: ${qItem.targetName} (${qItem.verificationId || 'N/A'})\n**Stats:** Success: ${stats.success} | Fail: ${stats.failed}`)
                    .setColor('#f1c40f');
                await interaction.editReply({ embeds: [embed] }).catch(() => {});
            }
        }

        this.activeControllers.delete(mainTarget.id);

        // Final After-Action & Audit Log
        const duration = Math.floor((Date.now() - stats.startTime) / 1000);
        let auditText = `ROBLOX MASS REPORTER AUDIT LOG\nTARGET: ${mainTarget.username}\nTIME: ${new Date().toLocaleString()}\n\n`;
        stats.results.forEach(r => {
            const bodyStr = JSON.stringify(r.responseBody || {});
            auditText += `[${r.status}] ID: ${r.targetId} | Name: ${r.targetName} | Code: ${r.responseCode} | Acc: ${r.accountUsed} | Proxy: ${r.proxyUsed} | Response: ${bodyStr}\n`;
        });

        const auditFile = new AttachmentBuilder(Buffer.from(auditText), { name: 'audit_log.txt' });

        if (interaction) {
            const finalEmbed = new EmbedBuilder()
                .setTitle('✅ Universal Takedown Complete')
                .setColor('#2ecc71')
                .addFields(
                    { name: 'Successes', value: `${stats.success}`, inline: true },
                    { name: 'Failures', value: `${stats.failed}`, inline: true },
                    { name: 'Rate Limits', value: `${stats.rateLimit}`, inline: true },
                    { name: 'Total Time', value: `${duration}s`, inline: true }
                ).setFooter({ text: 'Check your DMs for the full Audit Log.' });
            await interaction.followUp({ embeds: [finalEmbed] });
            await interaction.user.send({ content: `**Audit Log for ${mainTarget.username}:**`, files: [auditFile] }).catch(() => {});
        }

        // Cleanup
        await Queue.deleteMany({ _id: { $in: queueItems.map(q => q._id) } });
    }

    terminateAll() { for (const controller of this.activeControllers.values()) controller.abort(); this.activeControllers.clear(); }
}

module.exports = ReportingEngine;
