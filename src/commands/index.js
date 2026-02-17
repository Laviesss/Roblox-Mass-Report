const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    ComponentType,
    MessageFlags
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
            .setDescription('RMR | Universal Takedown Wizard')
            .addStringOption(opt => opt.setName('id').setDescription('Target ID (User, Group, or Asset)').setRequired(true)),
        async execute(interaction) {
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

            const targetId = interaction.options.getString('id');

            const domainRow = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('select_domain')
                    .setPlaceholder('RMR | Pick Target Domain...')
                    .addOptions([
                        { label: 'User Profile (Ban)', value: 'BAN', description: 'Report a specific user ID.' },
                        { label: 'Marketplace Asset', value: 'ASSET', description: 'Report a hat, shirt, or model.' },
                        { label: 'Experience (Game)', value: 'GAME', description: 'Report a place or universe ID.' },
                        { label: 'Group Entity', value: 'GROUP', description: 'Report an entire group.' }
                    ])
            );

            const msg = await interaction.editReply({ content: `### RMR | Universal Takedown: ID ${targetId}\nSelect the target category below:`, components: [domainRow] });

            const state = { targetId, type: null, reason: null, delay: 2, selectedAccounts: new Set(), isFullWipe: false };
            const collector = msg.createMessageComponentCollector({ time: 600000 });

            collector.on('collect', async i => {
                if (i.user.id !== interaction.user.id) return i.reply({ content: "RMR | Not your menu.", flags: [MessageFlags.Ephemeral] });

                if (i.customId === 'select_domain') {
                    state.type = i.values[0];
                    const row = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('select_reason').setPlaceholder('RMR | Reason...').addOptions(Object.entries(engine.reasonMap).map(([key, val]) => ({ label: val.label, value: key }))));
                    await i.update({ content: "### RMR | Step 2: Reason Selection", components: [row] });
                } else if (i.customId === 'select_reason') {
                    state.reason = i.values[0];
                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('toggle_wipe_on').setLabel('Full Wipe: ON').setStyle(ButtonStyle.Danger),
                        new ButtonBuilder().setCustomId('toggle_wipe_off').setLabel('Full Wipe: OFF').setStyle(ButtonStyle.Secondary)
                    );
                    await i.update({ content: "### RMR | Step 3: Deep Scraper\nDo you want to find and report all linked assets/games?", components: [row] });
                } else if (i.customId.startsWith('toggle_wipe')) {
                    state.isFullWipe = i.customId === 'toggle_wipe_on';
                    const row = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('select_delay').setPlaceholder('RMR | Speed...').addOptions([{label:'1s',value:'1'},{label:'3s',value:'3'},{label:'5s',value:'5'},{label:'10s',value:'10'},{label:'15s',value:'15'}]));
                    await i.update({ content: "### RMR | Step 4: Delay Selection", components: [row] });
                } else if (i.customId === 'select_delay') {
                    state.delay = parseInt(i.values[0]);
                    await updateAccountPicker(i);
                } else if (i.customId === 'select_accounts') {
                    i.values.forEach(val => state.selectedAccounts.add(val));
                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('go_seq').setLabel('Start (Sequential)').setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId('go_rand').setLabel('Start (Randomize)').setStyle(ButtonStyle.Secondary)
                    );
                    await i.update({ content: `### RMR | Final Step: Launch\nSelected: **${state.selectedAccounts.size} accounts**`, components: [row] });
                } else if (i.customId === 'go_seq' || i.customId === 'go_rand') {
                    collector.stop();
                    await i.update({ content: "🚀 RMR | Mission Launched. Monitoring progress...", components: [] });
                    await engine.executeMassReport(interaction, { id: state.targetId, username: state.targetId, type: state.type }, state.reason, state.delay, Array.from(state.selectedAccounts), i.customId === 'go_rand', state.isFullWipe);
                }
            });

            async function updateAccountPicker(i) {
                const allAccounts = await Account.find({ status: 'active' });
                const menu = new StringSelectMenuBuilder().setCustomId('select_accounts').setPlaceholder(`RMR | Pick Accounts...`).setMinValues(1).setMaxValues(Math.min(allAccounts.length, 25)).addOptions(allAccounts.slice(0, 25).map(a => ({ label: a.username, value: a._id.toString() })));
                const row = new ActionRowBuilder().addComponents(menu);
                await i.update({ content: "### RMR | Step 5: Account Selection", components: [row] });
            }
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
