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
            .setDescription('Setup a mass report for a user')
            .addStringOption(opt => opt.setName('username').setDescription('Target username').setRequired(true)),
        async execute(interaction) {
            await interaction.deferReply();
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

                target = {
                    id: id,
                    username: detail.data.name,
                    joined: detail.data.created,
                    avatar: thumb.data.data[0]?.imageUrl,
                    online: presence.data.userPresences[0]?.userPresenceType >= 1
                };
            } catch (err) {
                return interaction.editReply(`❌ Error fetching target: ${err.message}`);
            }

            // Step 1: Target Profile
            const embed = new EmbedBuilder()
                .setTitle(`Report Setup: ${target.username}`)
                .setThumbnail(target.avatar)
                .addFields(
                    { name: 'Joined', value: new Date(target.joined).toLocaleDateString(), inline: true },
                    { name: 'Account Age', value: calculateAge(target.joined), inline: true },
                    { name: 'Online Status', value: target.online ? "🟢 Online" : "⚪ Offline", inline: true }
                )
                .setColor('#3498db')
                .setFooter({ text: 'Step 1: Verify Target' });

            const nextBtn = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('next_to_reason').setLabel('Continue to Reason').setStyle(ButtonStyle.Primary)
            );

            const msg = await interaction.editReply({ embeds: [embed], components: [nextBtn] });

            const state = {
                reason: null,
                delay: 2,
                selectedAccounts: [],
                page: 0
            };

            const collector = msg.createMessageComponentCollector({ time: 300000 });

            collector.on('collect', async i => {
                if (i.user.id !== interaction.user.id) return i.reply({ content: "This menu is not for you.", ephemeral: true });

                if (i.customId === 'next_to_reason') {
                    const reasonRow = new ActionRowBuilder().addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId('select_reason')
                            .setPlaceholder('Pick a reason...')
                            .addOptions(Object.entries(engine.reasonMap).map(([key, val]) => ({
                                label: val.label,
                                value: key
                            })))
                    );
                    await i.update({ content: "### Step 2: Why are you reporting them?", embeds: [], components: [reasonRow] });
                }

                if (i.customId === 'select_reason') {
                    state.reason = i.values[0];
                    const delayRow = new ActionRowBuilder().addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId('select_delay')
                            .setPlaceholder('Select delay between reports...')
                            .addOptions([
                                { label: '1 Second', value: '1' },
                                { label: '3 Seconds', value: '3' },
                                { label: '5 Seconds', value: '5' },
                                { label: '10 Seconds', value: '10' },
                                { label: '15 Seconds', value: '15' }
                            ])
                    );
                    await i.update({ content: "### Step 3: How fast should we send reports?", components: [delayRow] });
                }

                if (i.customId === 'select_delay') {
                    state.delay = parseInt(i.values[0]);
                    await updateAccountPicker(i);
                }

                if (i.customId === 'prev_page' || i.customId === 'next_page') {
                    state.page += (i.customId === 'next_page' ? 1 : -1);
                    await updateAccountPicker(i);
                }

                if (i.customId === 'select_accounts') {
                    state.selectedAccounts = i.values;
                    const goRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('go_seq').setLabel('Go (Sequential)').setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId('go_rand').setLabel('Go (Randomize)').setStyle(ButtonStyle.Secondary)
                    );
                    await i.update({ content: `### Final Step: Ready to start?\nSelected: **${state.selectedAccounts.length} accounts**`, components: [goRow] });
                }

                if (i.customId === 'go_seq' || i.customId === 'go_rand') {
                    collector.stop();
                    const isRandom = i.customId === 'go_rand';
                    await i.update({ content: "🚀 Starting report run...", components: [] });
                    await engine.executeMassReport(interaction, target, state.reason, state.delay, state.selectedAccounts, isRandom);
                }
            });

            async function updateAccountPicker(i) {
                const allAccounts = await Account.find({ status: 'active' });
                const pageSize = 25;
                const totalPages = Math.ceil(allAccounts.length / pageSize);
                const start = state.page * pageSize;
                const pageItems = allAccounts.slice(start, start + pageSize);

                const menu = new StringSelectMenuBuilder()
                    .setCustomId('select_accounts')
                    .setPlaceholder(`Pick accounts (Page ${state.page + 1}/${totalPages})`)
                    .setMinValues(1)
                    .setMaxValues(pageItems.length)
                    .addOptions(pageItems.map(a => ({
                        label: a.username,
                        value: a._id.toString(),
                        description: `ID: ${a.userId}`
                    })));

                const buttons = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('prev_page').setLabel('Previous').setStyle(ButtonStyle.Secondary).setDisabled(state.page === 0),
                    new ButtonBuilder().setCustomId('next_page').setLabel('Next').setStyle(ButtonStyle.Secondary).setDisabled(state.page >= totalPages - 1)
                );

                const rows = [new ActionRowBuilder().addComponents(menu)];
                if (totalPages > 1) rows.push(buttons);

                await i.update({ content: "### Step 4: Which accounts should we use?", components: rows });
            }
        }
    },
    {
        data: new SlashCommandBuilder()
            .setName('reports')
            .setDescription('View report history and bot performance'),
        async execute(interaction) {
            await interaction.deferReply();
            const totalSuccess = await Report.countDocuments({ status: 'Success' });
            const cooldownCount = await Account.countDocuments({ status: 'cooldown' });
            const deadCount = await Account.countDocuments({ status: 'dead' });

            const statsEmbed = new EmbedBuilder()
                .setTitle('📊 Bot Performance Dashboard')
                .setColor('#3498db')
                .addFields(
                    { name: 'Total Successes', value: `${totalSuccess}`, inline: true },
                    { name: 'Accounts in Cooldown', value: `${cooldownCount}`, inline: true },
                    { name: 'Broken Sessions', value: `${deadCount}`, inline: true }
                )
                .setTimestamp();

            const filterRow = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('history_filter')
                    .setPlaceholder('What would you like to see?')
                    .addOptions([
                        { label: 'Recent History', value: 'recent', description: 'Last 15 reports sent' },
                        { label: 'Failed Reports', value: 'failed', description: 'Reports with 400 or 403 errors' },
                        { label: 'Search by Target', value: 'search', description: 'View history for a specific person' }
                    ])
            );

            const msg = await interaction.editReply({ embeds: [statsEmbed], components: [filterRow] });
            const collector = msg.createMessageComponentCollector({ time: 60000 });

            collector.on('collect', async i => {
                const filter = i.values[0];
                if (filter === 'recent') {
                    const recent = await Report.find().sort({ timestamp: -1 }).limit(15);
                    const list = recent.map(r => `• ${r.victimUsername}: ${r.status}`).join('\n') || "No history yet.";
                    await i.update({ content: `### Recent History\n${list}`, embeds: [], components: [filterRow] });
                } else if (filter === 'failed') {
                    const failed = await Report.find({ errorCode: { $in: [400, 403] } }).sort({ timestamp: -1 }).limit(15);
                    const list = failed.map(r => `• ${r.victimUsername}: Error ${r.errorCode} (${r.errorType})`).join('\n') || "No failed reports found.";
                    await i.update({ content: `### Failed Reports (Broken Sessions)\n${list}`, embeds: [], components: [filterRow] });
                } else if (filter === 'search') {
                    await i.update({ content: "Please use `/reports_search [username]` to search for a specific target.", components: [] });
                }
            });
        }
    },
    {
        data: new SlashCommandBuilder()
            .setName('reports_search')
            .setDescription('Search history for a specific person')
            .addStringOption(opt => opt.setName('username').setDescription('Target username').setRequired(true)),
        async execute(interaction) {
            const username = interaction.options.getString('username');
            const history = await Report.find({ victimUsername: new RegExp(username, 'i') }).sort({ timestamp: -1 }).limit(15);
            const list = history.map(r => `• ${r.timestamp.toLocaleDateString()}: ${r.status}`).join('\n') || "No history found for this user.";
            await interaction.reply({ content: `### Search Results: ${username}\n${list}` });
        }
    },
    {
        data: new SlashCommandBuilder()
            .setName('scrape')
            .setDescription('Get detailed target intelligence')
            .addStringOption(opt => opt.setName('username').setDescription('Target username').setRequired(true)),
        async execute(interaction) {
            await interaction.deferReply();
            const username = interaction.options.getString('username');
            try {
                const userRes = await axios.post("https://users.roblox.com/v1/usernames/users", { usernames: [username] });
                if (!userRes.data.data.length) return interaction.editReply("❌ User not found.");
                const id = userRes.data.data[0].id;
                const [detail, thumb, presence] = await Promise.all([
                    axios.get(`https://users.roblox.com/v1/users/${id}`),
                    axios.get(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${id}&size=150x150&format=Png&isCircular=false`),
                    axios.post("https://presence.roblox.com/v1/presence/users", { userIds: [id] })
                ]);
                const embed = new EmbedBuilder()
                    .setTitle(`Intelligence: ${detail.data.name}`)
                    .setThumbnail(thumb.data.data[0]?.imageUrl)
                    .addFields(
                        { name: 'Account Age', value: calculateAge(detail.data.created), inline: true },
                        { name: 'Status', value: presence.data.userPresences[0]?.userPresenceType >= 1 ? "🟢 Online" : "⚪ Offline", inline: true },
                        { name: 'UserID', value: `${id}`, inline: true }
                    ).setColor('#2ecc71');
                await interaction.editReply({ embeds: [embed] });
            } catch (err) { await interaction.editReply(`❌ Error: ${err.message}`); }
        }
    },
    {
        data: new SlashCommandBuilder().setName('status').setDescription('Get system status'),
        async execute(interaction) {
            const active = await Account.countDocuments({ status: 'active' });
            const inProgress = await Queue.countDocuments({ status: 'In Progress' });
            await interaction.reply(`### System Status\nActive Accounts: **${active}**\nActive Tasks: **${inProgress}**\nUptime: **${Math.floor(process.uptime())}s**`);
        }
    },
    {
        data: new SlashCommandBuilder().setName('terminate').setDescription('Stop everything immediately'),
        async execute(interaction) {
            engine.terminateAll();
            await interaction.reply("🔴 Everything has been stopped.");
        }
    },
    {
        data: new SlashCommandBuilder()
            .setName('inventory_check')
            .setDescription('Check total RAP of a user')
            .addStringOption(opt => opt.setName('username').setDescription('Target username').setRequired(true)),
        async execute(interaction) {
            await interaction.deferReply();
            const username = interaction.options.getString('username');
            try {
                const userRes = await axios.post("https://users.roblox.com/v1/usernames/users", { usernames: [username] });
                if (!userRes.data.data.length) return interaction.editReply("❌ User not found.");
                const userId = userRes.data.data[0].id;
                const invRes = await axios.get(`https://inventory.roblox.com/v1/users/${userId}/assets/collectibles?limit=100`);
                const totalRap = invRes.data.data.reduce((acc, item) => acc + (item.recentAveragePrice || 0), 0);
                await interaction.editReply(`### Inventory: ${username}\nTotal RAP: **${totalRap.toLocaleString()}**\nUnique Items: **${invRes.data.data.length}**`);
            } catch (err) { await interaction.editReply(`❌ Error: ${err.message}`); }
        }
    },
    {
        data: new SlashCommandBuilder()
            .setName('slowmode')
            .setDescription('Set global delay (Simulation)')
            .addIntegerOption(opt => opt.setName('sec').setDescription('Seconds').setRequired(true)),
        async execute(interaction) {
            await interaction.reply(`Global delay set to ${interaction.options.getInteger('sec')}s.`);
        }
    },
    {
        data: new SlashCommandBuilder().setName('accounts').setDescription('Manage your accounts'),
        async execute(interaction) {
            const total = await Account.countDocuments();
            const active = await Account.countDocuments({ status: 'active' });
            const embed = new EmbedBuilder().setTitle('Account Hub').setDescription(`Total: ${total}\nWorking: ${active}`).setColor('#9b59b6');
            const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('trigger_add_modal').setLabel('Add Account').setStyle(ButtonStyle.Success));
            await interaction.reply({ embeds: [embed], components: [row] });
        }
    }
];
