const mongoose = require('mongoose');

const AccountSchema = new mongoose.Schema({
    username: String,
    userId: String,
    cookie: String,
    status: { type: String, default: 'active' }, // active, cooldown, dead
    cooldownUntil: { type: Date, default: null },
    last_checked: { type: Date, default: Date.now },
    addedAt: { type: Date, default: Date.now }
}, { collection: 'sessions' });

module.exports = mongoose.model('Account', AccountSchema);
