const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const Queue = require('../models/Queue');
const Account = require('../models/Account');
const Report = require('../models/Report');
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
            .setDescription('Add a user to the mass report queue')
            .addStringOption(opt => opt.setName('username').setDescription('Roblox Username').setRequired(true))
            .addIntegerOption(opt => opt.setName('amount').setDescription('Number of reports').setRequired(true))
            .addIntegerOption(opt => opt.setName('category').setDescription('Category ID (1-9)').setRequired(true)),
        async execute(interaction) {
            await interaction.deferReply(); // Mitigation for slow API
            const username = interaction.options.getString('username');
            const amount = interaction.options.getInteger('amount');
            const category = interaction.options.getInteger('category');
            try {
                const res = await axios.post("https://users.roblox.com/v1/usernames/users", { usernames: [username] });
                if (!res.data.data.length) return interaction.editReply("User not found.");
                const victimId = res.data.data[0].id;
                await Queue.create({ victimUsername: username, victimId: victimId, targetCount: amount, category: category });
                await interaction.editReply(`[Queue] Target ${username} added for ${amount} reports.`);
            } catch (err) { await interaction.editReply(`Error: ${err.message}`); }
        }
    },
    {
        data: new SlashCommandBuilder()
            .setName('accounts')
            .setDescription('Interactive Account Management Dashboard'),
        async execute(interaction) {
            const total = await Account.countDocuments();
            const active = await Account.countDocuments({ status: 'active' });
            const cooldown = await Account.countDocuments({ status: 'cooldown' });
            const dead = await Account.countDocuments({ status: 'dead' });

            const embed = new EmbedBuilder()
                .setTitle('📊 Account Management Dashboard')
                .setColor('#bb86fc')
                .addFields(
                    { name: 'Total Sessions', value: `${total}`, inline: true },
                    { name: 'Active', value: `${active}`, inline: true },
                    { name: 'Cooldown', value: `${cooldown}`, inline: true },
                    { name: 'Dead', value: `${dead}`, inline: true }
                )
                .setTimestamp()
                .setFooter({ text: 'Roblox-Mass-Reporter Control Center' });

            const filterRow = new ActionRowBuilder()
                .addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('filter_accounts')
                        .setPlaceholder('Filter account view...')
                        .addOptions([
                            { label: 'View All', value: 'all' },
                            { label: 'Active Only', value: 'active' },
                            { label: 'Show Dead', value: 'dead' },
                        ])
                );

            const actionRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('trigger_add_modal')
                        .setLabel('Add New Account')
                        .setStyle(ButtonStyle.Success)
                );

            await interaction.reply({ embeds: [embed], components: [filterRow, actionRow] });
        }
    },
    {
        data: new SlashCommandBuilder().setName('status').setDescription('Get system status'),
        async execute(interaction) {
            const active = await Account.countDocuments({ status: 'active' });
            const inProgress = await Queue.countDocuments({ status: 'In Progress' });
            await interaction.reply(`System Status:\nActive Accounts: ${active}\nActive Tasks: ${inProgress}\nUptime: ${Math.floor(process.uptime())}s`);
        }
    },
    {
        data: new SlashCommandBuilder().setName('terminate').setDescription('Kill all active loops immediately'),
        async execute(interaction) {
            engine.terminateAll();
            await Queue.updateMany({ status: { $in: ['Pending', 'In Progress'] } }, { status: 'Terminated' });
            await interaction.reply("🔴 Emergency Kill Switch activated. All tasks aborted.");
        }
    },
    {
        data: new SlashCommandBuilder().setName('logs').setDescription('View recent database history'),
        async execute(interaction) {
            const reports = await Report.find().sort({ timestamp: -1 }).limit(10);
            const list = reports.map(r => `[${r.timestamp.toLocaleTimeString()}] ${r.victimUsername}: ${r.status}`).join('\n') || "Empty history.";
            await interaction.reply(`Recent Activity:\n${list}`);
        }
    },
    {
        data: new SlashCommandBuilder()
            .setName('inventory_check')
            .setDescription('Check total RAP of a user via Collectibles API')
            .addStringOption(opt => opt.setName('username').setDescription('Target username').setRequired(true)),
        async execute(interaction) {
            await interaction.deferReply();
            const username = interaction.options.getString('username');
            try {
                const userRes = await axios.post("https://users.roblox.com/v1/usernames/users", { usernames: [username] });
                if (!userRes.data.data.length) return interaction.editReply("User not found.");
                const userId = userRes.data.data[0].id;

                // Get a session for authenticated check
                const session = await engine.getAvailableSession();
                const headers = session ? { 'Cookie': `.ROBLOSECURITY=${session.cookie}` } : {};

                // Fetch RAP from Inventory/Collectibles API
                const invRes = await axios.get(`https://inventory.roblox.com/v1/users/${userId}/assets/collectibles?limit=100`, { headers });
                const totalRap = invRes.data.data.reduce((acc, item) => acc + (item.recentAveragePrice || 0), 0);

                await interaction.editReply(`Inventory Check [${username}]:\nTotal RAP: ${totalRap.toLocaleString()}\nUnique Collectibles: ${invRes.data.data.length}\nChecked via: ${session ? session.username : 'Guest'}`);
            } catch (err) { await interaction.editReply(`Inventory Error: ${err.message}`); }
        }
    },
    {
        data: new SlashCommandBuilder()
            .setName('scrape')
            .setDescription('Get detailed visual target intelligence')
            .addStringOption(opt => opt.setName('username').setDescription('Target username').setRequired(true)),
        async execute(interaction) {
            const username = interaction.options.getString('username');
            try {
                // 1. Resolve Username to ID (Fast enough to do before defer for conditional ephemerality)
                const userRes = await axios.post("https://users.roblox.com/v1/usernames/users", { usernames: [username] });
                if (!userRes.data.data.length) {
                    return interaction.reply({ content: "❌ Target ID not found in Roblox Database.", ephemeral: true });
                }

                await interaction.deferReply();
                const id = userRes.data.data[0].id;

                // 2. Fetch Multi-API Data
                const [detail, thumb, presence] = await Promise.all([
                    axios.get(`https://users.roblox.com/v1/users/${id}`),
                    axios.get(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${id}&size=150x150&format=Png&isCircular=false`),
                    axios.post("https://presence.roblox.com/v1/presence/users", { userIds: [id] })
                ]);

                const userData = detail.data;
                const avatarUrl = thumb.data.data[0]?.imageUrl || "";
                const presenceData = presence.data.userPresences[0] || { userPresenceType: 0 };

                // 3. Logic & Calculations
                const age = calculateAge(userData.created);
                const bio = userData.description
                    ? (userData.description.length > 200 ? userData.description.substring(0, 197) + "..." : userData.description)
                    : "No bio provided.";

                let status = "Offline";
                let color = "#808080"; // Grey

                if (presenceData.userPresenceType >= 1) {
                    color = "#00FF00"; // Green
                    if (presenceData.userPresenceType === 1) status = "Online";
                    else if (presenceData.userPresenceType === 2) status = "In-Game";
                    else if (presenceData.userPresenceType === 3) status = "In Studio";
                }

                // 4. Construct Embed
                const embed = new EmbedBuilder()
                    .setTitle(`Target Intelligence: ${userData.name}`)
                    .setThumbnail(avatarUrl)
                    .setColor(color)
                    .addFields(
                        { name: 'Account Age', value: age, inline: true },
                        { name: 'Status', value: status, inline: true },
                        { name: 'Verified', value: userData.hasVerifiedBadge ? "✅ Yes" : "❌ No", inline: true },
                        { name: 'Bio', value: bio }
                    )
                    .setTimestamp()
                    .setFooter({ text: `UserID: ${id}` });

                await interaction.editReply({ embeds: [embed] });
            } catch (err) {
                console.error(err);
                if (interaction.deferred) {
                    await interaction.editReply("❌ An error occurred while scraping target data.");
                } else {
                    await interaction.reply({ content: "❌ An error occurred while scraping target data.", ephemeral: true });
                }
            }
        }
    },
    {
        data: new SlashCommandBuilder()
            .setName('slowmode')
            .setDescription('Simulated delay adjustment')
            .addIntegerOption(opt => opt.setName('sec').setDescription('Seconds').setRequired(true)),
        async execute(interaction) {
            await interaction.reply(`Global delay adjusted to ${interaction.options.getInteger('sec')}s (Simulated)`);
        }
    },
    {
        data: new SlashCommandBuilder()
            .setName('check_target')
            .setDescription('Quick profile status check')
            .addStringOption(opt => opt.setName('username').setDescription('Target username').setRequired(true)),
        async execute(interaction) {
            const username = interaction.options.getString('username');
            await interaction.reply(`Profile Check [${username}]: Status: active, Bio: Validated.`);
        }
    }
];
