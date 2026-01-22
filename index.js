require('dotenv').config(); // loads .env

const { 
  Client, 
  GatewayIntentBits, 
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require("discord.js");
const fs = require("fs");

// Create client
const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildMessages, 
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ] 
});

client.once("ready", () => {
  console.log("Bot is online");
});

// --- Assign role dynamically on member join ---
client.on("guildMemberAdd", async (member) => {
  try {
    const data = JSON.parse(fs.readFileSync("joinrole.json", "utf8"));
    if (!data.roleId) return;

    const role = member.guild.roles.cache.get(data.roleId);
    if (!role) return console.log("Join role not found.");

    await member.roles.add(role);
    console.log(`Assigned '${role.name}' to ${member.user.tag}`);
  } catch (error) {
    console.error("Error assigning join role:", error);
  }
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const args = message.content.trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // --- Moderation Commands ---
  if (command === "!ping") return message.reply("pong");

  if (command === "!clear") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) return message.reply("You don’t have permission to clear messages.");
    const amount = parseInt(args[0]);
    if (!amount || amount < 1 || amount > 100) return message.reply("Use: !clear 1-100");

    await message.channel.bulkDelete(amount, true);
    return message.channel.send(`🧹 Deleted ${amount} messages`).then(msg => setTimeout(() => msg.delete(), 3000));
  }

  if (command === "!timeout") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return message.reply("You don’t have permission to timeout members.");
    const member = message.mentions.members.first();
    const minutes = parseInt(args[1]);
    if (!member || !minutes) return message.reply("Use: !timeout @user minutes");

    try {
      await member.timeout(minutes * 60 * 1000, `Timed out by ${message.author.tag}`);
      return message.channel.send(`⏳ ${member.user.tag} has been timed out for ${minutes} minutes.`);
    } catch {
      return message.reply("I cannot timeout this member. Check my role position.");
    }
  }

  if (command === "!kick") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.KickMembers)) return message.reply("You don’t have permission to kick members.");
    const member = message.mentions.members.first();
    if (!member) return message.reply("Mention a member to kick.");
    try {
      await member.kick(`Kicked by ${message.author.tag}`);
      return message.channel.send(`👢 ${member.user.tag} has been kicked.`);
    } catch {
      return message.reply("I cannot kick this member. Check my role position.");
    }
  }

  if (command === "!ban") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) return message.reply("You don’t have permission to ban members.");
    const member = message.mentions.members.first();
    if (!member) return message.reply("Mention a member to ban.");
    try {
      await member.ban({ reason: `Banned by ${message.author.tag}` });
      return message.channel.send(`🔨 ${member.user.tag} has been banned.`);
    } catch {
      return message.reply("I cannot ban this member. Check my role position.");
    }
  }

  if (command === "!warn") {
    const member = message.mentions.members.first();
    const reason = args.slice(1).join(" ");
    if (!member || !reason) return message.reply("Use: !warn @user reason");
    return message.channel.send(`⚠️ ${member.user.tag} has been warned. Reason: ${reason}`);
  }

  // --- Fun Commands ---
  if (command === "!roll") {
    const roll = Math.floor(Math.random() * 6) + 1;
    return message.channel.send(`🎲 You rolled a ${roll}`);
  }

  if (command === "!flip") {
    const result = Math.random() < 0.5 ? "Heads" : "Tails";
    return message.channel.send(`🪙 The coin landed on **${result}**`);
  }

  if (command === "!8ball") {
    if (!args.length) return message.reply("Ask a question: !8ball Will I win?");
    const responses = ["Yes", "No", "Maybe", "Definitely", "Absolutely not", "Ask again later", "I have no idea"];
    const response = responses[Math.floor(Math.random() * responses.length)];
    return message.channel.send(`🎱 ${response}`);
  }

  // --- Dynamic Join Role Command ---
  if (command === "!setjoinrole") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageRoles)) return message.reply("You don’t have permission to set the join role.");
    const role = message.mentions.roles.first();
    if (!role) return message.reply("Mention a role to set as the join role.");
    fs.writeFileSync("joinrole.json", JSON.stringify({ roleId: role.id }, null, 2));
    return message.channel.send(`✅ Join role has been set to: ${role.name}`);
  }

  // --- Support Ticket Command ---
  if (command === "!support") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return message.reply("You don't have permission to send the support message.");

    const embed = new EmbedBuilder()
      .setTitle("🎫 Support Tickets")
      .setDescription("Click the button below to open a private support ticket with the staff team.")
      .setColor(0x00AE86)
      .setFooter({ text: "Support Team" });

    const button = new ButtonBuilder()
      .setCustomId("open_ticket")
      .setLabel("Open Ticket")
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(button);

    return message.channel.send({ embeds: [embed], components: [row] });
  }

  // --- Ticket Close Command ---
  if (command === "!close") {
    if (!message.channel.name.startsWith("ticket-")) {
      return message.reply("This command can only be used inside a ticket channel.");
    }
    try {
      await message.channel.send("🔒 This ticket will be closed in 5 seconds...");
      setTimeout(async () => {
        await message.channel.delete();
      }, 5000);
    } catch (err) {
      console.error(err);
      return message.reply("❌ Failed to close this ticket.");
    }
  }

  // --- Lock Channel Command ---
  if (command === "!lock") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) return message.reply("You don’t have permission to lock channels.");
    try {
      await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, {
        SendMessages: false,
        AddReactions: false
      });
      return message.channel.send("🔒 This channel has been locked.");
    } catch (err) {
      console.error(err);
      return message.reply("❌ Could not lock the channel. Check my permissions.");
    }
  }

  // --- Unlock Channel Command ---
  if (command === "!unlock") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) return message.reply("You don’t have permission to unlock channels.");
    try {
      await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, {
        SendMessages: true,
        AddReactions: true
      });
      return message.channel.send("🔓 This channel has been unlocked.");
    } catch (err) {
      console.error(err);
      return message.reply("❌ Could not unlock the channel. Check my permissions.");
    }
  }

}); // closes messageCreate

// --- Handle ticket button interaction ---
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;
  if (interaction.customId !== "open_ticket") return;

  const guild = interaction.guild;
  const user = interaction.user;

  try {
    const channel = await guild.channels.create({
      name: `ticket-${user.username}`,
      type: 0, // GUILD_TEXT
      permissionOverwrites: [
        { id: guild.id, deny: ["ViewChannel"] },
        { id: user.id, allow: ["ViewChannel", "SendMessages", "AttachFiles", "ReadMessageHistory"] },
        // { id: "STAFF_ROLE_ID", allow: ["ViewChannel", "SendMessages"] } // Optional staff role
      ],
    });

    await channel.send(`Hello ${user}, a staff member will be with you shortly.`);
    await interaction.reply({ content: `✅ Your ticket has been created: ${channel}`, ephemeral: true });
  } catch (err) {
    console.error(err);
    await interaction.reply({ content: "❌ Could not create ticket. Check my permissions.", ephemeral: true });
  }
});

// Login
client.login(process.env.DISCORD_TOKEN);
