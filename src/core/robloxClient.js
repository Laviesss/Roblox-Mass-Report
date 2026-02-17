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

    // CSRF and Error Interceptor
    robloxClient.interceptors.response.use(
        res => res,
        async err => {
            const { config, response } = err;

            // Handle 403 CSRF with a mandatory wait period
            if (response?.status === 403 && response.headers['x-csrf-token']) {
                console.log("[RobloxClient] 403 Detected. Waiting 2s before retry...");
                await new Promise(r => setTimeout(r, 2000));
                config.headers['x-csrf-token'] = response.headers['x-csrf-token'];
                return robloxClient(config);
            }

            // Other errors (400, 429) are passed back to the engine
            return Promise.reject(err);
        }
    );

    return robloxClient;
};

module.exports = createRobloxClient;
