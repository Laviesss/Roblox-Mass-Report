module.exports = {
  apps: [{
    name: "roblox-bot-node",
    script: "./src/server.js",
    watch: false,
    autorestart: true,
    env: {
      NODE_ENV: "production",
    }
  }]
};
