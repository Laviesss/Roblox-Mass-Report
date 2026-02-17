const mongoose = require('mongoose');

const ProxySchema = new mongoose.Schema({
    host: String,
    port: Number,
    protocol: { type: String, default: 'http' }, // http, socks4, socks5
    latency: { type: Number, default: -1 },
    status: { type: String, default: 'active' }, // active, dead
    lastChecked: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Proxy', ProxySchema);
