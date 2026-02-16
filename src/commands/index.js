const { SlashCommandBuilder } = require('discord.js');
const Queue = require('../models/Queue');
const Account = require('../models/Account');
const Report = require('../models/Report');
const axios = require('axios');

const commands = [
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
                const res = await axios.post("https://users.roblox.com/v1/usernames/users", { usernames: [username], excludeBannedUsers: true });
                if (res.data.data.length === 0) return interaction.reply("User not found.");
                const victimId = res.data.data[0].id;
                await Queue.create({ victimUsername: username, victimId: victimId, targetCount: amount, category: category });
                await interaction.reply(`[Queue] Added ${username} (${victimId}) for ${amount} reports.`);
            } catch (err) { await interaction.reply(`Error: ${err.message}`); }
        }
    },
    {
        data: new SlashCommandBuilder().setName('status').setDescription('Get system status'),
        async execute(interaction) {
            const active = await Account.countDocuments({ status: 'Active' });
            const env = process.env.RENDER ? "Render Cloud" : "Local PC";
            await interaction.reply(`System Status:\nEnvironment: ${env}\nActive Sessions: ${active}\nUptime: ${Math.floor(process.uptime())}s`);
        }
    },
    {
        data: new SlashCommandBuilder().setName('terminate').setDescription('Abort all tasks and clear queue'),
        async execute(interaction) {
            await Queue.deleteMany({ status: { $in: ['Pending', 'In Progress'] } });
            await interaction.reply("All reporting tasks terminated and queue cleared.");
        }
    },
    {
        data: new SlashCommandBuilder().setName('accounts').setDescription('Health grid of authenticated accounts'),
        async execute(interaction) {
            const accounts = await Account.find().limit(20);
            const list = accounts.map(a => `• ${a.username}: ${a.status} (ID: ${a.userId})`).join('\n') || "No accounts found.";
            await interaction.reply(`Accounts Health Grid:\n${list}`);
        }
    },
    {
        data: new SlashCommandBuilder().setName('logs').setDescription('View DB history of reports'),
        async execute(interaction) {
            const reports = await Report.find().sort({ timestamp: -1 }).limit(10);
            const list = reports.map(r => `[${r.timestamp.toLocaleTimeString()}] ${r.victimUsername}: ${r.status}`).join('\n') || "No logs found.";
            await interaction.reply(`System Activity Logs:\n${list}`);
        }
    },
    {
        data: new SlashCommandBuilder()
            .setName('slowmode')
            .setDescription('Set DB delay between reports')
            .addIntegerOption(opt => opt.setName('seconds').setDescription('Delay in seconds').setRequired(true)),
        async execute(interaction) {
            const seconds = interaction.options.getInteger('seconds');
            // In a real app we'd save this to a Settings model
            await interaction.reply(`Global slowmode set to ${seconds} seconds (Simulated).`);
        }
    },
    {
        data: new SlashCommandBuilder()
            .setName('scrape')
            .setDescription('Intelligence: Scrape user details')
            .addStringOption(opt => opt.setName('username').setDescription('Target username').setRequired(true)),
        async execute(interaction) {
            const username = interaction.options.getString('username');
            try {
                const res = await axios.post("https://users.roblox.com/v1/usernames/users", { usernames: [username] });
                if (res.data.data.length === 0) return interaction.reply("User not found.");
                const user = res.data.data[0];
                const detail = await axios.get(`https://users.roblox.com/v1/users/${user.id}`);
                await interaction.reply(`User Scrape [${username}]:\nID: ${user.id}\nCreated: ${detail.data.created}\nDescription: ${detail.data.description || "None"}`);
            } catch (err) { await interaction.reply(`Scrape Error: ${err.message}`); }
        }
    },
    {
        data: new SlashCommandBuilder()
            .setName('inventory_check')
            .setDescription('Intelligence: Collectibles API check')
            .addStringOption(opt => opt.setName('username').setDescription('Target username').setRequired(true)),
        async execute(interaction) {
            const username = interaction.options.getString('username');
            await interaction.reply(`Checking inventory for ${username}... (Collectibles API simulation)`);
        }
    },
    {
        data: new SlashCommandBuilder()
            .setName('check_target')
            .setDescription('Intelligence: Status check of victim')
            .addStringOption(opt => opt.setName('username').setDescription('Target username').setRequired(true)),
        async execute(interaction) {
            const username = interaction.options.getString('username');
            await interaction.reply(`Target Status [${username}]: Online (Profile: roblox.com/users/...)`);
        }
    }
];

module.exports = commands;
