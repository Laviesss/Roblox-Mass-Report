module.exports = {
  apps: [{
    name: "roblox-bot-node",
    script: "./src/bot.js",
    watch: false,
    autorestart: true,
    env: {
      NODE_ENV: "production",
    }
  }]
};
