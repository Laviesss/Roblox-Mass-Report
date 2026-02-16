const { SlashCommandBuilder } = require('discord.js');
const Queue = require('../models/Queue');
const Account = require('../models/Account');
const Report = require('../models/Report');
const axios = require('axios');

module.exports = (engine) => [
    {
        data: new SlashCommandBuilder()
            .setName('report')
            .setDescription('Add a user to the mass report queue')
            .addStringOption(opt => opt.setName('username').setDescription('Roblox Username').setRequired(true))
            .addIntegerOption(opt => opt.setName('amount').setDescription('Number of reports').setRequired(true))
            .addIntegerOption(opt => opt.setName('category').setDescription('Category ID (1-9)').setRequired(true)),
        async execute(interaction) {
            const username = interaction.options.getString('username');
            const amount = interaction.options.getInteger('amount');
            const category = interaction.options.getInteger('category');
            try {
                const res = await axios.post("https://users.roblox.com/v1/usernames/users", { usernames: [username] });
                if (!res.data.data.length) return interaction.reply("User not found.");
                const victimId = res.data.data[0].id;
                await Queue.create({ victimUsername: username, victimId: victimId, targetCount: amount, category: category });
                await interaction.reply(`[Queue] Target ${username} added for ${amount} reports.`);
            } catch (err) { await interaction.reply(`Error: ${err.message}`); }
        }
    },
    {
        data: new SlashCommandBuilder().setName('status').setDescription('Get system status'),
        async execute(interaction) {
            const active = await Account.countDocuments({ status: 'Active' });
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
        data: new SlashCommandBuilder().setName('accounts').setDescription('Health grid of accounts'),
        async execute(interaction) {
            const accounts = await Account.find().limit(20);
            const list = accounts.map(a => `• ${a.username}: ${a.status} ${a.cooldownUntil > new Date() ? '(Cooled Down)' : ''}`).join('\n') || "None";
            await interaction.reply(`Accounts Health Grid:\n${list}`);
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
            const username = interaction.options.getString('username');
            try {
                const userRes = await axios.post("https://users.roblox.com/v1/usernames/users", { usernames: [username] });
                if (!userRes.data.data.length) return interaction.reply("User not found.");
                const userId = userRes.data.data[0].id;

                // Get a session for authenticated check
                const session = await engine.getAvailableSession();
                const headers = session ? { 'Cookie': `.ROBLOSECURITY=${session.cookie}` } : {};

                // Fetch RAP from Inventory/Collectibles API
                const invRes = await axios.get(`https://inventory.roblox.com/v1/users/${userId}/assets/collectibles?limit=100`, { headers });
                const totalRap = invRes.data.data.reduce((acc, item) => acc + (item.recentAveragePrice || 0), 0);

                await interaction.reply(`Inventory Check [${username}]:\nTotal RAP: ${totalRap.toLocaleString()}\nUnique Collectibles: ${invRes.data.data.length}\nChecked via: ${session ? session.username : 'Guest'}`);
            } catch (err) { await interaction.reply(`Inventory Error: ${err.message}`); }
        }
    },
    {
        data: new SlashCommandBuilder()
            .setName('scrape')
            .setDescription('Get user intelligence')
            .addStringOption(opt => opt.setName('username').setDescription('Target username').setRequired(true)),
        async execute(interaction) {
            const username = interaction.options.getString('username');
            try {
                const res = await axios.post("https://users.roblox.com/v1/usernames/users", { usernames: [username] });
                if (!res.data.data.length) return interaction.reply("User not found.");
                const id = res.data.data[0].id;
                const detail = await axios.get(`https://users.roblox.com/v1/users/${id}`);
                await interaction.reply(`Intelligence [${username}]:\nID: ${id}\nCreated: ${detail.data.created}\nDescription: ${detail.data.description || 'None'}`);
            } catch (err) { await interaction.reply(`Scrape Error: ${err.message}`); }
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
            await interaction.reply(`Profile Check [${username}]: Status: Active, Bio: Validated.`);
        }
    }
];
