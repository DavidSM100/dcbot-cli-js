import envPaths from "env-paths";
import path from "path";
import { Command } from "commander";
import { DeltaChatOverJsonRpcServer } from "@davidsm/stdio-rpc-server";
import type { OptionValues } from "commander";

type CdmData = [
  name: string,
  args: [flag: string, description: string][],
  description: string,
  action: Function,
];

const defaultCommandsData: CdmData[] = [
  [
    "init",
    [
      [
        "<addr>",
        "the e-mail address to use or a DCACCOUNT URI ex. DCACCOUNT:https://nine.testrun.org/new",
      ],
      [
        "[password]",
        "account password, this field is required only if addr is not a DCACCOUNT URI",
      ],
    ],
    "initialize account",
    init,
  ],
  [
    "import",
    [["<path>", "path to the account backup"]],
    "import account backup",
    _import,
  ],
  [
    "config",
    [
      ["[key]", "option name"],
      ["[value]", "option value to set"],
    ],
    "set/get account configuration value",
    config,
  ],
  ["remove", [], "remove account", remove],
  ["serve", [], "start processing messages", serve],
  ["list", [], "list all accounts", list],
  ["link", [], "show the bot's invitation link", link],
  [
    "admin",
    [],
    "show the invitation link to the bot's administration group",
    admin,
  ],
];

export default class BotCli extends DeltaChatOverJsonRpcServer {
  botname: string;
  program: Command;

  constructor(botname: string) {
    const dataFolder =
      process.env.DCBOTCLI_DATA_FOLDER ||
      path.join(envPaths("dcbot-cli").config, botname);
    super(dataFolder, {});
    this.botname = botname;
    this.program = new Command();
    this.program.option(
      "-a, --account <id>",
      "operate only over the given account",
    );
    for (const [name, args, description, action] of defaultCommandsData) {
      const command = this.program
        .command(name)
        .description(description)
        .action(
          async (...cdmArgs) =>
            await action(this, this.program.opts(), cdmArgs),
        );
      for (const [flag, description] of args) {
        command.argument(flag, description);
      }
    }
  }

  async start() {
    await this.program.parseAsync();
  }

  async getAddresses(accountId: number) {
    const transports = await this.rpc.listTransports(accountId);
    return transports.map((transport) => transport.addr);
  }

  async resetAdminChat(accountId: number) {
    if (!(await this.rpc.isConfigured(accountId))) {
      return;
    }
    const chatId = await this.rpc.createGroupChat(
      accountId,
      `${this.botname} admins`,
      true,
    );
    await this.rpc.setConfig(accountId, "ui.admin_chat", String(chatId));
    return chatId;
  }

  async getAdminChat(accountId: number) {
    if (!(await this.rpc.isConfigured(accountId))) {
      return;
    }

    const chatId =
      Number(await this.rpc.getConfig(accountId, "ui.admin_chat")) ||
      (await this.resetAdminChat(accountId));

    return chatId;
  }

  async isAdmin(accountId: number, contactId: number) {
    const chatId = await this.getAdminChat(accountId);
    if (!chatId) return false;
    const contacts = await this.rpc.getChatContacts(accountId, chatId);
    contacts.forEach((contact) => {
      if (contactId === contact) {
        return true;
      }
    });
    return false;
  }
}

/**
 *
 * @param command the command that the text should have
 * @param text the text from the message
 */
export function hasCommand(command: string, text: string) {
  if (!command || !text) return false;
  if (text.trim().toLowerCase().startsWith(command.trim().toLowerCase())) {
    return true;
  }

  return false;
}

/**
 *
 * @param command the command that the text should have
 * @param text the text from the message
 * @returns the rest of the message (excluding the command) or `null` if there is not rest
 */
export function getCommandPayload(command: string, text: string) {
  if (!hasCommand(command, text)) return null;

  const payload = text.trim().slice(command.trim().length).trimStart();
  if (payload) {
    return payload;
  }

  return null;
}

async function init(bot: BotCli, opts: OptionValues, args: any[]) {
  const addr: string = args[0];
  const password: string | undefined = args[1];
  const accountId = Number(opts.account) || (await bot.rpc.addAccount());
  try {
    if (password) {
      //@ts-ignore
      await bot.rpc.addOrUpdateTransport(accountId, {
        addr: addr,
        password: password,
      });
    } else {
      await bot.rpc.addTransportFromQr(accountId, addr);
    }

    await bot.rpc.setConfig(accountId, "bot", "1");
    await bot.rpc.setConfig(accountId, "delete_server_after", "1");
    await bot.rpc.setConfig(accountId, "bcc_self", "0");
    console.log("Account initialized!");
    process.exit(0);
  } catch (err: any) {
    console.log(err.message);
    process.exit(1);
  }
}

async function _import(bot: BotCli, _: OptionValues, args: any[]) {
  const path: string = args[0];
  const accountId = await bot.rpc.addAccount();
  try {
    await bot.rpc.importBackup(accountId, path, null);
    console.log("Account imported!");
    process.exit(0);
  } catch (err: any) {
    await bot.rpc.removeAccount(accountId);
    console.log(err.message);
    process.exit(1);
  }
}

async function serve(bot: BotCli, opts: OptionValues) {
  let accountsIds: number[];
  if (opts.account) {
    accountsIds = [Number(opts.account)];
  } else {
    accountsIds = await bot.rpc.getAllAccountIds();
  }

  let noConfiguredAccounts = true;
  for (const id of accountsIds) {
    if (!(await bot.rpc.isConfigured(id))) continue;
    let info = `Account #${id}: `;
    try {
      await bot.rpc.startIo(id);
      const addrs = await bot.getAddresses(id);
      info += `listening to ${addrs.join(", ")}`;
      noConfiguredAccounts = false;
    } catch (err: any) {
      info += err.message;
    }
    console.log(info);
  }

  if (noConfiguredAccounts) {
    console.log("There are not configured accounts");
    process.exit(1);
  }
}

async function list(bot: BotCli) {
  const accountsIds = await bot.rpc.getAllAccountIds();
  for (const id of accountsIds) {
    const addrs = await bot.getAddresses(id);
    const info = addrs.join(", ") || "(not configured)";
    console.log(`#${id} - ${info}`);
  }
  process.exit(0);
}

async function config(bot: BotCli, opts: OptionValues, args: any[]) {
  const key: string | undefined = args[0];
  const value: string | undefined = args[1];
  let accountsIds: number[];
  if (opts.account) {
    accountsIds = [Number(opts.account)];
  } else {
    accountsIds = await bot.rpc.getAllAccountIds();
  }

  for (const id of accountsIds) {
    console.log(`Account #${id}:`);
    try {
      if (key && value) {
        await bot.rpc.setConfig(id, key, value);
        console.log(`${key}=${value}`);
      } else if (key) {
        const value = await bot.rpc.getConfig(id, key);
        console.log(`${key}=${value}`);
      } else {
        const keys = (await bot.rpc.getConfig(id, "sys.config_keys")) || "";
        for (const key of keys.split(" ")) {
          if (!key || key === "sys.config_keys") continue;
          const value = await bot.rpc.getConfig(id, key);
          console.log(`${key}=${value}`);
        }
      }
    } catch (err: any) {
      console.log(err.message);
    }
    console.log("");
  }
  process.exit(0);
}

async function remove(bot: BotCli, opts: OptionValues) {
  let accountId: number;
  if (opts.account) {
    accountId = Number(opts.account);
  } else {
    const accountsIds = await bot.rpc.getAllAccountIds();
    if (accountsIds.length === 1) {
      accountId = accountsIds[0];
    } else if (accountsIds.length > 1) {
      console.log(
        "There are more than one account, use -a/--account to pass the account id",
      );
      process.exit(1);
    } else {
      console.log("No accounts found");
      process.exit(1);
    }
  }

  try {
    await bot.rpc.removeAccount(accountId);
    console.log(`Account #${accountId} removed successfully`);
    process.exit(0);
  } catch (err: any) {
    console.log(err.message);
    process.exit(1);
  }
}

async function link(bot: BotCli, opts: OptionValues) {
  let accountsIds: number[];
  if (opts.account) {
    accountsIds = [Number(opts.account)];
  } else {
    accountsIds = await bot.rpc.getAllAccountIds();
  }

  for (const id of accountsIds) {
    let info = `#${id}:\n`;
    try {
      if (!(await bot.rpc.isConfigured(id))) continue;
      const link = await bot.rpc.getChatSecurejoinQrCode(id, null);
      info += link;
    } catch (err: any) {
      info += err.message;
    }
    info += "\n";
    console.log(info);
  }
  process.exit(0);
}

async function admin(bot: BotCli, opts: OptionValues) {
  let accountsIds: number[];
  if (opts.account) {
    accountsIds = [Number(opts.account)];
  } else {
    accountsIds = await bot.rpc.getAllAccountIds();
  }

  for (const id of accountsIds) {
    if (!(await bot.rpc.isConfigured(id))) continue;
    let info = `#${id}:\n`;
    try {
      const chatId = await bot.getAdminChat(id);
      const link = await bot.rpc.getChatSecurejoinQrCode(id, chatId!);
      info += link;
    } catch (err: any) {
      info += err.message;
    }
    info += "\n";
    console.log(info);
  }
  process.exit(0);
}
