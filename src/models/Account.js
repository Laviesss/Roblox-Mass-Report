const mongoose = require('mongoose');

const AccountSchema = new mongoose.Schema({
    username: String,
    userId: String,
    cookie: String,
    status: { type: String, default: 'Active' },
    lastUsed: { type: Date, default: Date.now },
    addedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Account', AccountSchema);
