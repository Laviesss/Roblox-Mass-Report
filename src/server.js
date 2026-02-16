require('dotenv').config();
const express = require('express');
const { Client, GatewayIntentBits } = require('discord.js');
const RobloxBot = require('./bot');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Roblox Bot
const robloxBot = new RobloxBot();

// Express Dashboard
app.get('/', (req, res) => {
    res.send('<h1>Roblox Mass Report Suite Dashboard</h1><p>Status: Online</p>');
});

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', environment: process.env.RENDER ? 'Render Cloud' : 'Local PC' });
});

// Start Express Server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Dashboard] Server running on http://0.0.0.0:${PORT}`);
    console.log(`[Dashboard] Environment: ${process.env.RENDER ? 'Render Cloud' : 'Local PC'}`);
});

// Initialize Discord Bot
const discordClient = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

discordClient.once('ready', () => {
    console.log(`[Discord] Logged in as ${discordClient.user.tag}`);
});

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
if (DISCORD_TOKEN && DISCORD_TOKEN !== 'your_discord_token_here') {
    discordClient.login(DISCORD_TOKEN).catch(err => {
        console.error("[Discord] Login failed:", err.message);
    });
} else {
    console.warn("[Discord] No valid DISCORD_TOKEN found in environment. Bot client not started.");
}

// Initialize Roblox Bot (load cookies)
robloxBot.init().then(() => {
    console.log("[Bot] Roblox Bot initialized and ready.");

    // Auto-start if configured in env
    if (process.env.AUTO_START === 'true' && process.env.VICTIM_USERNAME) {
        const username = process.env.VICTIM_USERNAME;
        const count = parseInt(process.env.REPORT_COUNT) || 0;
        const category = parseInt(process.env.REPORT_CATEGORY) || 1;
        const cooldown = parseInt(process.env.COOLDOWN) || 5;

        console.log(`[Bot] Auto-starting mass report for ${username}...`);
        robloxBot.runMassReport(username, count, category, cooldown);
    }
});
