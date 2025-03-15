import Anthropic from "@anthropic-ai/sdk";
import { McpClientService } from "./mcpClient";
import { SERVER_TOOL_NAME_SEPARATOR } from "../constants";
import { ToolUseBlock } from "@anthropic-ai/sdk/resources/messages";
import { cleanServerName } from "./utils";
import { ContextManager } from "./context";

export interface AiAgentConfig {
  apiKey: string;
  model?: string;
  maxTokens?: number;
}

export interface AiAgentResponse {
  content: string;
  toolCalls?: Array<{
    serverName: string;
    toolName: string;
    arguments: Record<string, any>;
  }>;
}

export class AiAgentService {
  private anthropic: Anthropic;
  private mcpClients: Record<string, McpClientService> = {};
  private model: string;
  private maxTokens: number;
  private contextManager: ContextManager;

  constructor(config: AiAgentConfig) {
    this.anthropic = new Anthropic({
      apiKey: config.apiKey,
    });
    this.model = config.model || "claude-3-5-sonnet-20240620";
    this.maxTokens = config.maxTokens || 4096;
    this.contextManager = new ContextManager();
  }

  registerMcpClient(mcpClient: McpClientService): void {
    this.mcpClients[cleanServerName(mcpClient.getServerName())] = mcpClient;
  }

  unregisterMcpClient(serverName: string): void {
    delete this.mcpClients[cleanServerName(serverName)];
  }

  setAnthropicApiKey(apiKey: string): void {
    this.anthropic = new Anthropic({
      apiKey: apiKey,
    });
  }

  constructSystemPrompt(): string {
    const contextInfo = this.contextManager.getContextString();
    const contextInstructions = ` You can also store context information for future reference. When you discover important information like IDs, credentials, or preferences, suggest storing them in context with the format: "!context:set key value" at the end of your response.`;
    return `You are a helpful AI technical chief of staff and data engineer responsible for helping the CEO remember all important information and data about their business across all their tools. 
      You should be extremely concise and to the point, CEOs are very busy people and don't have time to read long responses or generic commentary.
      Today's date is ${new Date().toLocaleDateString()}. 
      ${contextInfo}`;
  }

  // Add methods to access the context manager
  getContext(key: string, defaultValue: any = null): any {
    return this.contextManager.get(key, defaultValue);
  }

  setContext(key: string, value: any): void {
    this.contextManager.set(key, value);
  }

  hasContext(key: string): boolean {
    return this.contextManager.has(key);
  }

  removeContext(key: string): void {
    this.contextManager.remove(key);
  }

  getAllContext(): Record<string, any> {
    return this.contextManager.getAll();
  }

  clearContext(): void {
    this.contextManager.clear();
  }

  async transformToolResponseToAlert(
    toolResponses: Array<{ name: string; response: any }>,
    conversationHistory: Array<{ role: "user" | "assistant"; content: string }>
  ): Promise<string> {
    // Prepare the system prompt with MCP tool instructions
    const systemPrompt = `${this.constructSystemPrompt()} From the tool response: ${JSON.stringify(
      toolResponses
    )} and the CEO's question, transform the tool response into a JSON object to best display the information to the CEO in an alerts center. Use the following options:
      - NewsAlert: Headline title with text caption and potentially a hero number or short string. {"type": "BadNewsAlert", "title": string, "hero": string?, "caption": string, "color": string}
      Example: {"type": "NewsAlert", "title": "Conversion Down", "hero": "-10%", "caption": "Your conversion rate has dropped by 10% in the last 30 days", "color": "#f56565"}
      Example: {"type": "NewsAlert", "title": "Usage Spike", "hero": "+126%", "caption": "Your usage has spiked by 126% today", "color": "#50C879"}

      Caption should be a string that describes the metric in a concise manner, less than 60 characters, be as information dense for a CEO as possible.
      Respond only with the JSON object, nothing else.
    `;

    const prepend = `{"type": "`;
    // Prepare the messages for the API call
    const messages = [
      ...conversationHistory,
      { role: "assistant", content: prepend },
    ];

    // Call the Anthropic API
    const response = await this.anthropic.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      system: systemPrompt,
      messages: messages as any,
    });

    if (response.content[0].type === "text") {
      return prepend + response.content[0].text;
    }

    return "Unable to process response";
  }

  async transformToolResponse(
    toolResponses: Array<{ name: string; response: any }>,
    conversationHistory: Array<{ role: "user" | "assistant"; content: string }>
  ): Promise<string> {
    // Prepare the system prompt with MCP tool instructions
    const systemPrompt = `${this.constructSystemPrompt()} From the tool response: ${JSON.stringify(
      toolResponses
    )} and the CEO's question, transform the tool response into a JSON object to best display the information to the user in a business insights dashboard. Use the following options:
      - NumberMetric: A big number with a caption denoting additional data such as percentage change, time period, etc. {"type": "NumberMetric", "title": string, "value": string, "caption": string}
      Example: {"type": "NumberMetric", "title": "Total Revenue", "value": "$862,154.24", "caption": "+10% / last month"}
      Caption should be a string that describes the metric in a concise manner, less than 32 characters, be as information dense for a CEO as possible.
      Respond only with the JSON object, nothing else.
    `;

    const prepend = `{"type": "`;
    // Prepare the messages for the API call
    const messages = [
      ...conversationHistory,
      { role: "assistant", content: prepend },
    ];

    // Call the Anthropic API
    const response = await this.anthropic.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      system: systemPrompt,
      messages: messages as any,
    });

    if (response.content[0].type === "text") {
      return prepend + response.content[0].text;
    }

    return "Unable to process response";
  }

  async processMessage(
    message: string,
    conversationHistory: Array<{
      role: "user" | "assistant";
      content: string;
    }> = []
  ): Promise<AiAgentResponse> {
    // Check for context management commands
    if (message.startsWith("!context:")) {
      return this.handleContextCommand(message);
    }

    if (Object.keys(this.mcpClients).length === 0) {
      throw new Error("No MCP clients registered");
    }

    try {
      const availableTools = Object.keys(this.mcpClients).flatMap(
        (serverName) => {
          const mcpClient = this.mcpClients[serverName];
          return mcpClient.getAvailableTools();
        }
      );

      // Prepare the system prompt with MCP tool instructions
      const systemPrompt = `${this.constructSystemPrompt()} You are a helpful AI assistant with access to external tools through the Model Context Protocol (MCP).
You can use the following MCP operations:
1. Call tools: Use this to execute specific tools with arguments. The available tools are: ${JSON.stringify(
        availableTools
      )}

      If you need multiple tools, use them all at once in parallel unless you need to call them in sequence.

Always respond in a helpful, accurate, and concise manner.`;

      // Prepare the messages for the API call
      const messages = [
        ...conversationHistory,
        { role: "user", content: message },
      ];

      // Call the Anthropic API
      const response = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        system: systemPrompt,
        messages: messages as any,
        tools: availableTools,
      });

      console.log("response content", response.content);

      // Process the response to extract any tool calls
      let content =
        response.content[0].type === "text"
          ? response.content[0].text
          : "Unable to process response";

      if (content.includes("!context:")) {
        content = await this.parseContextCommand(content);
      }

      const toolCalls = response.content
        .filter((item) => item.type === "tool_use")
        .map((item: ToolUseBlock) => ({
          serverName: item.name.split(SERVER_TOOL_NAME_SEPARATOR)[0],
          toolName: item.name.split(SERVER_TOOL_NAME_SEPARATOR)[1],
          name: item.name,
          arguments: item.input,
          id: item.id,
        }));

      // Return the processed response
      return {
        content: content,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      };
    } catch (error) {
      console.error("Error processing message with AI agent:", error);
      throw error;
    }
  }

  async callTools(
    toolCalls: Array<{
      serverName: string;
      toolName: string;
      arguments: Record<string, any>;
    }>
  ) {
    const toolResponses: Array<{ name: string; response: any }> = [];
    // If there are tool calls, execute them
    if (toolCalls.length > 0) {
      for (const toolCall of toolCalls) {
        const toolResponse = await this.executeMcpOperation(toolCall);
        toolResponses.push({ name: toolCall.toolName, response: toolResponse });
      }
    }
    console.log("tool responses", toolResponses);
    return toolResponses;
  }

  async processToolCalls(
    toolCalls: Array<{
      serverName: string;
      toolName: string;
      arguments: Record<string, any>;
    }>,
    conversationHistory: Array<{ role: "user" | "assistant"; content: string }>
  ) {
    if (Object.keys(this.mcpClients).length === 0) {
      throw new Error("No MCP clients registered");
    }

    const toolResponses = await this.callTools(toolCalls);

    try {
      // Prepare the system prompt with MCP tool instructions
      const systemPrompt = `${this.constructSystemPrompt()} You are a helpful AI assistant with access to external tools through the Model Context Protocol (MCP).
        The tool calls have been executed. You can now use the results of the tool calls to answer the user's question. The tool calls are: ${JSON.stringify(
          toolResponses
        )}. Break down the results of the tool calls into a concise and helpful response to the user's earlier question.`;

      // Prepare the messages for the API call
      const messages = [
        ...conversationHistory,
        {
          role: "user",
          content: `___UI_HIDE___ Break down the results of the tool calls ${JSON.stringify(
            toolResponses
          )}`,
        },
        { role: "assistant", content: "Here's a very brief summary of the results, up to 3 things you as a CEO need to know:" },
      ];

      // Call the Anthropic API
      const response = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        system: systemPrompt,
        messages: messages as any,
      });
      console.log("response", response);

      // Process the response to extract any tool calls
      let content =
        response.content[0].type === "text"
          ? response.content[0].text.trim()
          : "Unable to process response";

      if (content.includes("!context:")) {
        content = await this.parseContextCommand(content);
      }

      console.log("AI response to tool calls:", content);

      return content;
    } catch (error) {
      console.error("Error processing tool calls:", error);
      throw error;
    }
  }

  async executeMcpOperation(toolCall: {
    serverName: string;
    toolName: string;
    arguments: Record<string, any>;
  }): Promise<any> {
    if (Object.keys(this.mcpClients).length === 0) {
      throw new Error("No MCP clients registered");
    }

    try {
      return await this.mcpClients[toolCall.serverName].callTool(toolCall);
    } catch (error) {
      console.error(
        `Error executing MCP operation ${toolCall.toolName}:`,
        error
      );
      throw error;
    }
  }

  async parseContextCommand(message: string): Promise<string> {
    // Find all !context: commands in the message
    const contextCommands = message.match(/!context:[^\n]*/g) || [];
    let remainingMessage = message;

    // Handle each context command
    for (const command of contextCommands) {
      await this.handleContextCommand(command);
      // Remove the command from the message
      remainingMessage = remainingMessage.replace(command, '').trim();
    }

    return remainingMessage
  }

  async handleContextCommand(message: string): Promise<AiAgentResponse> {
    const parts = message.trim().split(" ");
    const command = parts[0].toLowerCase();

    switch (command) {
      case "!context:set": {
        if (parts.length < 3) {
          return {
            content:
              "Error: !context:set requires a key and value. Usage: !context:set key value",
          };
        }
        const key = parts[1];
        const value = parts.slice(2).join(" ");
        this.contextManager.set(key, value);
        return { content: `✅ Context set: "${key}" = "${value}"` };
      }

      case "!context:get": {
        if (parts.length < 2) {
          return {
            content:
              "Error: !context:get requires a key. Usage: !context:get key",
          };
        }
        const key = parts[1];
        const value = this.contextManager.get(key);
        if (value === null) {
          return { content: `❌ Context key "${key}" not found.` };
        }
        return { content: `📋 "${key}": ${JSON.stringify(value)}` };
      }

      case "!context:remove": {
        if (parts.length < 2) {
          return {
            content:
              "Error: !context:remove requires a key. Usage: !context:remove key",
          };
        }
        const key = parts[1];
        if (!this.contextManager.has(key)) {
          return { content: `❌ Context key "${key}" not found.` };
        }
        this.contextManager.remove(key);
        return { content: `🗑️ Removed context key "${key}"` };
      }

      case "!context:list": {
        const allContext = this.contextManager.getAll();
        const keys = Object.keys(allContext);

        if (keys.length === 0) {
          return { content: "📋 No context values stored." };
        }

        let response = "📋 Stored context values:\n\n";
        for (const key of keys) {
          response += `- ${key}: ${JSON.stringify(allContext[key])}\n`;
        }
        return { content: response };
      }

      case "!context:clear": {
        this.contextManager.clear();
        return { content: "🗑️ All context values cleared." };
      }

      default:
        return {
          content: `Unknown context command: ${command}. Available commands: !context:set, !context:get, !context:remove, !context:list, !context:clear`,
        };
    }
  }
}
