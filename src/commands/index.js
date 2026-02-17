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
    if (months < 0) { years--; months += 12; }
    return `${years} Years, ${months} Months`;
};

module.exports = (engine) => [
    {
        data: new SlashCommandBuilder()
            .setName('report')
            .setDescription('Universal Takedown Wizard')
            .addStringOption(opt => opt.setName('id').setDescription('Target ID (User, Group, or Asset)').setRequired(true)),
        async execute(interaction) {
            await interaction.deferReply({ ephemeral: true });

            const targetId = interaction.options.getString('id');

            // Stage 1: Domain Selection
            const domainRow = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('select_domain')
                    .setPlaceholder('Pick Target Domain...')
                    .addOptions([
                        { label: 'User Profile (Ban)', value: 'BAN', description: 'Report a specific user ID.' },
                        { label: 'Marketplace Asset', value: 'ASSET', description: 'Report a hat, shirt, or model.' },
                        { label: 'Experience (Game)', value: 'GAME', description: 'Report a place or universe ID.' },
                        { label: 'Group Entity', value: 'GROUP', description: 'Report an entire group.' }
                    ])
            );

            const msg = await interaction.editReply({ content: `### Universal Takedown: ID ${targetId}\nSelect the target category below:`, components: [domainRow] });

            const state = { targetId, type: null, reason: null, delay: 2, selectedAccounts: new Set(), isFullWipe: false };
            const collector = msg.createMessageComponentCollector({ time: 600000 });

            collector.on('collect', async i => {
                if (i.customId === 'select_domain') {
                    state.type = i.values[0];
                    // Step 2: Reason
                    const row = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('select_reason').setPlaceholder('Reason...').addOptions(Object.entries(engine.reasonMap).map(([key, val]) => ({ label: val.label, value: key }))));
                    await i.update({ content: "### Step 2: Reason Selection", components: [row] });
                } else if (i.customId === 'select_reason') {
                    state.reason = i.values[0];
                    // Step 3: Options (Wipe Toggle)
                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('toggle_wipe_on').setLabel('Full Wipe: ON').setStyle(ButtonStyle.Danger),
                        new ButtonBuilder().setCustomId('toggle_wipe_off').setLabel('Full Wipe: OFF').setStyle(ButtonStyle.Secondary)
                    );
                    await i.update({ content: "### Step 3: Deep Scraper\nDo you want to find and report all linked assets/games?", components: [row] });
                } else if (i.customId.startsWith('toggle_wipe')) {
                    state.isFullWipe = i.customId === 'toggle_wipe_on';
                    // Step 4: Delay
                    const row = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('select_delay').setPlaceholder('Speed...').addOptions([{label:'1s',value:'1'},{label:'3s',value:'3'},{label:'5s',value:'5'},{label:'10s',value:'10'},{label:'15s',value:'15'}]));
                    await i.update({ content: "### Step 4: Delay Selection", components: [row] });
                } else if (i.customId === 'select_delay') {
                    state.delay = parseInt(i.values[0]);
                    await updateAccountPicker(i);
                } else if (i.customId.startsWith('proxy_') || i.customId.startsWith('ua_')) {
                    // Logic from server.js for these specific dashboard interactions?
                    // No, this collector is for /report wizard.
                } else if (i.customId === 'prev_page' || i.customId === 'next_page') {
                    // Pagination logic
                    // Actually, I need a custom pagination for account picker here.
                } else if (i.customId === 'select_accounts') {
                    i.values.forEach(val => state.selectedAccounts.add(val));
                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('go_seq').setLabel('Start (Sequential)').setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId('go_rand').setLabel('Start (Randomize)').setStyle(ButtonStyle.Secondary)
                    );
                    await i.update({ content: `### Final Step: Launch\nSelected: **${state.selectedAccounts.size} accounts**`, components: [row] });
                } else if (i.customId === 'go_seq' || i.customId === 'go_rand') {
                    collector.stop();
                    await i.update({ content: "🚀 Mission Launched. Monitoring progress...", components: [] });
                    await engine.executeMassReport(interaction, { id: state.targetId, username: state.targetId, type: state.type }, state.reason, state.delay, Array.from(state.selectedAccounts), i.customId === 'go_rand', state.isFullWipe);
                }
            });

            async function updateAccountPicker(i) {
                const allAccounts = await Account.find({ status: 'active' });
                const pageSize = 25;
                const menu = new StringSelectMenuBuilder().setCustomId('select_accounts').setPlaceholder(`Pick Accounts...`).setMinValues(1).setMaxValues(Math.min(allAccounts.length, 25)).addOptions(allAccounts.slice(0, 25).map(a => ({ label: a.username, value: a._id.toString() })));
                const row = new ActionRowBuilder().addComponents(menu);
                await i.update({ content: "### Step 5: Account Selection", components: [row] });
            }
        }
    },
    {
        data: new SlashCommandBuilder().setName('proxies').setDescription('Proxy Dashboard'),
        async execute(interaction) {
            await interaction.deferReply({ ephemeral: true });
            const total = await Proxy.countDocuments();
            const embed = new EmbedBuilder().setTitle('🌐 Proxy Management').addFields({ name: 'Total', value: `${total}`, inline: true }).setColor('#3498db');
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('trigger_proxy_modal').setLabel('➕ Upload').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('check_proxies').setLabel('🔄 Check All').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('remove_dead_proxies').setLabel('🗑️ Purge Dead').setStyle(ButtonStyle.Danger)
            );
            await interaction.editReply({ embeds: [embed], components: [row] });
        }
    },
    {
        data: new SlashCommandBuilder().setName('useragents').setDescription('UA Dashboard'),
        async execute(interaction) {
            await interaction.deferReply({ ephemeral: true });
            const total = await UserAgent.countDocuments();
            const embed = new EmbedBuilder().setTitle('🎭 Identity Dashboard').addFields({ name: 'Strings', value: `${total}`, inline: true }).setColor('#f1c40f');
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('trigger_ua_modal').setLabel('➕ Upload').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('refresh_uas').setLabel('Refresh').setStyle(ButtonStyle.Secondary)
            );
            await interaction.editReply({ embeds: [embed], components: [row] });
        }
    },
    {
        data: new SlashCommandBuilder().setName('accounts').setDescription('Fleet Hub'),
        async execute(interaction) {
            await interaction.deferReply({ ephemeral: true });
            const ready = await Account.countDocuments({ status: 'active' });
            const embed = new EmbedBuilder().setTitle('📊 Fleet Management').addFields({ name: 'Ready', value: `${ready}`, inline: true }).setColor('#9b59b6');
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('trigger_add_modal').setLabel('➕ Upload').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('force_reset_cooldowns').setLabel('🔄 Force Reset').setStyle(ButtonStyle.Danger)
            );
            await interaction.editReply({ embeds: [embed], components: [row] });
        }
    },
    {
        data: new SlashCommandBuilder().setName('terminate').setDescription('Kill Switch'),
        async execute(interaction) {
            engine.terminateAll();
            await interaction.reply({ content: "🔴 STOPPED ALL LOOPS.", ephemeral: true });
        }
    }
];
