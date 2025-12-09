# dcbot-cli-js

Javascript (nodejs/[deno](https://deno.com/)) library to make easier [DeltaChat](https://delta.chat) [Bot](https://bots.delta.chat) development.

## Install

### nodejs

```sh
pnpm install dcbot-cli
```

### deno

```sh
deno add npm:dcbot-cli
```

## Usage

Let's create a simple echobot, first create a file named "echobot.js" and add this code:

```javascript
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
```

Now add an account to the bot:

```sh
node echobot.js init dcaccount:https://nine.testrun.org/new
```

You can also use email and password instead of a chatmail account:

```sh
node echobot.js init username@example.com password
```

Now get the bot's link:

```sh
node echobot.js link
```

And finally run the bot:

```sh
node echobot.js serve
```

Now just use the bot's link to contact it in DeltaChat. It will echo back any text you send to it.

To see all commands:

```sh
node echobot.js --help
```

You can also check the [examples](./examples) folder.

This is basically a small wrapper around the official [Chatmail core](https://github.com/chatmail/core/) [Npm package](https://www.npmjs.com/package/@deltachat/jsonrpc-client) so you will probably want to see [its Javascript API](https://js.jsonrpc.delta.chat/).

## Development

### Install dependencies

```sh
pnpm install
```

### Build

```sh
pnpm run build
```

This will transpile the typescript code to javascript using `tsc`.

To use it in watch mode:

```sh
pnpm run dev
```
