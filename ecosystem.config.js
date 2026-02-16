module.exports = {
  apps: [{
    name: "roblox-robot-suite",
    script: "./src/server.js",
    env_file: ".env",
    watch: false,
    autorestart: true,
    env: {
      NODE_ENV: "development"
    },
    env_production: {
      NODE_ENV: "production"
    }
  }]
};
