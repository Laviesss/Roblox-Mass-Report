const axios = require('axios');

const createRobloxClient = (cookie) => {
    const client = axios.create({
        headers: {
            'Cookie': `.ROBLOSECURITY=${cookie}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Referer': 'https://www.roblox.com'
        }
    });

    // 2026-Ready CSRF Auth Interceptor
    client.interceptors.response.use(
        (response) => response,
        async (error) => {
            const { config, response } = error;
            if (response && response.status === 403 && response.headers['x-csrf-token']) {
                console.log("[RobloxClient] CSRF Token expired/missing. Retrying with new token...");
                const newToken = response.headers['x-csrf-token'];
                config.headers['X-CSRF-TOKEN'] = newToken;
                return client(config);
            }
            return Promise.reject(error);
        }
    );

    return client;
};

module.exports = createRobloxClient;
