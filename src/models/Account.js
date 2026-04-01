const mongoose = require('mongoose');

const AccountSchema = new mongoose.Schema({
    username: String,
    userId: String,
    cookie: String,
    userAgent: String, // Sticky User-Agent
    proxy: String,     // Optional: if we want sticky proxy too, but SOP says Proxy Rotation
    status: { type: String, default: 'active' }, // active, cooldown, dead
    cooldownUntil: { type: Date, default: null },
    last_checked: { type: Date, default: Date.now },
    addedAt: { type: Date, default: Date.now }
}, { collection: 'sessions' });

module.exports = mongoose.model('Account', AccountSchema);
