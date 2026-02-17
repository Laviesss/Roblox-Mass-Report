const axios = require('axios');

const createRobloxClient = (cookie) => {
    const robloxClient = axios.create({
        headers: {
            'Cookie': `.ROBLOSECURITY=${cookie}`,
            'Content-Type': 'application/json',
            'Referer': 'https://www.roblox.com'
        },
        timeout: 10000
    });

    // CSRF Interceptor
    robloxClient.interceptors.response.use(
        res => res,
        async err => {
            const { config, response } = err;

            // If 403 CSRF error, grab new token and retry once
            if (response?.status === 403 && response.headers['x-csrf-token']) {
                console.log("[RobloxClient] 403 CSRF Detected. Retrying with new token...");
                config.headers['x-csrf-token'] = response.headers['x-csrf-token'];
                // We don't wait here because the Engine handles the delay between accounts,
                // but for a single retry, immediate is usually fine if token was missing.
                return robloxClient(config);
            }

            return Promise.reject(err);
        }
    );

    return robloxClient;
};

module.exports = createRobloxClient;
