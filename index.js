require("dotenv").config();
const {
  ButtonBuilder,
  EmbedBuilder,
  ButtonStyle,
  CommandInteraction,
  AttachmentBuilder,
  REST,
  Routes,
} = require("discord.js");
const {
  createButtonRows,
  editButton,
  commands,
  emojis,
  sleep,
} = require("./utils.js");
const {
  startTime,
  chooseTimeout,
  timeBetweenRounds,
} = require("./config.json");
const { createWheel } = require("./wheel.js");
const Discord = require("discord.js");
const http = require("http");
http
  .createServer(function (req, res) {
    res.write("I'm alive");
    res.end();
  })
  .listen(8080);
const client = new Discord.Client({
  intents: [Discord.IntentsBitField.Flags.Guilds],
});

const Games = new Map();

client.on("ready", async () => {
  // Construct and prepare an instance of the REST module
  const rest = new REST().setToken(process.env.TOKEN);

  try {
    console.log(
      `Started refreshing ${commands.length} application (/) commands.`,
    );

    // The put method is used to fully refresh all commands in the guild with the current set
    const data = await rest.put(Routes.applicationCommands(client.user.id), {
      body: commands,
    });

    console.log(
      `Successfully reloaded ${data.length} application (/) commands.`,
    );
  } catch (error) {
    // And of course, make sure you catch and log any errors!
    console.error(error);
  }

  console.log("I am ready!");
  console.log("Bot By Wick Studio");
});

client.on("interactionCreate", async (interaction) => {
  if (interaction.isCommand()) {
    if (interaction.commandName == "roulette", "روليت") {
      if (await Games.get(interaction.guildId)) {
        // Send a message indicating that a game is already running in this server
        interaction.reply({
          content: "هناك بالفعل لعبة قيد التشغيل.",
          ephemeral: true,
        });
        return;
      }
      const embed = new EmbedBuilder()
        .setTitle("روليت")
        .setColor("#ccc666")
        .setDescription(
          `__**عدد اللاعبين /:**__\n`,
        )
      .addFields(
        {
        name: "__طريقة اللاعب:__",
          value: `**1-** ادخل وخلك رايق  
            **2-** بتبدا اللعبه وبنختار لاعب و بيطرد واحد         
            **3-** دور الي مزعلك و اطرده خله يزعل
            **4-** الحين بتبدا البقاء للأقوى      ،        ،        `
         },{
              name: `__ستبدأ اللعبة خلال__:`,
            value: `**<t:${Math.floor(
              (Date.now() + startTime * 1000) / 1000,
            )}:R>**`,
          },
        );

      const buttons = Array.from(Array(0).keys()).map((i) =>
        new ButtonBuilder()
          .setCustomId(`join_${i + 1}_roulette`)
          .setStyle(ButtonStyle.Secondary)
          .setEmoji(emojis[i]),
      );

      // New buttons
      const randomButton = new ButtonBuilder()
        .setCustomId(`join_random_roulette`)
        .setLabel("دخول")
        .setStyle(ButtonStyle.Success);

      const leaveButton = new ButtonBuilder()
        .setCustomId(`leave_roulette`)
        .setLabel("انسحاب")
        .setStyle(ButtonStyle.Danger);

      const rows = createButtonRows([...buttons, randomButton, leaveButton]);
      await interaction.reply({
        content: "روليت",
        components: rows,
        embeds: [embed],
      });
      Games.set(interaction.guildID, { players: [] });
      const repliedMessage = await interaction.fetchReply();
      setTimeout(async () => {
        repliedMessage.embeds[0].fields[1].value = `\`\`\`Started\`\`\``;
        repliedMessage.edit({
          components: [],
          embeds: [repliedMessage.embeds[0]],
        });
        startGame(interaction, true);
      }, startTime * 1000);
    }
  } else if (interaction.customId.startsWith("join")) {
    // Destructure the custom ID into separate variables
    var [, number] = interaction.customId.split("_");

    // Retrieve the saved game based on guild ID
    const savedGame = await Games.get(interaction.guildID);

    // If no game is found, send a reply indicating no game running in this server
    if (!savedGame) {
      interaction.reply({
        content: "لا توجد لعبة قيد التشغيل حاليا .",
        ephemeral: true,
      });
      return;
    }

    // Check if the user has already joined the game
    if (savedGame.players.some((user) => user.user == interaction.user.id)) {
      interaction.reply({
        content: "لقد انضممت بالفعل.",
        ephemeral: true,
      });
      return;
    }

    if (number == "random") {
      // Get avalibe random button number
      do {
        number = Math.floor(Math.random() * 40) + 1;
      } while (
        savedGame.players.some((player) => player.buttonNumber == number)
      );
    }

    if (savedGame.players.some((user) => user.buttonNumber === number)) {
      interaction.reply({
        content: "تم تسجيل الدخول.",
        ephemeral: true,
      });
      return;
    }
    // Add the user to the game's players list with the corresponding button number
    savedGame.players.push({
      user: interaction.user.id,
      buttonNumber: number,
      username: interaction.user.username,
      avatar: interaction.user.displayAvatarURL({
        size: 256,
        extension: "png",
      }),
      color: interaction.user.hexAccentColor,
    });
    Games.set(interaction.guildId, savedGame);

    // Edit the button label and disable it with the user's username
    const updatedRow = editButton(interaction.message, savedGame.players);
    interaction.message.edit({ components: updatedRow.components });

    // Send a confirmation message indicating successful joining
    interaction.reply({ content: "تم تسجيل الدخول!", ephemeral: true });
  } else if (interaction.customId.startsWith("leave")) {
    // Retrieve the saved game based on guild ID
    const savedGame = await Games.get(interaction.guildID);

    // If no game is found, send a reply indicating no game running in this server
    if (!savedGame) {
      interaction.reply({
        content: "لا توجد لعبة قيد التشغيل حاليا.",
        ephemeral: true,
      });
      return;
    }

    // Check if the user has not joined the game
    if (!savedGame.players.some((user) => user.user == interaction.user.id)) {
      interaction.reply({
        content: "أنت لم تسجل في اللعبة.",
        ephemeral: true,
      });
      return;
    }

    // Find the user in the game and remove them from the players array
    const user = savedGame.players.find(
      (user) => user.user == interaction.user.id,
    );
    savedGame.players = savedGame.players.filter(
      (user) => user.user != interaction.user.id,
    );
    await Games.set(interaction.guildId, savedGame);

    // Edit the button label and disable it
    const updatedRow = editButton(
      interaction.message,
      savedGame.players,
      true,
      user,
    );
    interaction.message.edit({ components: updatedRow.components });

    // Send a reply indicating successful leave
    interaction.reply({ content: "You have been removed from the game.", ephemeral: true });
  } else if (interaction.customId.startsWith("انسحاب")) {
    const savedGame = await Games.get(interaction.guildId);
    // If no game is found, send a reply indicating no game running in this server
    if (!savedGame) {
      interaction.reply({
        content: "لا توجد لعبة قيد التشغيل حاليا.",
        ephemeral: true,
      });
      return;
    }

    if (interaction.user.id != savedGame?.winner.id) {
      // Send a message indicating that the user is not the winner
      interaction.reply({
        content:
          "أنت لست مسجل في اللعبة، لذلك لا يمكنك تنفيذ هذا الإجراء.",
        ephemeral: true,
      });
      return;
    }
    if (Date.now() > savedGame.winner.until) {
      // Send a message indicating that the winner has missed their turn
      interaction.reply({
        content: "لقد فاتك الدور.",
        ephemeral: true,
      });
      return;
    }
    // Remove the user from the game
    savedGame.players = savedGame.players.filter(
      (player) => player.user != interaction.user.id,
    );
    savedGame.winner.id = "";

    await Games.set(interaction.guildId, savedGame);

    // Send a confirmation message that the user has withdrawn
    interaction.reply({
      content: "لقد انسحبت من اللعبة بنجاح.",
      ephemeral: true,
    });
    interaction.channel.send(
      `💣 | <@${interaction.user.id}> إذا انسحب من اللعبة، فستبدأ الجولة التالية خلال ثوانٍ قليلة...`,
    );

    // Start the next round of the game
    startGame(interaction);
  } else if (interaction.customId.startsWith("kick_")) {
    const [, kickedUser] = interaction.customId.split("_");

    const savedGame = await Games.get(interaction.guildId);
    // If no game is found, send a reply indicating no game running in this server
    if (!savedGame) {
      interaction.reply({
        content: "لا توجد لعبة قيد التشغيل حاليا.",
        ephemeral: true,
      });
      return;
    }

    if (interaction.user.id != savedGame?.winner.id) {
      // Send a message indicating that the user is not the winner
      interaction.reply({
        content:
          "ليس دورك في اللعبة، لذلك لا يمكنك طرد اللاعبين.",
        ephemeral: true,
      });
      return;
    }
    if (Date.now() > savedGame.winner.until) {
      // Send a message indicating that the winner has missed their turn
      interaction.reply({
        content: "لقد فاتك دورك.",
        ephemeral: true,
      });
      return;
    }
    savedGame.players = savedGame.players.filter(
      (player) => player.user != kickedUser,
    );
    savedGame.winner.id = "";

    interaction.reply({
      content: "لقد تم طرد اللاعب من اللعبة.",
      ephemeral: true,
    });
    interaction.channel.send(
      `💣 | <@${kickedUser}> تم طردك من اللعبه...`,
    );
    startGame(interaction);
  }
});

/**
 * @param {CommandInteraction} interaction
 */
const startGame = async (interaction, start = false) => {
  const { players } = (await Games.get(interaction.guildId)) || { players: [] };
  if (players.length == 0) {
    await sleep(5);
    // Send a message indicating that the game has been canceled due to no players
    interaction.channel.send({
      content: ":x: تم إلغاء اللعبة: لا يوجد لاعبين.",
    });
    return;
  }
  if (start) {
    await interaction.channel.send({
      content: `✅ | تم تسجيل جميع اللاعبين . ستبدأ الجولة الأولى في بضع ثوان...`,
    });
  }
  await sleep(timeBetweenRounds);
  const colorsGradient = [
    "#32517f",
    "#4876a3",
    "#f8f8f8",
    "#74a6eb",
    "#8ac0ff",
  ];

  const options = players.map((user, index) => ({
    user: user,
    label: user.username,
    color: colorsGradient[index % colorsGradient.length],
  }));

  const winnerOption = options[Math.floor(Math.random() * options.length)];
  const winnerIndex = options.indexOf(winnerOption);
  options[winnerIndex] = {
    ...winnerOption,
    winner: true,
  };

  const savedData = await Games.get(interaction.guildId);
  const time = Date.now() + chooseTimeout * 1000;
  savedData.winner = { id: winnerOption.user.user, until: time };
  await Games.set(interaction.guildId, savedData);
  const image = await createWheel(options, winnerOption.user.avatar);

  const buttons = players
    .filter((user) => user.username != winnerOption.label)
    .map((user) =>
      new ButtonBuilder()
        .setCustomId(`kick_${user.user}`)
        .setStyle(ButtonStyle.Secondary)
        .setLabel(user.username)
        .setEmoji(emojis[Number(user.buttonNumber) - 1]),
    );

  const leaveButton = new ButtonBuilder()
    .setCustomId(`withdrawal`)
    .setLabel("انسحاب")
    .setStyle(ButtonStyle.Danger);

  const rows = createButtonRows([...buttons, leaveButton]);

  const attachment = new AttachmentBuilder(image, { name: "wheel.png" });

  if (players.length <= 2) {
    const embed = new EmbedBuilder()
    .setImage("attachment://wheel.png")
    .setColor("#4876a3")
    await interaction.channel.send({
      content: `** 🏆 | - <@${winnerOption.user.user}> **`,
      embeds: [embed],
      files: [attachment],
    });
    await Games.delete(interaction.guildId);
  } else {
      const embed = new EmbedBuilder()
      .setImage("attachment://wheel.png")
      .setColor("#4876a3")
      .setDescription(
        `** | لديك ثانيه ${chooseTimeout} اختر لاعب لطرده**`,
      );
    await interaction.channel.send({
      content: `**${winnerOption.user.buttonNumber} - <@${winnerOption.user.user}> **`,
      embeds: [embed],
      files: [attachment],
      components: rows,
    });
    setTimeout(async () => {
      const checkUser = await Games.get(interaction.guildId);
      if (
        checkUser?.winner.id == winnerOption.user.user &&
        checkUser.winner.until == time
      ) {
        checkUser.players = checkUser.players.filter(
          (player) => player.user != winnerOption.user.user,
        );
        checkUser.winner.id = "";

        // Update the game state after removing the user
        await Games.set(interaction.guildId, checkUser);

        // Send a message to the channel indicating that the user has been kicked for timeout
        interaction.channel.send(
          `⏰ | <@${winnerOption.user.user}> تم طرده من اللعبة بسبب انتهاء المهلة. الجولة القادمة ستبدأ قريبا...`,
        );

        // Start the next round of the game
        startGame(interaction);
      }
    }, chooseTimeout * 1000);
  }
};

client.login(process.env.TOKEN);
