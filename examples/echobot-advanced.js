import BotCli, { hasCommand, getCommandPayload } from "dcbot-cli";
import { C } from "@deltachat/jsonrpc-client";

const HELP = `Help:
I will echo back any text you send to me.

Commands:
/help get the bot's help
/echo echo some text back, ex: /echo hello`;

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

    if (hasCommand("/help", msg.text)) {
      await bot.rpc.sendMsg(accountId, chatId, { text: HELP });
      return;
    }

    if (hasCommand("/echo", msg.text)) {
      const payload = getCommandPayload("/echo", msg.text);
      if (payload) {
        await bot.rpc.sendMsg(accountId, chatId, {
          text: payload,
          quotedMessageId: msgId,
        });
      }
      return;
    }

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
