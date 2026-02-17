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
const Proxy = require('./models/Proxy');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'web/public')));

const engine = new ReportingEngine();
engine.setSocketIO(io); // Connect Socket.io to Engine
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const commands = setupCommands(engine);

let isProcessing = false;
connectDB().then(async () => {
    await engine.init();
    setInterval(async () => {
        if (isProcessing) return;
        isProcessing = true;
        try { await engine.processQueue(); } finally { isProcessing = false; }
    }, 10000);
});

async function getAccountDashboardEmbed(filter = 'all') {
    const total = await Account.countDocuments();
    const readyQuery = { status: 'active', $or: [{ cooldownUntil: null }, { cooldownUntil: { $lte: new Date() } }] };
    const ready = await Account.countDocuments(readyQuery);
    const cooldownQuery = { status: 'cooldown', cooldownUntil: { $gt: new Date() } };
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
    }).join('\n') || "Empty.";
    return new EmbedBuilder().setTitle('📊 Fleet Management').setDescription(`Filtering: **${filter}**\n\n${accountList}`).addFields({ name: 'Total', value: `${total}`, inline: true }, { name: 'Ready', value: `${ready}`, inline: true }, { name: 'On Break', value: `${cooldown}`, inline: true }, { name: 'Dead', value: `${dead}`, inline: true }).setColor('#9b59b6').setTimestamp();
}

client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        const command = commands.find(c => c.data.name === interaction.commandName);
        if (command) await command.execute(interaction);
    }

    if (interaction.isButton()) {
        if (interaction.customId === 'trigger_add_modal') {
            const modal = new ModalBuilder().setCustomId('account_add_modal').setTitle('Account Integration');
            const cookieInput = new TextInputBuilder().setCustomId('cookie_input').setLabel(".ROBLOSECURITY Cookie").setStyle(TextInputStyle.Paragraph).setPlaceholder("Paste cookie...").setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(cookieInput));
            await interaction.showModal(modal);
        } else if (interaction.customId === 'refresh_accounts') {
            const embed = await getAccountDashboardEmbed();
            await interaction.update({ embeds: [embed] });
        } else if (interaction.customId === 'force_reset_cooldowns') {
            await engine.forceResetCooldowns();
            const embed = await getAccountDashboardEmbed();
            await interaction.update({ content: "✅ Fleet Cooldowns Reset.", embeds: [embed] });
        } else if (interaction.customId === 'check_proxies') {
            await interaction.reply({ content: "🔄 Checking all proxies (Waterfall Detection)... This may take a while.", ephemeral: true });
            const allProxies = await Proxy.find({}); // Check ALL proxies
            for (const p of allProxies) {
                const result = await engine.checkProxyWaterfall(p.host, p.port);
                if (result) {
                    p.protocol = result.protocol;
                    p.latency = result.latency;
                    p.status = 'active';
                } else {
                    p.status = 'dead';
                }
                await p.save();
            }
            await interaction.followUp({ content: "✅ Proxy check complete.", ephemeral: true });
        } else if (interaction.customId === 'remove_dead_proxies') {
            const res = await Proxy.deleteMany({ status: 'dead' });
            await interaction.reply({ content: `✅ Removed ${res.deletedCount} dead proxies.`, ephemeral: true });
        }
    }

    if (interaction.isModalSubmit()) {
        if (interaction.customId === 'account_add_modal') {
            const cookie = interaction.fields.getTextInputValue('cookie_input');
            await interaction.deferReply({ ephemeral: true });
            const account = await engine.sessionManager.addAccount(cookie);
            if (account) await interaction.editReply(`✅ Added: **${account.username}**`);
            else await interaction.editReply(`❌ Fail.`);
        }
    }

    if (interaction.isStringSelectMenu()) {
        if (interaction.customId === 'filter_accounts_detailed') {
            const embed = await getAccountDashboardEmbed(interaction.values[0]);
            await interaction.update({ embeds: [embed] });
        }
    }
});

io.on('connection', (socket) => {
    console.log("[Web] Dashboard connected.");
    // Send initial data
    (async () => {
        const activeCount = await Account.countDocuments({ status: 'active' });
        const queue = await Queue.find().sort({ createdAt: -1 }).limit(10);
        socket.emit('dashboardUpdate', { queue, activeCount });
    })();
});

const register = async () => {
    if (!process.env.DISCORD_TOKEN || !process.env.CLIENT_ID) return;
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands.map(c => c.data.toJSON()) });
        console.log("[Discord] Commands Registered.");
    } catch (err) { console.error("[Discord] Registration Fail:", err); }
};

if (process.env.DISCORD_TOKEN && process.env.CLIENT_ID) {
    register();
    client.login(process.env.DISCORD_TOKEN);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => console.log(`[System] Active on port ${PORT}`));
