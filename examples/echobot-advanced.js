import BotCli from "dcbot-cli";
import { C } from "@deltachat/jsonrpc-client";

const bot = new BotCli("echobot");

bot.on("IncomingMsg", async (accountId, { chatId, msgId }) => {
  try {
    // Send read receipt
    bot.rpc.markseenMsgs(accountId, [msgId]);

    const chatInfo = await bot.rpc.getBasicChatInfo(accountId, chatId);
    // Only echo to DM chats
    if (chatInfo.chatType !== C.DC_CHAT_TYPE_SINGLE) return;

    const msg = await bot.rpc.getMessage(accountId, msgId);
    if (!msg.text) return;

    await bot.rpc.sendMsg(accountId, chatId, {
      text: msg.text,
      // Quote received message
      quotedMessageId: msgId,
    });
  } catch (err) {
    console.trace(err);
  }
});

bot.start();
