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
const UserAgent = require('./models/UserAgent');
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

async function getProxyDashboardEmbed(filter = 'all', page = 0) {
    const total = await Proxy.countDocuments();
    const active = await Proxy.countDocuments({ status: 'active' });
    const dead = await Proxy.countDocuments({ status: 'dead' });
    const httpCount = await Proxy.countDocuments({ protocol: 'http', status: 'active' });
    const socks5Count = await Proxy.countDocuments({ protocol: 'socks5', status: 'active' });
    const socks4Count = await Proxy.countDocuments({ protocol: 'socks4', status: 'active' });

    let query = {};
    if (filter === 'active') query = { status: 'active' };
    else if (filter === 'dead') query = { status: 'dead' };

    const pageSize = 15;
    const proxies = await Proxy.find(query).skip(page * pageSize).limit(pageSize);
    const proxyList = proxies.map(p => `• ${p.host}:${p.port} [${p.protocol}] - ${p.latency}ms`).join('\n') || "None.";

    return new EmbedBuilder()
        .setTitle('🌐 Proxy Management Dashboard')
        .setDescription(`**Stats:** Total: ${total} | Active: ${active} | Dead: ${dead}\n**Protocols:** HTTP: ${httpCount} | SOCKS5: ${socks5Count} | SOCKS4: ${socks4Count}\n\n**Proxies (Page ${page + 1}):**\n${proxyList}`)
        .setColor('#3498db')
        .setTimestamp();
}

async function getUserAgentDashboardEmbed(page = 0) {
    const total = await UserAgent.countDocuments();
    const pageSize = 15;
    const uas = await UserAgent.find().skip(page * pageSize).limit(pageSize);
    const uaList = uas.map(u => `• ${u.ua.substring(0, 80)}...`).join('\n') || "None.";

    return new EmbedBuilder()
        .setTitle('🎭 User-Agent Management Dashboard')
        .setDescription(`**Stats:** Total Browser Strings: ${total}\n\n**User-Agents (Page ${page + 1}):**\n${uaList}`)
        .setColor('#f1c40f')
        .setTimestamp();
}

function getProxyActionRows(page = 0) {
    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('trigger_proxy_modal').setLabel('➕ Upload').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('check_proxies').setLabel('🔄 Check All').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('remove_dead_proxies').setLabel('🗑️ Remove Dead').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('refresh_proxies').setLabel('Refresh').setStyle(ButtonStyle.Secondary)
    );
    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`proxy_prev_${page}`).setLabel('⬅️ Back').setStyle(ButtonStyle.Secondary).setDisabled(page === 0),
        new ButtonBuilder().setCustomId(`proxy_next_${page}`).setLabel('Next ➡️').setStyle(ButtonStyle.Secondary)
    );
    return [row1, row2];
}

function getUAActionRows(page = 0) {
    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('trigger_ua_modal').setLabel('➕ Upload').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('refresh_uas').setLabel('Refresh').setStyle(ButtonStyle.Secondary)
    );
    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`ua_prev_${page}`).setLabel('⬅️ Back').setStyle(ButtonStyle.Secondary).setDisabled(page === 0),
        new ButtonBuilder().setCustomId(`ua_next_${page}`).setLabel('Next ➡️').setStyle(ButtonStyle.Secondary)
    );
    return [row1, row2];
}

client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        const command = commands.find(c => c.data.name === interaction.commandName);
        if (command) await command.execute(interaction);
    }

    if (interaction.isButton()) {
        const customId = interaction.customId;

        if (customId === 'trigger_add_modal') {
            const modal = new ModalBuilder().setCustomId('account_add_modal').setTitle('Account Integration');
            const cookieInput = new TextInputBuilder().setCustomId('cookie_input').setLabel(".ROBLOSECURITY Cookie").setStyle(TextInputStyle.Paragraph).setPlaceholder("Paste cookie...").setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(cookieInput));
            await interaction.showModal(modal);
        } else if (customId === 'refresh_accounts') {
            const embed = await getAccountDashboardEmbed();
            await interaction.update({ embeds: [embed] });
        } else if (customId === 'force_reset_cooldowns') {
            await interaction.deferReply({ ephemeral: true });
            await engine.forceResetCooldowns();
            const embed = await getAccountDashboardEmbed();
            await interaction.editReply({ content: "✅ Fleet Cooldowns Reset.", embeds: [embed] });
        }
        // Proxies
        else if (customId === 'trigger_proxy_modal') {
            const modal = new ModalBuilder().setCustomId('proxy_upload_modal').setTitle('Bulk Proxy Upload');
            const input = new TextInputBuilder().setCustomId('proxy_input').setLabel("Proxy List (IP:Port)").setStyle(TextInputStyle.Paragraph).setPlaceholder("Paste your proxies here (messy text is okay)...").setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(input));
            await interaction.showModal(modal);
        } else if (customId === 'check_proxies') {
            await interaction.deferReply({ ephemeral: true });
            const allProxies = await Proxy.find({});
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
            const embed = await getProxyDashboardEmbed();
            await interaction.editReply({ content: "✅ Proxy check complete.", embeds: [embed], components: getProxyActionRows(0) });
        } else if (customId === 'remove_dead_proxies') {
            await interaction.deferReply({ ephemeral: true });
            const res = await Proxy.deleteMany({ status: 'dead' });
            const embed = await getProxyDashboardEmbed();
            await interaction.editReply({ content: `✅ Removed ${res.deletedCount} dead proxies.`, embeds: [embed], components: getProxyActionRows(0) });
        } else if (customId === 'refresh_proxies') {
            const embed = await getProxyDashboardEmbed();
            await interaction.update({ embeds: [embed], components: getProxyActionRows(0) });
        } else if (customId.startsWith('proxy_prev_') || customId.startsWith('proxy_next_')) {
            const parts = customId.split('_');
            let page = parseInt(parts[2]);
            if (parts[1] === 'prev') page--; else page++;
            const embed = await getProxyDashboardEmbed('all', page);
            await interaction.update({ embeds: [embed], components: getProxyActionRows(page) });
        }
        // User-Agents
        else if (customId === 'trigger_ua_modal') {
            const modal = new ModalBuilder().setCustomId('ua_upload_modal').setTitle('Bulk User-Agent Upload');
            const input = new TextInputBuilder().setCustomId('ua_input').setLabel("User-Agent List").setStyle(TextInputStyle.Paragraph).setPlaceholder("Paste browser strings here (one per line)...").setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(input));
            await interaction.showModal(modal);
        } else if (customId === 'refresh_uas') {
            const embed = await getUserAgentDashboardEmbed();
            await interaction.update({ embeds: [embed], components: getUAActionRows(0) });
        } else if (customId.startsWith('ua_prev_') || customId.startsWith('ua_next_')) {
            const parts = customId.split('_');
            let page = parseInt(parts[2]);
            if (parts[1] === 'prev') page--; else page++;
            const embed = await getUserAgentDashboardEmbed(page);
            await interaction.update({ embeds: [embed], components: getUAActionRows(page) });
        }
    }

    if (interaction.isModalSubmit()) {
        if (interaction.customId === 'account_add_modal') {
            const cookie = interaction.fields.getTextInputValue('cookie_input');
            await interaction.deferReply({ ephemeral: true });
            const account = await engine.sessionManager.addAccount(cookie);
            if (account) await interaction.editReply(`✅ Added: **${account.username}**`);
            else await interaction.editReply(`❌ Fail.`);
        } else if (interaction.customId === 'proxy_upload_modal') {
            const rawData = interaction.fields.getTextInputValue('proxy_input');
            await interaction.deferReply({ ephemeral: true });
            const regex = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):(\d{2,5})/g;
            let match, count = 0;
            while ((match = regex.exec(rawData)) !== null) {
                await Proxy.findOneAndUpdate({ host: match[1], port: parseInt(match[2]) }, { status: 'active', lastChecked: new Date() }, { upsert: true });
                count++;
            }
            const embed = await getProxyDashboardEmbed();
            await interaction.editReply({ content: `✅ Imported ${count} proxies.`, embeds: [embed], components: getProxyActionRows(0) });
        } else if (interaction.customId === 'ua_upload_modal') {
            const rawData = interaction.fields.getTextInputValue('ua_input');
            await interaction.deferReply({ ephemeral: true });
            const uas = rawData.split('\n').map(s => s.trim()).filter(s => s.length > 20);
            for (const ua of uas) {
                await UserAgent.findOneAndUpdate({ ua }, { addedAt: new Date() }, { upsert: true });
            }
            const embed = await getUserAgentDashboardEmbed();
            await interaction.editReply({ content: `✅ Imported ${uas.length} User-Agents.`, embeds: [embed], components: getUAActionRows(0) });
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
