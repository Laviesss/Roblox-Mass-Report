const mongoose = require('mongoose');

const QueueSchema = new mongoose.Schema({
    targetId: String,
    targetType: String, // BAN, ASSET, GAME, GROUP
    targetName: String,
    parentTargetId: String, // For linking sub-items to a main scrape
    status: { type: String, default: 'Pending' }, // Pending, In Progress, Success, Failed, Cooldown
    responseCode: Number,
    responseBody: mongoose.Schema.Types.Mixed,
    verificationId: String,
    accountUsed: String,
    proxyUsed: String,
}, { timestamps: true, collection: 'target_queue' });

module.exports = mongoose.model('Queue', QueueSchema);
