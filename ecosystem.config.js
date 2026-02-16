module.exports = {
  apps: [{
    name: "Roblox-Mass-Reporter",
    script: "./src/server.js",
    env_file: ".env",
    env: {
      NODE_ENV: "development"
    }
  }]
};
