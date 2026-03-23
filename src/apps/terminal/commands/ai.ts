import { Command, CommandResult } from "../types";
import { useTerminalStore } from "@/stores/useTerminalStore";
import i18n from "@/lib/i18n";

export const aiCommand: Command = {
  name: "ai",
  description: "apps.terminal.commands.ai",
  usage: "ai [initial prompt]",
  handler: (args: string[]): CommandResult => {
    const terminalStore = useTerminalStore.getState();
    terminalStore.setIsInAiMode(true);

    if (args.length > 0) {
      const initialPrompt = args.join(" ");
      terminalStore.setInitialAiPrompt(initialPrompt);

      return {
        output: i18n.t("apps.terminal.output.askRayWithPrompt", { prompt: initialPrompt }),
        isError: false,
        isSystemMessage: true,
      };
    }

    return {
      output: i18n.t("apps.terminal.output.askRayAnything"),
      isError: false,
      isSystemMessage: true,
    };
  },
};

// Create aliases for the AI command
export const chatCommand: Command = {
  ...aiCommand,
  name: "chat",
};

export const rayCommand: Command = {
  ...aiCommand,
  name: "ray",
};
