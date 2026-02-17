const createRobloxClient = require('./robloxClient');
const SessionManager = require('./sessionManager');
const Account = require('../models/Account');
const Report = require('../models/Report');
const Queue = require('../models/Queue');
const { EmbedBuilder } = require('discord.js');

class ReportingEngine {
    constructor() {
        this.sessionManager = new SessionManager();
        this.activeControllers = new Map();
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
    }

    async init() {
        await this.sessionManager.loadSessions();
    }

    async forceResetCooldowns() {
        await Account.updateMany(
            {},
            { $set: { status: 'active', cooldownUntil: null } }
        );
        console.log("[ReportingEngine] All account cooldowns have been reset.");
    }

    async processQueue() {
        // Intelligent persistent engine loop with overlap protection
        // Resume pending or in-progress tasks from the database
        const item = await Queue.findOne({ status: { $in: ['Pending', 'In Progress'] } }).sort({ createdAt: 1 });
        if (!item) return;

        console.log(`[ReportingEngine] Checking persistent queue item: ${item.victimUsername}`);

        // If it's been in 'In Progress' for too long, mark as failed
        if (item.status === 'In Progress' && (Date.now() - item.updatedAt) > 600000) {
            item.status = 'Failed';
            await item.save();
        }
    }

    async executeMassReport(interaction, target, reasonKey, delaySec, fleetIds, isRandom) {
        const mapping = this.reasonMap[reasonKey] || this.reasonMap["other"];

        const queueItem = await Queue.create({
            victimUsername: target.username,
            victimId: target.id,
            targetCount: fleetIds.length,
            category: mapping.id,
            status: 'In Progress'
        });

        let accounts = await Account.find({ _id: { $in: fleetIds } });

        if (isRandom) {
            // Fisher-Yates Shuffle
            for (let i = accounts.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [accounts[i], accounts[j]] = [accounts[j], accounts[i]];
            }
        }

        const stats = {
            success: 0,
            failed: 0,
            rateLimit: 0,
            badSession: 0,
            startTime: Date.now()
        };

        const controller = new AbortController();
        this.activeControllers.set(target.id, controller);

        const total = accounts.length;
        let lastUpdate = 0;

        for (let i = 0; i < accounts.length; i++) {
            if (controller.signal.aborted) {
                queueItem.status = 'Terminated';
                await queueItem.save();
                break;
            }

            const account = accounts[i];
            const client = createRobloxClient(account.cookie);
            let csrfToken = null;

            const sendReport = async (token = null) => {
                const headers = {};
                if (token) headers['x-csrf-token'] = token;

                return await client.post(
                    "https://apis.roblox.com/abuse-reporting/v2/abuse-report",
                    {
                        "reportReason": mapping.reason,
                        "comment": "Automation detected terms of service violation.",
                        "tags": mapping.tags,
                        "id": target.id
                    },
                    {
                        signal: controller.signal,
                        headers: headers
                    }
                );
            };

            try {
                let res;
                try {
                    res = await sendReport();
                } catch (err) {
                    if (err.response?.status === 403 && err.response.headers['x-csrf-token']) {
                        // CSRF Guard: Wait user delay and retry once
                        csrfToken = err.response.headers['x-csrf-token'];
                        console.log(`[ReportingEngine] 403 for ${account.username}. Waiting ${delaySec}s before retry...`);
                        await new Promise(r => setTimeout(r, delaySec * 1000));
                        res = await sendReport(csrfToken);
                    } else {
                        throw err;
                    }
                }

                if (res.status === 200) {
                    stats.success++;
                    queueItem.currentCount++;
                    await queueItem.save();
                    await Report.create({
                        victimId: target.id,
                        victimUsername: target.username,
                        reporterId: account.userId,
                        category: mapping.id,
                        status: 'Success'
                    });
                }
            } catch (err) {
                const status = err.response?.status;
                if (status === 429) {
                    stats.rateLimit++;
                    const retryAfter = 600; // 10 minutes per SOP
                    account.status = 'cooldown';
                    account.cooldownUntil = new Date(Date.now() + (retryAfter * 1000));
                    await account.save();
                    console.log(`[ReportingEngine] 429 for ${account.username}. Cooldown for 10m.`);
                } else if (status === 400 || status === 401) {
                    stats.badSession++;
                    account.status = 'dead';
                    await account.save();
                    await Report.create({
                        victimId: target.id,
                        victimUsername: target.username,
                        reporterId: account.userId,
                        category: mapping.id,
                        status: 'Failed',
                        errorCode: status,
                        errorType: 'Token Error / Broken'
                    });
                } else {
                    stats.failed++;
                    await Report.create({
                        victimId: target.id,
                        victimUsername: target.username,
                        reporterId: account.userId,
                        category: mapping.id,
                        status: 'Error',
                        errorCode: status,
                        errorType: err.message
                    });
                }
            }

            // Progress Update (every 3s)
            if (Date.now() - lastUpdate > 3000 || i === total - 1) {
                lastUpdate = Date.now();
                const progress = Math.round(((i + 1) / total) * 100);
                const bar = "█".repeat(Math.floor(progress / 10)) + "░".repeat(10 - Math.floor(progress / 10));

                const embed = new EmbedBuilder()
                    .setTitle(`Reporting ${target.username}...`)
                    .setDescription(`**Progress:** [${bar}] ${progress}%\n**Current:** ${i + 1} of ${total} accounts`)
                    .setColor('#f1c40f');

                await interaction.editReply({ embeds: [embed], components: [] }).catch(() => {});
            }

            if (i < accounts.length - 1) {
                await new Promise(r => setTimeout(r, delaySec * 1000));
            }
        }

        if (queueItem.status !== 'Terminated') {
            queueItem.status = 'Completed';
            await queueItem.save();
        }

        this.activeControllers.delete(target.id);

        // Final After-Action Report
        const duration = Math.floor((Date.now() - stats.startTime) / 1000);
        const finalEmbed = new EmbedBuilder()
            .setTitle('📊 After-Action Report')
            .setColor('#2ecc71')
            .addFields(
                { name: 'Successes', value: `${stats.success}`, inline: true },
                { name: 'Failures', value: `${stats.failed + stats.badSession}`, inline: true },
                { name: 'Rate Limits (429)', value: `${stats.rateLimit}`, inline: true },
                { name: 'Total Time', value: `${duration} seconds`, inline: true }
            )
            .setFooter({ text: 'Mission Summary' })
            .setTimestamp();

        await interaction.followUp({ embeds: [finalEmbed] });
    }

    async getAvailableSession() {
        return await Account.findOne({
            status: 'active',
            $or: [{ cooldownUntil: null }, { cooldownUntil: { $lte: new Date() } }]
        }).sort({ lastUsed: 1 });
    }

    terminateAll() {
        for (const controller of this.activeControllers.values()) {
            controller.abort();
        }
        this.activeControllers.clear();
    }
}

module.exports = ReportingEngine;
