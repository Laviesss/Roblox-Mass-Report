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
    EmbedBuilder,
    ButtonStyle,
    ButtonBuilder,
    StringSelectMenuBuilder
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

// Helper for Account Dashboard Embed
async function getAccountDashboardEmbed(filter = 'all') {
    const total = await Account.countDocuments();
    const readyQuery = {
        status: 'active',
        $or: [{ cooldownUntil: null }, { cooldownUntil: { $lte: new Date() } }]
    };
    const ready = await Account.countDocuments(readyQuery);
    const cooldownQuery = {
        status: 'cooldown',
        cooldownUntil: { $gt: new Date() }
    };
    const cooldown = await Account.countDocuments(cooldownQuery);
    const dead = await Account.countDocuments({ status: 'dead' });

    let query = {};
    if (filter === 'ready') query = readyQuery;
    else if (filter === 'cooldown') query = cooldownQuery;
    else if (filter === 'dead') query = { status: 'dead' };

    const accounts = await Account.find(query).limit(25);
    const accountList = accounts.map(a => {
        let status = "[Ready]";
        if (a.status === 'dead') status = "[Token Error]";
        else if (a.status === 'cooldown' && a.cooldownUntil > new Date()) {
            const mins = Math.ceil((a.cooldownUntil - Date.now()) / 60000);
            status = `[On Break: ${mins}m left]`;
        }
        return `• ${a.username}: ${status}`;
    }).join('\n') || "No accounts found matching this filter.";

    return new EmbedBuilder()
        .setTitle('📊 Fleet Management')
        .setDescription(`Filtering by: **${filter}**\n\n**Account List:**\n${accountList.length > 2000 ? accountList.substring(0, 1997) + "..." : accountList}`)
        .addFields(
            { name: 'Total', value: `${total}`, inline: true },
            { name: 'Ready', value: `${ready}`, inline: true },
            { name: 'On Break', value: `${cooldown}`, inline: true },
            { name: 'Dead', value: `${dead}`, inline: true }
        )
        .setColor('#9b59b6')
        .setTimestamp()
        .setFooter({ text: 'Roblox-Mass-Reporter Control Center' });
}

// Discord Interaction Handler
client.on('interactionCreate', async interaction => {
    // Slash Commands
    if (interaction.isChatInputCommand()) {
        const command = commands.find(c => c.data.name === interaction.commandName);
        if (command) await command.execute(interaction);
    }

    // Button Clicks
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
        } else if (interaction.customId === 'refresh_accounts') {
            const embed = await getAccountDashboardEmbed();
            await interaction.update({ embeds: [embed] });
        } else if (interaction.customId === 'force_reset_cooldowns') {
            await engine.forceResetCooldowns();
            const embed = await getAccountDashboardEmbed();
            await interaction.update({ content: "✅ All fleet cooldowns have been manually cleared.", embeds: [embed] });
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

    // Select Menu
    if (interaction.isStringSelectMenu()) {
        if (interaction.customId === 'filter_accounts_detailed') {
            const filter = interaction.values[0];
            const embed = await getAccountDashboardEmbed(filter);
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
