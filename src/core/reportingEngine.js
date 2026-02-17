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
        await Account.updateMany({}, { $set: { status: 'active', cooldownUntil: null } });
    }

    // The Persistent Engine worker
    async processQueue() {
        const item = await Queue.findOne({ status: { $in: ['Pending', 'In Progress'] } }).sort({ createdAt: 1 });
        if (!item) return;

        // If it's already in progress and hasn't timed out, assume another process is handling it
        // (Though in this architecture there's usually only one loop)
        if (item.status === 'In Progress' && (Date.now() - item.updatedAt) < 300000) return;

        console.log(`[Engine] Resuming/Starting task for: ${item.victimUsername}`);
        item.status = 'In Progress';
        await item.save();

        // Find available accounts if fleet wasn't specified (fallback)
        const accounts = await Account.find({
            status: 'active',
            $or: [{ cooldownUntil: null }, { cooldownUntil: { $lte: new Date() } }]
        }).limit(item.targetCount - item.currentCount);

        if (accounts.length === 0) {
            console.log("[Engine] No accounts available for background task. Waiting...");
            return;
        }

        // Run the mass report logic (Simplified for background resume)
        // In a real production system, item would store its fleet IDs.
        await this.internalLoop(null, { id: item.victimId, username: item.victimUsername }, item.category, 5, accounts, false, item);
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
        await this.internalLoop(interaction, target, reasonKey, delaySec, accounts, isRandom, queueItem);
    }

    async internalLoop(interaction, target, reasonKey, delaySec, accounts, isRandom, queueItem) {
        const mapping = typeof reasonKey === 'string' ? (this.reasonMap[reasonKey] || this.reasonMap["other"]) : { id: reasonKey, reason: "OtherRuleViolation", tags: ["other"] };

        if (isRandom) {
            for (let i = accounts.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [accounts[i], accounts[j]] = [accounts[j], accounts[i]];
            }
        }

        const stats = { success: 0, failed: 0, rateLimit: 0, badSession: 0, startTime: Date.now() };
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

            try {
                const res = await client.post(
                    "https://apis.roblox.com/abuse-reporting/v2/abuse-report",
                    {
                        "reportReason": mapping.reason,
                        "comment": "Automation detected terms of service violation.",
                        "tags": mapping.tags,
                        "id": target.id
                    },
                    { signal: controller.signal }
                );

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
                    account.status = 'cooldown';
                    account.cooldownUntil = new Date(Date.now() + 600000);
                    await account.save();
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
                        errorType: 'Broken Session'
                    });
                } else {
                    stats.failed++;
                }
            }

            // Progress Update every 3s
            if (interaction && (Date.now() - lastUpdate > 3000 || i === total - 1)) {
                lastUpdate = Date.now();
                const progress = Math.round(((i + 1) / total) * 100);
                const bar = "█".repeat(Math.floor(progress / 10)) + "░".repeat(10 - Math.floor(progress / 10));
                const embed = new EmbedBuilder()
                    .setTitle(`Working on ${target.username}...`)
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

        if (interaction) {
            const duration = Math.floor((Date.now() - stats.startTime) / 1000);
            const finalEmbed = new EmbedBuilder()
                .setTitle('📊 After-Action Report')
                .setColor('#2ecc71')
                .addFields(
                    { name: 'Successes', value: `${stats.success}`, inline: true },
                    { name: 'Failures', value: `${stats.failed + stats.badSession}`, inline: true },
                    { name: 'Rate Limits', value: `${stats.rateLimit}`, inline: true },
                    { name: 'Total Time', value: `${duration}s`, inline: true }
                ).setTimestamp();
            await interaction.followUp({ embeds: [finalEmbed] });
        }
    }

    terminateAll() {
        for (const controller of this.activeControllers.values()) controller.abort();
        this.activeControllers.clear();
    }
}

module.exports = ReportingEngine;
