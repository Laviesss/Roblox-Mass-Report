const mongoose = require('mongoose');

const ReportSchema = new mongoose.Schema({
    victimId: String,
    victimUsername: String,
    reporterId: String,
    category: Number,
    comment: String,
    status: String,
    errorCode: Number,
    errorType: String,
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Report', ReportSchema);
