module.exports = {
  apps: [{
    name: "roblox-robot-suite",
    script: "./src/server.js",
    watch: false,
    autorestart: true,
    env: {
      NODE_ENV: "development",
      MONGODB_URI: "mongodb://localhost:27017/roblox-suite"
    },
    env_production: {
      NODE_ENV: "production"
    }
  }]
};
