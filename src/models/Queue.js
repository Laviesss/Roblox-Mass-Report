const mongoose = require('mongoose');

const QueueSchema = new mongoose.Schema({
    victimUsername: String,
    victimId: String,
    targetCount: Number,
    currentCount: { type: Number, default: 0 },
    category: Number,
    status: { type: String, default: 'Pending' }, // Pending, In Progress, Completed, Failed, Terminated
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Queue', QueueSchema);
