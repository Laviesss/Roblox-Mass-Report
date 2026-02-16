const createRobloxClient = require('./robloxClient');
const SessionManager = require('./sessionManager');
const Account = require('../models/Account');
const Report = require('../models/Report');
const Queue = require('../models/Queue');

class ReportingEngine {
    constructor() {
        this.sessionManager = new SessionManager();
        this.activeControllers = new Map(); // victimId -> AbortController
    }

    async init() {
        await this.sessionManager.loadSessions();
    }

    async processQueue() {
        const item = await Queue.findOne({ status: { $in: ['Pending', 'In Progress'] } }).sort({ createdAt: 1 });
        if (!item) return;

        if (item.status === 'Pending') {
            item.status = 'In Progress';
            await item.save();
        }

        console.log(`[ReportingEngine] Processing: ${item.victimUsername} (${item.currentCount}/${item.targetCount})`);

        try {
            await this.runMassReport(item);
            if (item.currentCount >= item.targetCount) {
                item.status = 'Completed';
            }
        } catch (err) {
            if (err.name === 'AbortError') {
                console.log(`[ReportingEngine] Task aborted for ${item.victimUsername}`);
                item.status = 'Terminated';
            } else {
                console.error(`[ReportingEngine] Fatal error for ${item.victimUsername}: ${err.message}`);
                item.status = 'Failed';
            }
        }
        await item.save();
    }

    async runMassReport(queueItem) {
        const controller = new AbortController();
        this.activeControllers.set(queueItem.victimId, controller);

        while (queueItem.currentCount < queueItem.targetCount) {
            if (controller.signal.aborted) throw { name: 'AbortError' };

            const session = await this.getAvailableSession();
            if (!session) {
                console.error("[ReportingEngine] No available sessions (all cooled down or none loaded). Waiting...");
                await new Promise(r => setTimeout(r, 30000));
                continue;
            }

            const client = createRobloxClient(session.cookie);

            try {
                // 4. Payload Modernization (V2 API)
                const payload = {
                    "reportReason": "Violation",
                    "comment": "Automation detected violation.",
                    "tags": ["harassment"],
                    "id": queueItem.victimId
                };

                const res = await client.post(
                    "https://apis.roblox.com/abuse-reporting/v2/abuse-report",
                    payload,
                    { signal: controller.signal }
                );

                if (res.status === 200) {
                    queueItem.currentCount++;
                    await queueItem.save();
                    await Report.create({
                        victimId: queueItem.victimId,
                        victimUsername: queueItem.victimUsername,
                        reporterId: session.userId,
                        category: queueItem.category,
                        comment: payload.comment,
                        status: 'Success'
                    });
                    console.log(`[ReportingEngine] Success [${queueItem.currentCount}/${queueItem.targetCount}] using ${session.username}`);
                }
            } catch (err) {
                if (err.name === 'AbortError') throw err;

                const status = err.response?.status;
                const retryAfter = parseInt(err.response?.headers['retry-after']) || 60;

                if (status === 429) {
                    // 3. Rate Limit Blindness (429 Handling)
                    console.warn(`[ReportingEngine] 429 for ${session.username}. Cooling down for ${retryAfter}s`);
                    session.cooldownUntil = new Date(Date.now() + (retryAfter * 1000));
                    session.status = 'cooldown'; // Case consistency
                    await session.save();
                } else {
                    console.error(`[ReportingEngine] Request failed for ${session.username}: ${err.message}`);
                }
            }

            await new Promise(r => setTimeout(r, 2000)); // Rate limit buffer
        }

        this.activeControllers.delete(queueItem.victimId);
    }

    async getAvailableSession() {
        // Find an active session that isn't in cooldown
        let session = await Account.findOne({
            status: 'active', // Changed from 'Active' for consistency
            $or: [
                { cooldownUntil: null },
                { cooldownUntil: { $lte: new Date() } }
            ]
        }).sort({ lastUsed: 1 });

        if (!session) return null;

        session.lastUsed = new Date();
        await session.save();
        return session;
    }

    terminateAll() {
        console.log("[ReportingEngine] Kill Switch Triggered. Aborting all loops...");
        for (const controller of this.activeControllers.values()) {
            controller.abort();
        }
        this.activeControllers.clear();
    }
}

module.exports = ReportingEngine;
