require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
const connectDB = require('./core/database');
const ReportingEngine = require('./core/reportingEngine');
const commands = require('./commands');
const Queue = require('./models/Queue');
const Account = require('./models/Account');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Middleware
app.use(express.static(path.join(__dirname, 'web/public')));

// Database
connectDB();

// Reporting Engine
const engine = new ReportingEngine();
engine.init().then(() => {
    setInterval(() => engine.processQueue(), 10000);
});

// Discord Bot
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const command = commands.find(c => c.data.name === interaction.commandName);
    if (command) await command.execute(interaction);
});

// Socket.io Real-time Updates
io.on('connection', (socket) => {
    console.log('[Dashboard] UI connected');

    const sendUpdates = async () => {
        const queue = await Queue.find().sort({ createdAt: -1 }).limit(10);
        const activeCount = await Account.countDocuments({ status: 'Active' });
        socket.emit('queueUpdate', queue);
        socket.emit('accountUpdate', { activeCount });
    };

    const interval = setInterval(sendUpdates, 5000);
    sendUpdates();

    socket.on('disconnect', () => clearInterval(interval));
});

// Command Registration
const registerCommands = async () => {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        console.log('[Discord] Refreshing slash commands...');
        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands.map(c => c.data.toJSON()) }
        );
    } catch (err) {
        console.error('[Discord] Registration error:', err);
    }
};

if (process.env.DISCORD_TOKEN && process.env.CLIENT_ID) {
    registerCommands();
    client.login(process.env.DISCORD_TOKEN);
}

// Start Server
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Suite] Server operational on port ${PORT}`);
    console.log(`[Suite] Dashboard: http://localhost:${PORT}`);
});
