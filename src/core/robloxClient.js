const axios = require('axios');

const createRobloxClient = (cookie) => {
    const robloxClient = axios.create({
        headers: {
            'Cookie': `.ROBLOSECURITY=${cookie}`,
            'Content-Type': 'application/json',
            'Referer': 'https://www.roblox.com'
        }
    });

    // 1. The "Auth Wall" Fix (CSRF Interceptor)
    robloxClient.interceptors.response.use(
        res => res,
        async err => {
            const { config, response } = err;

            // Handle 403 CSRF
            if (response?.status === 403 && response.headers['x-csrf-token']) {
                console.log("[RobloxClient] 403 Detected. Refreshing X-CSRF-TOKEN and retrying...");
                config.headers['x-csrf-token'] = response.headers['x-csrf-token'];
                return robloxClient(config);
            }

            // Handle 429 Rate Limit (Just pass it along, the engine will handle DB cooldown)
            if (response?.status === 429) {
                console.warn("[RobloxClient] 429 Rate Limited.");
            }

            return Promise.reject(err);
        }
    );

    return robloxClient;
};

module.exports = createRobloxClient;
