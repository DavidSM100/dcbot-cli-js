import BotCli from "dcbot-cli";

const bot = new BotCli("echobot");

bot.on("IncomingMsg", async (accountId, { chatId, msgId }) => {
  try {
    const msg = await bot.rpc.getMessage(accountId, msgId);
    await bot.rpc.sendMsg(accountId, chatId, { text: msg.text });
  } catch (err) {
    console.trace(err);
  }
});

bot.start();
