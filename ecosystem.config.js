module.exports = {
  apps: [{
    name: "roblox-management-suite",
    script: "./src/server.js",
    watch: false,
    autorestart: true,
    env: {
      NODE_ENV: "development",
      MONGODB_URI: "mongodb://localhost:27017/roblox-management-suite"
    },
    env_production: {
      NODE_ENV: "production"
    }
  }]
};
