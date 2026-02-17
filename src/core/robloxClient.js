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

    // Simple interceptor to pass through errors so the Engine can handle retries
    robloxClient.interceptors.response.use(
        res => res,
        err => {
            // We just pass the error back. The Engine will check for status 403 and the x-csrf-token header.
            return Promise.reject(err);
        }
    );

    return robloxClient;
};

module.exports = createRobloxClient;
