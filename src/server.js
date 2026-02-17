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
engine.setSocketIO(io);
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const commands = setupCommands(engine);

let isProcessing = false;
connectDB().then(async () => {
    console.log(`
    ██████╗ ███╗   ███╗██████╗
    ██╔══██╗████╗ ████║██╔══██╗
    ██████╔╝██╔████╔██║██████╔╝
    ██╔══██╗██║╚██╔╝██║██╔══██╗
    ██║  ██║██║ ╚═╝ ██║██║  ██║
    ╚═╝  ╚═╝╚═╝     ╚═╝╚═╝  ╚═╝
    ROBLOX MASS REPORTER v3.0
    `);

    await engine.init();

    // Persistent Queue resumption check
    const pendingCount = await Queue.countDocuments({ status: { $in: ['Pending', 'In Progress'] } });
    if (pendingCount > 0) {
        console.log(`[RMR] System Rebooted: Resuming ${pendingCount} remaining reports...`);
    }

    setInterval(async () => {
        if (isProcessing) return;
        isProcessing = true;
        try { await engine.processQueue(); } finally { isProcessing = false; }
    }, 10000);

    // Dashboard Stats Sync
    setInterval(async () => {
        const stats = {
            fleet: await Account.countDocuments({ status: 'active' }),
            queue: await Queue.countDocuments({ status: 'Pending' }),
            success: await Report.countDocuments({ status: 'Success' }),
            fail: await Report.countDocuments({ status: { $ne: 'Success' } }),
            proxies: await Proxy.countDocuments({ status: 'active' }),
            uas: await UserAgent.countDocuments()
        };
        io.emit('stats_update', stats);
    }, 5000);
});

async function getAccountDashboardEmbed(filter = 'all') {
    const total = await Account.countDocuments();
    const readyCount = await Account.countDocuments({ status: 'active', $or: [{ cooldownUntil: null }, { cooldownUntil: { $lte: new Date() } }] });
    const cooldown = await Account.countDocuments({ status: 'cooldown', cooldownUntil: { $gt: new Date() } });
    const dead = await Account.countDocuments({ status: 'dead' });
    return new EmbedBuilder()
        .setTitle('RMR | Fleet Hub')
        .addFields(
            { name: 'Total', value: `${total}`, inline: true },
            { name: 'Ready', value: `${readyCount}`, inline: true },
            { name: 'On Break', value: `${cooldown}`, inline: true },
            { name: 'Dead', value: `${dead}`, inline: true }
        )
        .setColor('#9b59b6')
        .setTimestamp()
        .setFooter({ text: 'RMR Professional Takedown Utility' });
}

client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        const command = commands.find(c => c.data.name === interaction.commandName);
        if (command) await command.execute(interaction);
    }

    if (interaction.isButton()) {
        const customId = interaction.customId;
        if (customId === 'trigger_add_modal') {
            const modal = new ModalBuilder().setCustomId('account_add_modal').setTitle('RMR | Account Integration');
            const input = new TextInputBuilder().setCustomId('cookie_input').setLabel(".ROBLOSECURITY").setStyle(TextInputStyle.Paragraph).setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(input));
            await interaction.showModal(modal);
        } else if (customId === 'force_reset_cooldowns') {
            await interaction.deferReply({ ephemeral: true });
            await engine.forceResetCooldowns();
            await interaction.editReply("RMR | All Fleet breaks cleared.");
        } else if (customId === 'check_proxies') {
            await interaction.deferReply({ ephemeral: true });
            const allProxies = await Proxy.find({});
            for (const p of allProxies) {
                const res = await engine.checkProxyWaterfall(p.host, p.port);
                if (res) { p.protocol = res.protocol; p.latency = res.latency; p.status = 'active'; }
                else p.status = 'dead';
                await p.save();
            }
            await interaction.editReply("RMR | Proxy check complete.");
        } else if (customId === 'remove_dead_proxies') {
            await interaction.deferReply({ ephemeral: true });
            const res = await Proxy.deleteMany({ status: 'dead' });
            await interaction.editReply(`RMR | Purged ${res.deletedCount} items.`);
        } else if (customId === 'trigger_proxy_modal') {
            const modal = new ModalBuilder().setCustomId('proxy_upload_modal').setTitle('RMR | Bulk Proxy Upload');
            const input = new TextInputBuilder().setCustomId('proxy_input').setLabel("List (IP:Port)").setStyle(TextInputStyle.Paragraph).setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(input));
            await interaction.showModal(modal);
        } else if (customId === 'trigger_ua_modal') {
            const modal = new ModalBuilder().setCustomId('ua_upload_modal').setTitle('RMR | Bulk UA Upload');
            const input = new TextInputBuilder().setCustomId('ua_input').setLabel("List (Line by Line)").setStyle(TextInputStyle.Paragraph).setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(input));
            await interaction.showModal(modal);
        }
    }

    if (interaction.isModalSubmit()) {
        await interaction.deferReply({ ephemeral: true });
        if (interaction.customId === 'account_add_modal') {
            const cookie = interaction.fields.getTextInputValue('cookie_input');
            const account = await engine.sessionManager.addAccount(cookie);
            if (account) await interaction.editReply(`RMR | Account Linked: **${account.username}**`);
            else await interaction.editReply("RMR | Link Failed.");
        } else if (interaction.customId === 'proxy_upload_modal') {
            const data = interaction.fields.getTextInputValue('proxy_input');
            const regex = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):(\d{2,5})/g;
            let m, count = 0;
            while ((m = regex.exec(data)) !== null) {
                await Proxy.findOneAndUpdate({ host: m[1], port: parseInt(m[2]) }, { status: 'active' }, { upsert: true });
                count++;
            }
            await interaction.editReply(`RMR | Imported ${count} proxies.`);
        } else if (interaction.customId === 'ua_upload_modal') {
            const data = interaction.fields.getTextInputValue('ua_input');
            const uas = data.split('\n').map(s => s.trim()).filter(s => s.length > 50);
            for (const ua of uas) await UserAgent.findOneAndUpdate({ ua }, { addedAt: new Date() }, { upsert: true });
            await interaction.editReply(`RMR | Imported ${uas.length} browser strings.`);
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => console.log(`[RMR] System active on port ${PORT}`));
