require('dotenv').config();
process.title = 'RMR';
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
    StringSelectMenuBuilder,
    MessageFlags
} = require('discord.js');
const connectDB = require('./core/database');
const ReportingEngine = require('./core/reportingEngine');
const setupCommands = require('./commands');
const Queue = require('./models/Queue');
const Account = require('./models/Account');
const Proxy = require('./models/Proxy');
const UserAgent = require('./models/UserAgent');
const Report = require('./models/Report');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const FOOTER_TEXT = 'Roblox Mass Reporter | System Status: Optimal';

app.use(express.static(path.join(__dirname, 'web/public')));

const engine = new ReportingEngine();
engine.setSocketIO(io);
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const commands = setupCommands(engine);

let isProcessing = false;
const wizardSessions = new Map();
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

    // Register Discord Slash Commands
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        console.log('[RMR] Registering application commands...');
        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands.map(c => c.data.toJSON()) }
        );
        console.log('[RMR] Commands registered successfully.');
    } catch (error) {
        console.error('[RMR] Failed to register commands:', error);
    }

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

async function getAccountDashboardEmbed() {
    const total = await Account.countDocuments();
    const healthy = await Account.countDocuments({ status: 'active' });
    const cooldown = await Account.countDocuments({ status: 'cooldown' });
    const dead = await Account.countDocuments({ status: 'dead' });

    return new EmbedBuilder()
        .setTitle('RMR | Fleet Management')
        .addFields(
            { name: 'Total Fleet', value: `${total}`, inline: true },
            { name: 'Healthy', value: `${healthy}`, inline: true },
            { name: 'On Break', value: `${cooldown}`, inline: true },
            { name: 'Dead', value: `${dead}`, inline: true }
        )
        .setColor('#9b59b6')
        .setTimestamp()
        .setFooter({ text: FOOTER_TEXT });
}

client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        const command = commands.find(c => c.data.name === interaction.commandName);
        if (command) await command.execute(interaction);
    }

    if (interaction.isStringSelectMenu()) {
        if (interaction.customId === 'report_select_domain') {
            const domain = interaction.values[0];
            wizardSessions.set(interaction.user.id, { domain });

            const modal = new ModalBuilder()
                .setCustomId('report_context_modal')
                .setTitle('RMR | Target Specification');

            const idInput = new TextInputBuilder()
                .setCustomId('target_id')
                .setLabel('Target ID (User/Game/Group)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Enter the ID here...')
                .setRequired(true);

            const reasonInput = new TextInputBuilder()
                .setCustomId('target_reason')
                .setLabel('Reason / Comment')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Automation detected ToS violation...')
                .setRequired(true);

            modal.addComponents(
                new ActionRowBuilder().addComponents(idInput),
                new ActionRowBuilder().addComponents(reasonInput)
            );

            await interaction.showModal(modal);
        }
    }

    if (interaction.isButton()) {
        // Audit logic: Defer every button interaction to prevent timeouts
        const skipDefer = [
            'trigger_add_modal',
            'trigger_proxy_modal',
            'trigger_ua_modal',
            'report_confirm_start',
            'report_confirm_cancel'
        ];

        if (!skipDefer.includes(interaction.customId)) {
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
        }

        const customId = interaction.customId;
        if (customId === 'report_confirm_start') {
            const session = wizardSessions.get(interaction.user.id);
            if (!session) return interaction.reply({ content: 'RMR | Session expired.', flags: [MessageFlags.Ephemeral] });

            await interaction.update({ content: '🚀 RMR | Purge Started. Monitoring progress...', embeds: [], components: [] });
            await engine.executeMassReportFromDiscovery(interaction, session);
            wizardSessions.delete(interaction.user.id);
        } else if (customId === 'report_confirm_cancel') {
            wizardSessions.delete(interaction.user.id);
            await interaction.update({ content: '❌ RMR | Operation Cancelled.', embeds: [], components: [] });
        } else if (customId === 'trigger_add_modal') {
            const modal = new ModalBuilder().setCustomId('account_add_modal').setTitle('RMR | Account Integration');
            const input = new TextInputBuilder().setCustomId('cookie_input').setLabel(".ROBLOSECURITY").setStyle(TextInputStyle.Paragraph).setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(input));
            await interaction.showModal(modal);
        } else if (customId === 'force_reset_cooldowns') {
            await engine.forceResetCooldowns();
            await interaction.editReply("RMR | All Fleet breaks cleared. Re-checking health...");
        } else if (customId === 'purge_dead_accounts') {
            const res = await Account.deleteMany({ status: 'dead' });
            await interaction.editReply(`RMR | Purged ${res.deletedCount} dead accounts.`);
        } else if (customId === 'check_proxies') {
            const allProxies = await Proxy.find({});
            for (const p of allProxies) {
                const res = await engine.checkProxyWaterfall(p.host, p.port);
                if (res) { p.protocol = res.protocol; p.latency = res.latency; p.status = 'active'; }
                else p.status = 'dead';
                await p.save();
            }
            await interaction.editReply("RMR | Proxy check complete.");
        } else if (customId === 'remove_dead_proxies') {
            const res = await Proxy.deleteMany({ status: 'dead' });
            await interaction.editReply(`RMR | Purged ${res.deletedCount} dead proxies.`);
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
        } else if (customId === 'refresh_uas') {
            // Refresh logic: essentially just re-confirming count for now or could re-scrape
            const total = await UserAgent.countDocuments();
            await interaction.editReply(`RMR | Refreshed. ${total} unique identities available.`);
        } else if (customId === 'purge_uas') {
            await UserAgent.deleteMany({});
            await interaction.editReply("RMR | Identity pool purged.");
        }
    }

    if (interaction.isModalSubmit()) {
        if (interaction.customId !== 'report_context_modal') {
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
        }

        if (interaction.customId === 'report_context_modal') {
            const session = wizardSessions.get(interaction.user.id);
            if (!session) return interaction.reply({ content: 'RMR | Session expired.', flags: [MessageFlags.Ephemeral] });

            const targetId = interaction.fields.getTextInputValue('target_id');
            const reason = interaction.fields.getTextInputValue('target_reason');

            session.targetId = targetId;
            session.reason = reason;

            await interaction.reply({ content: '🔍 **RMR Scraper Engine: Active**\nHunting for linked assets and sub-places...', flags: [MessageFlags.Ephemeral] });

            // Start scraping
            const discovery = await engine.performDiscovery(session.targetId, session.domain);
            session.targets = discovery.targets;

            const embed = new EmbedBuilder()
                .setTitle('🚀 RMR | Purge Confirmation')
                .setDescription(`RMR has discovered the following footprint for target **${targetId}**:`)
                .addFields(
                    { name: 'Discovered Items', value: `${discovery.targets.length}`, inline: true },
                    { name: 'Mapping Detail', value: discovery.summary, inline: false }
                )
                .setColor('#e74c3c')
                .setFooter({ text: FOOTER_TEXT });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('report_confirm_start').setLabel('START PURGE').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('report_confirm_cancel').setLabel('CANCEL').setStyle(ButtonStyle.Secondary)
            );

            await interaction.editReply({ content: null, embeds: [embed], components: [row] });
        } else if (interaction.customId === 'account_add_modal') {
            const cookie = interaction.fields.getTextInputValue('cookie_input');
            const account = await engine.sessionManager.addAccount(cookie);
            if (account) await interaction.editReply(`RMR | Account Linked: **${account.username}** (Identity: Sticky UA assigned)`);
            else await interaction.editReply("RMR | Link Failed. Cookie may be invalid or expired.");
        } else if (interaction.customId === 'proxy_upload_modal') {
            const data = interaction.fields.getTextInputValue('proxy_input');
            const regex = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):(\d{2,5})/g;
            let m, count = 0;
            while ((m = regex.exec(data)) !== null) {
                await Proxy.findOneAndUpdate({ host: m[1], port: parseInt(m[2]) }, { status: 'active' }, { upsert: true });
                count++;
            }
            await interaction.editReply(`RMR | Imported ${count} proxies. Use [🔄 Check All] to verify protocols.`);
        } else if (interaction.customId === 'ua_upload_modal') {
            const data = interaction.fields.getTextInputValue('ua_input');
            const uas = data.split('\n').map(s => s.trim()).filter(s => s.length > 50);
            for (const ua of uas) await UserAgent.findOneAndUpdate({ ua }, { addedAt: new Date() }, { upsert: true });
            await interaction.editReply(`RMR | Imported ${uas.length} browser strings to identity pool.`);
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => console.log(`[RMR] System active on port ${PORT}`));
