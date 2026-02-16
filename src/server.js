require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
const connectDB = require('./core/database');
const ReportingEngine = require('./core/reportingEngine');
const setupCommands = require('./commands');
const Queue = require('./models/Queue');
const Account = require('./models/Account');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Middleware
app.use(express.static(path.join(__dirname, 'web/public')));

// Initialize Core
const engine = new ReportingEngine();
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const commands = setupCommands(engine);

// Database & Engine Loop
let isProcessing = false;
connectDB().then(async () => {
    await engine.init();

    // Intelligent persistent engine loop with overlap protection
    setInterval(async () => {
        if (isProcessing) return;
        isProcessing = true;
        try {
            await engine.processQueue();
        } finally {
            isProcessing = false;
        }
    }, 10000);
});

// Discord Bot Event Handler
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const command = commands.find(c => c.data.name === interaction.commandName);
    if (command) await command.execute(interaction);
});

// Socket.io Real-time Push
io.on('connection', (socket) => {
    const pushUpdates = async () => {
        const queue = await Queue.find().sort({ createdAt: -1 }).limit(10);
        const activeCount = await Account.countDocuments({ status: 'Active' });
        socket.emit('dashboardUpdate', { queue, activeCount });
    };
    const interval = setInterval(pushUpdates, 5000);
    socket.on('disconnect', () => clearInterval(interval));
});

// Global REST Command Registration
const register = async () => {
    if (!process.env.DISCORD_TOKEN || !process.env.CLIENT_ID) return;
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands.map(c => c.data.toJSON()) }
        );
        console.log("[Discord] Commands Registered.");
    } catch (err) { console.error("[Discord] Registration Fail:", err); }
};

if (process.env.DISCORD_TOKEN && process.env.CLIENT_ID) {
    register();
    client.login(process.env.DISCORD_TOKEN);
}

// Start Server
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`[System] Robot Suite active on port ${PORT}`);
});
