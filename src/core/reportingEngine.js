const createRobloxClient = require('./robloxClient');
const SessionManager = require('./sessionManager');
const Report = require('../models/Report');
const Queue = require('../models/Queue');
const cheerio = require('cheerio');

class ReportingEngine {
    constructor() {
        this.sessionManager = new SessionManager();
    }

    async init() {
        await this.sessionManager.loadSessions();
    }

    async processQueue() {
        const item = await Queue.findOne({ status: 'Pending' }).sort({ createdAt: 1 });
        if (!item) return;

        console.log(`[ReportingEngine] Processing Queue: ${item.victimUsername}`);
        item.status = 'In Progress';
        await item.save();

        try {
            await this.runMassReport(item);
            item.status = 'Completed';
        } catch (err) {
            console.error(`[ReportingEngine] Queue Item Failed: ${err.message}`);
            item.status = 'Failed';
        }
        await item.save();
    }

    async runMassReport(queueItem) {
        const { victimId, targetCount, category } = queueItem;

        for (let i = 0; i < targetCount; i++) {
            const session = await this.sessionManager.getRandomSession();
            if (!session) throw new Error("No active sessions");

            const client = createRobloxClient(session.cookie);
            const comment = "Violation detected"; // Should be dynamic

            try {
                // Get verification token
                const buildPage = await client.get("https://www.roblox.com/build/upload");
                const $ = cheerio.load(buildPage.data);
                const verificationToken = $('input[name="__RequestVerificationToken"]').val();

                const response = await client.post(
                    `https://www.roblox.com/abusereport/userprofile?id=${victimId}`,
                    new URLSearchParams({
                        "__RequestVerificationToken": verificationToken,
                        "ReportCategory": category,
                        "Comment": comment,
                        "Id": victimId,
                        "RedirectUrl": `https://www.roblox.com/users/${victimId}/profile`,
                        "PartyGuid": "",
                        "ConversationId": ""
                    })
                );

                if (response.status === 200) {
                    queueItem.currentCount++;
                    await queueItem.save();
                    await Report.create({
                        victimId,
                        victimUsername: queueItem.victimUsername,
                        reporterId: session.userId,
                        category,
                        comment,
                        status: 'Success'
                    });
                }
            } catch (err) {
                console.error(`[ReportingEngine] Report failed: ${err.message}`);
            }

            // Simple delay
            await new Promise(r => setTimeout(r, 2000));
        }
    }
}

module.exports = ReportingEngine;
