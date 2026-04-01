const mongoose = require('mongoose');

const UserAgentSchema = new mongoose.Schema({
    ua: String,
    addedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('UserAgent', UserAgentSchema);
