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
        validateStatus: (status) => status < 500
    };

    if (proxy) {
        if (proxy.protocol.startsWith('socks')) {
            config.httpsAgent = new SocksProxyAgent(`${proxy.protocol}://${proxy.host}:${proxy.port}`);
        } else {
            config.httpsAgent = new HttpsProxyAgent(`http://${proxy.host}:${proxy.port}`);
        }
    }

    const client = axios.create(config);

    // Mandator Logic Fix: 403 CSRF Retrier & 429 Interceptor
    client.interceptors.response.use(async (response) => {
        // Handle CSRF Handshake
        if (response.status === 403 && response.headers['x-csrf-token']) {
            const newToken = response.headers['x-csrf-token'];
            const originalRequest = response.config;
            originalRequest.headers['x-csrf-token'] = newToken;

            // Log for internal tracking if needed
            console.log(`[RMR] CSRF Handshake Triggered: Token Refreshed.`);

            // Retry the original request once
            return client(originalRequest);
        }
        return response;
    }, (error) => {
        return Promise.reject(error);
    });

    return client;
};

module.exports = createRobloxClient;
