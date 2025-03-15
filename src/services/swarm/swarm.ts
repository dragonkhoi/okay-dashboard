import { ToolChoice, ToolUseBlock } from "@anthropic-ai/sdk/resources";
import { AiAgentConfig } from "../aiAgent";
import { Agent } from "./agent";
import Anthropic from "@anthropic-ai/sdk";
import { McpClientService } from "../mcpClient";
import { cleanServerName } from "../utils";
import {
  AGENT_PREFIX,
  PLANNER_AGENT,
  SERVER_TOOL_NAME_SEPARATOR,
} from "../../constants";
import { AgentDirectory } from "./agentDirectory";
type Response = {
  messages: any[];
  agent?: Agent;
  context_variables: Record<string, any>;
};

type Result = {
  value: string;
  agent?: Agent;
  context_variables: Record<string, any>;
};

const __CTX_VARS_NAME__ = "context_variables";

export class Swarm {
  private anthropicApiKey: string;
  private anthropic: Anthropic;
  private maxTokens: number;
  private mcpClients: Record<string, McpClientService> = {};
  private agentDirectory: AgentDirectory;

  constructor(config: AiAgentConfig, agentDirectory: AgentDirectory) {
    this.anthropic = new Anthropic({
      apiKey: config.apiKey,
    });
    this.anthropicApiKey = config.apiKey;
    this.maxTokens = config.maxTokens || 1000;
    this.agentDirectory = agentDirectory;
  }

  registerMcpClient(mcpClient: McpClientService): void {
    this.mcpClients[cleanServerName(mcpClient.getServerName())] = mcpClient;
  }

  unregisterMcpClient(serverName: string): void {
    delete this.mcpClients[cleanServerName(serverName)];
  }

  public getAnthropicApiKey(): string {
    return this.anthropicApiKey;
  }

  public setAnthropicApiKey(apiKey: string): void {
    this.anthropicApiKey = apiKey;
    this.anthropic = new Anthropic({
      apiKey: this.anthropicApiKey,
    });
  }

  async run({
    agentName,
    messages,
    contextVars = {},
    modelOverride,
    maxTurns = Infinity,
    stream = false,
    debug = false,
  }: {
    agentName: string;
    messages: any[];
    contextVars?: Record<string, any>;
    modelOverride?: string;
    maxTurns?: number;
    stream?: boolean;
    debug?: boolean;
  }) {
    console.log("RUNNING SWARM WITH INITIL AGENT ", agentName);
    if (this.anthropicApiKey === "") {
      return {
        agentName: PLANNER_AGENT,
        messages: [
          {
            role: "assistant",
            content:
              "Okay! Your Anthropic API key is not set, go to settings to set it (check in the bottom left!)",
            sender: PLANNER_AGENT,
          },
        ],
      };
    }
    let currentAgent = this.agentDirectory.getAgentByName(agentName);
    console.log("CURRENT AGENT", currentAgent);
    const contextVariables = { ...contextVars };
    const conversationHistory = [...messages];
    let numTurns = 0;

    while (numTurns < maxTurns && currentAgent) {
      const reducedConversationHistory = conversationHistory.map((message) => {
        return {
          role: message.role,
          content: message.content,
        };
      });
      console.log(
        "CONVERSATION HISTORY",
        JSON.stringify(reducedConversationHistory, null, 2)
      );
      // Generate the response from the current agent
      const response = await this.getChatCompletion({
        agent: currentAgent,
        conversationHistory: reducedConversationHistory,
        contextVariables,
        modelOverride: modelOverride || currentAgent.model || "gpt-4",
        stream,
        debug,
      });

      for (let i = 0; i < response.content.length; i++) {
        const contentBlock = response.content[i];
        if (contentBlock.type === "text") {
          const message = {
            ...contentBlock,
            role: "assistant",
            content: contentBlock.text,
            sender: currentAgent.name,
          };
          if (message.content) {
            conversationHistory.push(message);
          }
          if (debug) console.log(`${currentAgent.name}:`, message);
          // If the only content block is a text block, break the while loop
          if (i === response.content.length - 1) {
            // Break both the for loop and while loop
            i = response.content.length;
            numTurns = maxTurns;
          }
        } else if (contentBlock.type === "tool_use") {
          const toolUseBlock = contentBlock as ToolUseBlock;

          const message = {
            ...toolUseBlock,
            role: "assistant",
            content: [
              {
                type: "tool_use",
                name: toolUseBlock.name,
                input: toolUseBlock.input,
                id: toolUseBlock.id,
              },
            ],
            sender: currentAgent.name,
          };
          conversationHistory.push(message);
          if (debug) console.log(`${currentAgent.name}:`, message);
          // call tool
          const toolMessage = await this.handleToolCall(
            toolUseBlock,
            currentAgent
          );

          conversationHistory.push(toolMessage);
          if (
            toolMessage.content[0].content &&
            typeof toolMessage.content[0].content === "string" &&
            toolMessage.content[0].content.startsWith(AGENT_PREFIX)
          ) {
            const agentName = toolMessage.content[0].content.split(
              SERVER_TOOL_NAME_SEPARATOR
            )[1];
            currentAgent = this.agentDirectory.getAgentByName(agentName);
          }
          if (debug) console.log(`${currentAgent.name}:`, toolMessage);
        }
        numTurns++;
      }
    }

    return {
      agentName: currentAgent.name || PLANNER_AGENT,
      messages: conversationHistory,
    };
  }

  async getChatCompletion({
    agent,
    conversationHistory,
    contextVariables,
    modelOverride,
    stream,
    debug,
  }: {
    agent: Agent;
    conversationHistory: any[];
    contextVariables: Record<string, any>;
    modelOverride?: string;
    stream?: boolean;
    debug?: boolean;
  }) {
    const instructions = agent.getInstructions(contextVariables);
    const systemPrompt = `${this.constructSystemPrompt()} ${instructions}`;
    const functions = agent.functions;
    console.log("CALLING AGENT", agent.name);
    console.log("CALLING AGENT functions", functions);
    const chatCompletionParams = {
      systemPrompt,
      model: modelOverride || agent.model,
      messages: conversationHistory,
      tools: functions,
      toolChoice: agent.toolChoice,
      stream,
    };
    const response = await this.createChatCompletion(chatCompletionParams);
    return response;
  }

  async createChatCompletion({
    systemPrompt,
    model,
    messages,
    tools,
    toolChoice = { type: "auto" },
    stream = false,
  }: {
    systemPrompt: string;
    model: string;
    messages: any[];
    tools: any[];
    toolChoice?: ToolChoice;
    stream?: boolean;
  }) {
    if (model.startsWith("claude")) {
      const response = await this.anthropic.messages.create({
        system: systemPrompt,
        max_tokens: this.maxTokens,
        model,
        messages,
        tools,
        tool_choice: toolChoice || { type: "auto" },
      });
      return response;
    } else {
      throw new Error("Unsupported model");
    }
  }

  async handleToolCall(toolUseBlock: ToolUseBlock, currentAgent: Agent) {
    const toolCall = {
      serverName: toolUseBlock.name.split(SERVER_TOOL_NAME_SEPARATOR)[0],
      toolName: toolUseBlock.name.split(SERVER_TOOL_NAME_SEPARATOR)[1],
      arguments: toolUseBlock.input,
    };
    if (toolCall.serverName === AGENT_PREFIX) {
      return {
        type: "tool_result",
        role: "user",
        content: [
          {
            type: "tool_result",
            content:
              toolUseBlock.name +
              SERVER_TOOL_NAME_SEPARATOR +
              "COMPLETED_HANDOFF",
            tool_use_id: toolUseBlock.id,
          },
        ],
        sender: currentAgent.name,
      };
    } else {
      const toolResult = await this.executeMcpOperation(toolCall);
      const toolMessage = {
        type: "tool_result",
        role: "user",
        content: [
          {
            type: "tool_result",
            content:
              typeof toolResult === "string"
                ? toolResult
                : JSON.stringify(toolResult),
            tool_use_id: toolUseBlock.id,
          },
        ],
        sender: currentAgent.name,
      };
      return toolMessage;
    }
  }

  // handleFunctionResult(result: Result | Agent | string) : Result {
  //     if (typeof result === "string") {
  //         return {
  //             value: result,
  //             agent: null,
  //             context_variables: {},
  //         }
  //     } else if (result instanceof Agent) {
  //         return {
  //             value: JSON.stringify({"assistant": result.name}),
  //             agent: result,
  //             context_variables: {},
  //         }
  //     } else {
  //         return result;
  //     }
  // }
  // async handleToolCall(toolCall: {
  //     serverName: string;
  //     toolName: string;
  //     arguments: Record<string, any>;
  //   }, toolUseId: string, currentAgent: Agent): Promise<Response> {
  //     let partialResponse : Response = {
  //         messages: [],
  //         agent: null,
  //         context_variables: {},
  //     }

  //     const toolResult = await this.executeMcpOperation(toolCall);
  //             const toolMessage = {
  //                 role: "user",
  //                 content: toolResult,
  //                 type: "tool_result",
  //                 tool_use_id: toolUseId,
  //                 sender: currentAgent.name,
  //             }

  //   }

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

  constructSystemPrompt(): string {
    return `Today's date is ${new Date().toLocaleDateString()}.`;
  }
}
