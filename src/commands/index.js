const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    ComponentType,
    MessageFlags,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require('discord.js');
const Account = require('../models/Account');
const Report = require('../models/Report');
const Queue = require('../models/Queue');
const Proxy = require('../models/Proxy');
const UserAgent = require('../models/UserAgent');

const FOOTER_TEXT = 'Roblox Mass Reporter | System Status: Optimal';

module.exports = (engine) => [
    {
        data: new SlashCommandBuilder()
            .setName('report')
            .setDescription('RMR | Report Center'),
        async execute(interaction) {
            // Step A: Instant Response (Fixing Error 10062)
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

            // Step B: RMR Command Hub
            const embed = new EmbedBuilder()
                .setTitle('RMR | Report Center')
                .setDescription('Select the target category below to begin the mapping process.')
                .addFields(
                    { name: '👤 Player/User', value: 'Profile-level takedowns.', inline: true },
                    { name: '📦 Assets', value: 'Clothing, decals, models.', inline: true },
                    { name: '🎮 Games', value: 'Lobby, maps, sub-places.', inline: true },
                    { name: '🏢 Group', value: 'Entire corporate footprint.', inline: true }
                )
                .setColor('#3498db')
                .setFooter({ text: FOOTER_TEXT });

            const domainRow = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('report_select_domain')
                    .setPlaceholder('RMR | Pick Target Domain...')
                    .addOptions([
                        { label: 'Player/User', value: 'BAN', description: 'Profile-level takedowns.', emoji: '👤' },
                        { label: 'Assets & Marketplace', value: 'ASSET', description: 'Clothing, decals, models.', emoji: '📦' },
                        { label: 'Games & Universes', value: 'GAME', description: 'Lobby, maps, sub-places.', emoji: '🎮' },
                        { label: 'Group Syndicate', value: 'GROUP', description: 'Entire corporate footprint.', emoji: '🏢' }
                    ])
            );

            await interaction.editReply({ embeds: [embed], components: [domainRow] });
        }
    },
    {
        data: new SlashCommandBuilder().setName('reports').setDescription('RMR | View history and stats').addStringOption(opt => opt.setName('search').setDescription('Search by username')),
        async execute(interaction) {
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
            const search = interaction.options.getString('search');
            if (search) {
                const history = await Report.find({ victimUsername: new RegExp(search, 'i') }).sort({ timestamp: -1 }).limit(20);
                const list = history.map(r => `• ${r.timestamp.toLocaleDateString()}: ${r.status}`).join('\n') || "No history.";
                return await interaction.editReply({ content: `### RMR | Search: ${search}\n${list}` });
            }
            const total = await Report.countDocuments({ status: 'Success' });
            const embed = new EmbedBuilder().setTitle('RMR | Performance Dashboard').addFields({ name: 'Total Takedowns', value: `${total}`, inline: true }).setTimestamp().setFooter({ text: FOOTER_TEXT });
            const row = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('history_filter').setPlaceholder('RMR | View...').addOptions([{ label: 'Ledger', value: 'ledger' }, { label: 'Failures', value: 'audit' }]));
            const msg = await interaction.editReply({ embeds: [embed], components: [row] });
            const coll = msg.createMessageComponentCollector({ time: 60000 });
            coll.on('collect', async i => {
                const filter = i.values[0];
                const reports = await Report.find(filter === 'audit' ? { status: { $ne: 'Success' } } : {}).sort({ timestamp: -1 }).limit(20);
                const list = reports.map(r => `• ${r.victimUsername}: ${r.status} (${r.errorType || ''})`).join('\n') || "Empty.";
                await i.update({ content: `### RMR | ${filter === 'audit' ? 'Failure Audit' : 'History Ledger'}\n${list}`, embeds: [], components: [row] });
            });
        }
    },
    {
        data: new SlashCommandBuilder().setName('accounts').setDescription('RMR | Fleet Hub'),
        async execute(interaction) {
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
            const total = await Account.countDocuments();
            const healthy = await Account.countDocuments({ status: 'active' });
            const cooldown = await Account.countDocuments({ status: 'cooldown' });
            const dead = await Account.countDocuments({ status: 'dead' });

            const embed = new EmbedBuilder()
                .setTitle('RMR | Fleet Management')
                .addFields(
                    { name: 'Total Fleet', value: `${total}`, inline: true },
                    { name: 'Healthy', value: `${healthy}`, inline: true },
                    { name: 'On Break', value: `${cooldown}`, inline: true },
                    { name: 'Dead', value: `${dead}`, inline: true }
                )
                .setColor('#9b59b6')
                .setFooter({ text: FOOTER_TEXT });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('trigger_add_modal').setLabel('➕ Upload').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('force_reset_cooldowns').setLabel('🔄 Check/Refresh').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('purge_dead_accounts').setLabel('🗑️ Purge Dead').setStyle(ButtonStyle.Danger)
            );
            await interaction.editReply({ embeds: [embed], components: [row] });
        }
    },
    {
        data: new SlashCommandBuilder().setName('proxies').setDescription('RMR | Proxy Dashboard'),
        async execute(interaction) {
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
            const total = await Proxy.countDocuments();
            const healthy = await Proxy.countDocuments({ status: 'active' });
            const dead = await Proxy.countDocuments({ status: 'dead' });

            const embed = new EmbedBuilder()
                .setTitle('RMR | Proxy Management')
                .addFields(
                    { name: 'Total', value: `${total}`, inline: true },
                    { name: 'Healthy', value: `${healthy}`, inline: true },
                    { name: 'Dead', value: `${dead}`, inline: true }
                )
                .setColor('#3498db')
                .setFooter({ text: FOOTER_TEXT });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('trigger_proxy_modal').setLabel('➕ Upload').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('check_proxies').setLabel('🔄 Check/Refresh').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('remove_dead_proxies').setLabel('🗑️ Purge Dead').setStyle(ButtonStyle.Danger)
            );
            await interaction.editReply({ embeds: [embed], components: [row] });
        }
    },
    {
        data: new SlashCommandBuilder().setName('useragents').setDescription('RMR | UA Dashboard'),
        async execute(interaction) {
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
            const total = await UserAgent.countDocuments();

            const embed = new EmbedBuilder()
                .setTitle('RMR | Identity Dashboard')
                .addFields({ name: 'Total Identities', value: `${total}`, inline: true })
                .setColor('#f1c40f')
                .setFooter({ text: FOOTER_TEXT });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('trigger_ua_modal').setLabel('➕ Upload').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('refresh_uas').setLabel('🔄 Refresh').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('purge_uas').setLabel('🗑️ Purge All').setStyle(ButtonStyle.Danger)
            );
            await interaction.editReply({ embeds: [embed], components: [row] });
        }
    },
    {
        data: new SlashCommandBuilder().setName('terminate').setDescription('RMR | Kill Switch'),
        async execute(interaction) {
            engine.terminateAll();
            await interaction.reply({ content: "🔴 RMR | STOPPED ALL LOOPS.", flags: [MessageFlags.Ephemeral] });
        }
    }
];
