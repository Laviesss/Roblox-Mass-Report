module.exports = {
  apps: [{
    name: "Roblox-Mass-Reporter",
    script: "./src/server.js",
    watch: false,
    autorestart: true,
    env_file: ".env",
    env: {
      NODE_ENV: "development"
    },
    env_production: {
      NODE_ENV: "production"
    }
  }]
};
