const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { SocksProxyAgent } = require('socks-proxy-agent');

const createRobloxClient = (cookie, userAgent = null, proxy = null) => {
    const headers = {
        'Cookie': `.ROBLOSECURITY=${cookie}`,
        'Content-Type': 'application/json',
        'Referer': 'https://www.roblox.com'
    };

    if (userAgent) {
        headers['User-Agent'] = userAgent;
    }

    const config = {
        headers,
        timeout: 15000,
        validateStatus: (status) => status < 500 // Let engine handle 403/429/400
    };

    if (proxy) {
        if (proxy.protocol.startsWith('socks')) {
            config.httpsAgent = new SocksProxyAgent(`${proxy.protocol}://${proxy.host}:${proxy.port}`);
        } else {
            config.httpsAgent = new HttpsProxyAgent(`http://${proxy.host}:${proxy.port}`);
        }
    }

    return axios.create(config);
};

module.exports = createRobloxClient;
