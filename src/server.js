require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const {
    Client,
    GatewayIntentBits,
    REST,
    Routes,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    EmbedBuilder
} = require('discord.js');
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

// Discord Interaction Handler
client.on('interactionCreate', async interaction => {
    // Slash Commands
    if (interaction.isChatInputCommand()) {
        const command = commands.find(c => c.data.name === interaction.commandName);
        if (command) await command.execute(interaction);
    }

    // Button Clicks (Add Account Modal)
    if (interaction.isButton()) {
        if (interaction.customId === 'trigger_add_modal') {
            const modal = new ModalBuilder()
                .setCustomId('account_add_modal')
                .setTitle('Account Integration');

            const cookieInput = new TextInputBuilder()
                .setCustomId('cookie_input')
                .setLabel(".ROBLOSECURITY Cookie")
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder("Paste your full cookie here...")
                .setRequired(true);

            const row = new ActionRowBuilder().addComponents(cookieInput);
            modal.addComponents(row);

            await interaction.showModal(modal);
        }
    }

    // Modal Submissions
    if (interaction.isModalSubmit()) {
        if (interaction.customId === 'account_add_modal') {
            const cookie = interaction.fields.getTextInputValue('cookie_input');
            await interaction.deferReply({ ephemeral: true });

            const account = await engine.sessionManager.addAccount(cookie);
            if (account) {
                await interaction.editReply(`✅ Account authenticated and added: **${account.username}** (${account.userId})`);
            } else {
                await interaction.editReply(`❌ Failed to add account. Ensure the cookie is valid and not expired.`);
            }
        }
    }

    // Select Menu (Dashboard Filter)
    if (interaction.isStringSelectMenu()) {
        if (interaction.customId === 'filter_accounts') {
            const filter = interaction.values[0];
            const query = filter === 'all' ? {} : { status: filter };

            const totalCount = await Account.countDocuments();
            const activeCount = await Account.countDocuments({ status: 'active' });
            const cooldownCount = await Account.countDocuments({ status: 'cooldown' });
            const deadCount = await Account.countDocuments({ status: 'dead' });

            const filteredAccounts = await Account.find(query).limit(15);
            const accountList = filteredAccounts.map(a => `• ${a.username} [${a.status}]`).join('\n') || 'No accounts found.';

            const embed = new EmbedBuilder()
                .setTitle('📊 Account Management Dashboard')
                .setColor('#bb86fc')
                .setDescription(`Filtering by: **${filter}**`)
                .addFields(
                    { name: 'Stats', value: `Total: ${totalCount} | Active: ${activeCount} | Dead: ${deadCount}`, inline: false },
                    { name: 'Accounts', value: accountList }
                )
                .setTimestamp();

            await interaction.update({ embeds: [embed] });
        }
    }
});

// Socket.io Real-time Push
io.on('connection', (socket) => {
    const pushUpdates = async () => {
        const queue = await Queue.find().sort({ createdAt: -1 }).limit(10);
        const activeCount = await Account.countDocuments({ status: 'active' });
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
    console.log(`[System] Roblox-Mass-Reporter active on port ${PORT}`);
});
