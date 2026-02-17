const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    ComponentType
} = require('discord.js');
const Account = require('../models/Account');
const Report = require('../models/Report');
const Queue = require('../models/Queue');
const Proxy = require('../models/Proxy');
const UserAgent = require('../models/UserAgent');
const axios = require('axios');

const calculateAge = (createdAt) => {
    const created = new Date(createdAt);
    const now = new Date();
    let years = now.getFullYear() - created.getFullYear();
    let months = now.getMonth() - created.getMonth();
    if (months < 0) {
        years--;
        months += 12;
    }
    return `${years} Years, ${months} Months`;
};

module.exports = (engine) => [
    {
        data: new SlashCommandBuilder()
            .setName('report')
            .setDescription('Start the reporting wizard')
            .addStringOption(opt => opt.setName('username').setDescription('Target person').setRequired(true)),
        async execute(interaction) {
            await interaction.deferReply();

            const readyCount = await Account.countDocuments({
                status: 'active',
                $or: [{ cooldownUntil: null }, { cooldownUntil: { $lte: new Date() } }]
            });

            if (readyCount === 0) return interaction.editReply("No accounts are ready to use right now. Check /accounts.");

            const username = interaction.options.getString('username');
            let target;
            try {
                const userRes = await axios.post("https://users.roblox.com/v1/usernames/users", { usernames: [username] });
                if (!userRes.data.data.length) return interaction.editReply("❌ User not found.");
                const id = userRes.data.data[0].id;
                const [detail, thumb, presence] = await Promise.all([
                    axios.get(`https://users.roblox.com/v1/users/${id}`),
                    axios.get(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${id}&size=150x150&format=Png&isCircular=false`),
                    axios.post("https://presence.roblox.com/v1/presence/users", { userIds: [id] })
                ]);
                target = { id, username: detail.data.name, joined: detail.data.created, avatar: thumb.data.data[0]?.imageUrl, online: presence.data.userPresences[0]?.userPresenceType >= 1 };
            } catch (err) { return interaction.editReply(`❌ Error: ${err.message}`); }

            const embed = new EmbedBuilder()
                .setTitle(`Target Intel: ${target.username}`)
                .setThumbnail(target.avatar)
                .addFields(
                    { name: 'Joined', value: new Date(target.joined).toLocaleDateString(), inline: true },
                    { name: 'Account Age', value: calculateAge(target.joined), inline: true },
                    { name: 'Online Status', value: target.online ? "🟢 Online" : "⚪ Offline", inline: true }
                ).setColor(target.online ? '#00FF00' : '#808080');

            const nextBtn = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('next_to_reason').setLabel('Continue to Reason').setStyle(ButtonStyle.Primary));
            const msg = await interaction.editReply({ embeds: [embed], components: [nextBtn] });

            const state = { reason: null, delay: 2, selectedAccounts: new Set(), page: 0 };
            const collector = msg.createMessageComponentCollector({ time: 600000 });

            collector.on('collect', async i => {
                if (i.user.id !== interaction.user.id) return i.reply({ content: "Not your menu.", ephemeral: true });

                if (i.customId === 'next_to_reason') {
                    const row = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('select_reason').setPlaceholder('Reason...').addOptions(Object.entries(engine.reasonMap).map(([key, val]) => ({ label: val.label, value: key }))));
                    await i.update({ content: "### Step 2: Reason Selection", embeds: [], components: [row] });
                } else if (i.customId === 'select_reason') {
                    state.reason = i.values[0];
                    const row = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('select_delay').setPlaceholder('Speed...').addOptions([{label:'1s',value:'1'},{label:'3s',value:'3'},{label:'5s',value:'5'},{label:'10s',value:'10'},{label:'15s',value:'15'}]));
                    await i.update({ content: "### Step 3: Delay Selection", components: [row] });
                } else if (i.customId === 'select_delay') {
                    state.delay = parseInt(i.values[0]);
                    await updateAccountPicker(i);
                } else if (i.customId === 'prev_page' || i.customId === 'next_page') {
                    state.page += (i.customId === 'next_page' ? 1 : -1);
                    await updateAccountPicker(i);
                } else if (i.customId === 'select_accounts') {
                    i.values.forEach(val => state.selectedAccounts.add(val));
                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('go_seq').setLabel('Go (Sequential)').setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId('go_rand').setLabel('Go (Randomize)').setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder().setCustomId('add_more').setLabel('Add More Accounts').setStyle(ButtonStyle.Primary)
                    );
                    await i.update({ content: `### Final Step: Order\nSelected: **${state.selectedAccounts.size} accounts**`, components: [row] });
                } else if (i.customId === 'add_more') {
                    await updateAccountPicker(i);
                } else if (i.customId === 'go_seq' || i.customId === 'go_rand') {
                    collector.stop();
                    await i.update({ content: "🚀 Starting report run...", components: [] });
                    await engine.executeMassReport(interaction, target, state.reason, state.delay, Array.from(state.selectedAccounts), i.customId === 'go_rand');
                }
            });

            async function updateAccountPicker(i) {
                const allAccounts = await Account.find({ status: 'active', $or: [{ cooldownUntil: null }, { cooldownUntil: { $lte: new Date() } }] });
                const pageSize = 25, totalPages = Math.ceil(allAccounts.length / pageSize), start = state.page * pageSize;
                const pageItems = allAccounts.slice(start, start + pageSize);
                const menu = new StringSelectMenuBuilder().setCustomId('select_accounts').setPlaceholder(`Pick (Page ${state.page + 1}/${totalPages})`).setMinValues(1).setMaxValues(pageItems.length).addOptions(pageItems.map(a => ({ label: a.username, value: a._id.toString(), description: state.selectedAccounts.has(a._id.toString()) ? "SELECTED" : "" })));
                const buttons = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('prev_page').setLabel('Back').setStyle(ButtonStyle.Secondary).setDisabled(state.page === 0), new ButtonBuilder().setCustomId('next_page').setLabel('Next').setStyle(ButtonStyle.Secondary).setDisabled(state.page >= totalPages - 1));
                const rows = [new ActionRowBuilder().addComponents(menu)];
                if (totalPages > 1) rows.push(buttons);
                await i.update({ content: "### Step 4: Account Selection", components: rows });
            }
        }
    },
    {
        data: new SlashCommandBuilder().setName('reports').setDescription('View history and stats').addStringOption(opt => opt.setName('search').setDescription('Search by username')),
        async execute(interaction) {
            await interaction.deferReply();
            const search = interaction.options.getString('search');
            if (search) {
                const history = await Report.find({ victimUsername: new RegExp(search, 'i') }).sort({ timestamp: -1 }).limit(20);
                const list = history.map(r => `• ${r.timestamp.toLocaleDateString()}: ${r.status}`).join('\n') || "No history.";
                return await interaction.editReply({ content: `### Search: ${search}\n${list}` });
            }
            const total = await Report.countDocuments({ status: 'Success' });
            const embed = new EmbedBuilder().setTitle('📊 Performance').addFields({ name: 'Total Success', value: `${total}`, inline: true }).setTimestamp();
            const row = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('history_filter').setPlaceholder('View...').addOptions([{ label: 'Ledger', value: 'ledger' }, { label: 'Failures', value: 'audit' }]));
            const msg = await interaction.editReply({ embeds: [embed], components: [row] });
            const coll = msg.createMessageComponentCollector({ time: 60000 });
            coll.on('collect', async i => {
                const filter = i.values[0];
                const reports = await Report.find(filter === 'audit' ? { status: { $ne: 'Success' } } : {}).sort({ timestamp: -1 }).limit(20);
                const list = reports.map(r => `• ${r.victimUsername}: ${r.status} (${r.errorType || ''})`).join('\n') || "Empty.";
                await i.update({ content: `### ${filter === 'audit' ? 'Failure Audit' : 'History Ledger'}\n${list}`, embeds: [], components: [row] });
            });
        }
    },
    {
        data: new SlashCommandBuilder().setName('accounts').setDescription('Manage fleet'),
        async execute(interaction) {
            const ready = await Account.countDocuments({ status: 'active', $or: [{ cooldownUntil: null }, { cooldownUntil: { $lte: new Date() } }] });
            const embed = new EmbedBuilder().setTitle('📊 Fleet').addFields({ name: 'Ready', value: `${ready}`, inline: true }).setColor('#9b59b6');

            const filterRow = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('filter_accounts_detailed')
                    .setPlaceholder('Filter view...')
                    .addOptions([
                        { label: 'All', value: 'all' },
                        { label: 'Ready', value: 'ready' },
                        { label: 'On Break', value: 'cooldown' },
                        { label: 'Dead', value: 'dead' }
                    ])
            );

            const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('trigger_add_modal').setLabel('Add').setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId('refresh_accounts').setLabel('Refresh').setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId('force_reset_cooldowns').setLabel('Reset All').setStyle(ButtonStyle.Danger));
            await interaction.reply({ embeds: [embed], components: [filterRow, row] });
        }
    },
    {
        data: new SlashCommandBuilder().setName('proxies').setDescription('Proxy Management Dashboard'),
        async execute(interaction) {
            const total = await Proxy.countDocuments();
            const active = await Proxy.countDocuments({ status: 'active' });
            const dead = await Proxy.countDocuments({ status: 'dead' });
            const embed = new EmbedBuilder().setTitle('🌐 Proxy Management Dashboard').addFields({ name: 'Total', value: `${total}`, inline: true }, { name: 'Active', value: `${active}`, inline: true }, { name: 'Dead', value: `${dead}`, inline: true }).setColor('#3498db').setTimestamp();

            const row1 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('trigger_proxy_modal').setLabel('➕ Upload').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('check_proxies').setLabel('🔄 Check All').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('remove_dead_proxies').setLabel('🗑️ Remove Dead').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('refresh_proxies').setLabel('Refresh').setStyle(ButtonStyle.Secondary)
            );
            const row2 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('proxy_prev_0').setLabel('⬅️ Back').setStyle(ButtonStyle.Secondary).setDisabled(true),
                new ButtonBuilder().setCustomId('proxy_next_0').setLabel('Next ➡️').setStyle(ButtonStyle.Secondary)
            );
            await interaction.reply({ embeds: [embed], components: [row1, row2] });
        }
    },
    {
        data: new SlashCommandBuilder().setName('useragents').setDescription('User-Agent Management Dashboard'),
        async execute(interaction) {
            const total = await UserAgent.countDocuments();
            const embed = new EmbedBuilder().setTitle('🎭 User-Agent Management Dashboard').addFields({ name: 'Total Browser Strings', value: `${total}`, inline: true }).setColor('#f1c40f').setTimestamp();

            const row1 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('trigger_ua_modal').setLabel('➕ Upload').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('refresh_uas').setLabel('Refresh').setStyle(ButtonStyle.Secondary)
            );
            const row2 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('ua_prev_0').setLabel('⬅️ Back').setStyle(ButtonStyle.Secondary).setDisabled(true),
                new ButtonBuilder().setCustomId('ua_next_0').setLabel('Next ➡️').setStyle(ButtonStyle.Secondary)
            );
            await interaction.reply({ embeds: [embed], components: [row1, row2] });
        }
    },
    {
        data: new SlashCommandBuilder().setName('terminate').setDescription('Stop everything'),
        async execute(interaction) {
            engine.terminateAll();
            await interaction.reply("🔴 Stopped.");
        }
    }
];
