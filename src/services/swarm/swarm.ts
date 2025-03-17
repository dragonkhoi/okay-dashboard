import { ToolChoice, ToolUseBlock } from "@anthropic-ai/sdk/resources";
import { AiAgentConfig } from "../aiAgent";
import { Agent, AgentFunction } from "./agent";
import Anthropic from "@anthropic-ai/sdk";
import { McpClientService } from "../mcpClient";
import { cleanServerName } from "../utils";
import {
  AGENT_PREFIX,
  COMPLETED_HANDOFF,
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

  async runAndStream({
    agentName,
    messages,
    contextVars = {},
    modelOverride,
    debug = false,
    max_turns = Infinity,
    execute_tools = true,
  }: {
    agentName: string;
    messages: any[];
    contextVars?: Record<string, any>;
    modelOverride?: string;
    debug?: boolean;
    max_turns?: number;
    execute_tools?: boolean;
  }) {
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
    if (!currentAgent) {
      console.error(`Agent ${agentName} not found`);
      return {
        agentName: PLANNER_AGENT,
        messages: [
          {
            role: "assistant",
            content: `Agent ${agentName} not found`,
            sender: PLANNER_AGENT,
          },
        ],
      };
    }

    const contextVariables = { ...contextVars };
    const conversationHistory = [...messages];
    let numTurns = 0;

    // Create a generator function that yields streaming chunks
    const streamGenerator = async function* (this: Swarm) {
      try {
        while (numTurns < max_turns && currentAgent) {
          // Get reduced conversation history (just role and content)
          const reducedConversationHistory = conversationHistory.map((msg) => ({
            role: msg.role,
            content: msg.content,
          }));

          if (debug) {
            console.log(
              "CONVERSATION HISTORY",
              JSON.stringify(reducedConversationHistory, null, 2)
            );
          }

          // Start streaming the completion
          yield { delim: "start" };

          try {
            // Create a streaming request to Anthropic
            if (!currentAgent.model.startsWith("claude")) {
              throw new Error("Streaming is only supported with Claude models");
            }

            const instructions = currentAgent.getInstructions(contextVariables);
            const systemPrompt = `${this.constructSystemPrompt()} ${instructions}`;

            // Convert agent functions to Anthropic tools format if needed
            const tools = currentAgent.functions.map((fn: any) => {
              // If the function already has the right format, return it
              if (fn.input_schema) return fn;

              // Otherwise, convert it to the expected format
              return {
                name: fn.name,
                description: fn.description || "",
                input_schema: fn.parameters || {
                  type: "object",
                  properties: {},
                },
              };
            });

            // Create a streaming request using the event-based approach with a Promise
            const streamEvents: any[] = [];

            // Create a promise that will resolve when the stream is complete
            const streamComplete = new Promise<void>((resolve) => {
              console.log("CREATING STREAM TO CONTINUE FROM: ", reducedConversationHistory[reducedConversationHistory.length - 1]);
              const stream = this.anthropic.messages.stream({
                system: systemPrompt,
                max_tokens: this.maxTokens,
                model: modelOverride || currentAgent.model,
                messages: reducedConversationHistory,
                tools,
                tool_choice: currentAgent.toolChoice || { type: "auto" },
              });

              // Handle text events
              stream.on("text", (text) => {
                if (text && text.trim() !== "") {
                  streamEvents.push({
                    type: "text",
                    content: text,
                    role: "assistant",
                    sender: currentAgent.name,
                  });
                }
              });

              // Handle stream completion
              stream.on("end", () => {
                console.log("STREAM ENDED BUT NOT RESOLVED");
                // resolve();
              });

              // Handle errors
              stream.on("error", (error) => {
                console.error("Stream error:", error);
                streamEvents.push({
                  type: "text",
                  content: `Error: ${error.message || "Unknown error"}`,
                  role: "assistant",
                  sender: currentAgent.name,
                });
                resolve();
              });

              // Use the finalMessage to get tool calls
              stream.on("contentBlock", (block) => {
                console.log("CONTENT BLOCK", JSON.stringify(block, null, 2));
                if (block.type === "tool_use") {
                  // Create a new tool call
                  const toolCall = {
                    id: block.id,
                    type: "tool_use",
                    name: block.name,
                    input: block.input,
                  };

                  streamEvents.push({
                    type: "tool_use",
                    content: [toolCall],
                    role: "assistant",
                    sender: currentAgent.name,
                  });
                }
              });

              stream.on("finalMessage", async (message) => {
                console.log("FINAL MESSAGE", JSON.stringify(message, null, 2));
                
                // Create an array to track all pending tool call promises
                const pendingToolCalls: Promise<void>[] = [];
                
                for (let i = 0; i < message.content.length; i++) {
                  const contentBlock = message.content[i];
                  if (contentBlock.type === "text") {
                    const messageToPush = {
                      ...contentBlock,
                      role: "assistant",
                      content: contentBlock.text,
                      sender: currentAgent.name,
                      // If this is the last content block and is text, break the while loop
                      break: message.content.length === i + 1,
                    };
                    if (messageToPush.content) {
                      conversationHistory.push(messageToPush);
                    }
                    if (debug)
                      console.log(`${currentAgent.name}:`, messageToPush);
                  } else if (contentBlock.type === "tool_use") {
                    const toolUseBlock = contentBlock as ToolUseBlock;

                    const messageToPush = {
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
                    conversationHistory.push(messageToPush);
                    if (debug) console.log(`${currentAgent.name}:`, messageToPush);
                    
                    // Create a promise for this tool call and add it to the pending array
                    const toolCallPromise = (async () => {
                      // call tool
                      const toolMessage = await this.handleToolCall(
                        toolUseBlock,
                        currentAgent
                      );
                      let switchAgentTo = null;

                      if (
                        toolMessage.content[0].content &&
                        typeof toolMessage.content[0].content === "string" &&
                        toolMessage.content[0].content.startsWith(AGENT_PREFIX)
                      ) {
                        const agentName = toolMessage.content[0].content.split(
                          SERVER_TOOL_NAME_SEPARATOR
                        )[1];
                        switchAgentTo = agentName;
                        currentAgent =
                          this.agentDirectory.getAgentByName(agentName);
                      }
                      if (debug)
                        console.log(`TOOL MESSAGE FROM ${currentAgent.name}:`, toolMessage);
                      conversationHistory.push({
                        ...toolMessage,
                        switchAgentTo,
                      });
                      streamEvents.push({
                        role: "assistant",
                        sender: currentAgent.name,
                        type: "tool_result",
                        content: toolMessage.content,
                      });
                    })();
                    
                    // Add this promise to our pending array
                    pendingToolCalls.push(toolCallPromise);
                  }
                }
                
                // Wait for all tool calls to complete before resolving
                await Promise.all(pendingToolCalls);
                
                streamEvents.push({ delim: "end" });
                numTurns++;
                
                // Now that all tool calls are complete, resolve the stream
                console.log("RESOLVING STREAM ON FINAL MESSAGE");
                if (message.content.length === 0 && message.stop_reason === "end_turn") {
                  console.log("EMPTY CONTENT")
                } else {
                  resolve();
                }
              });
            });

            // Wait for the stream to start producing events
            let waitCount = 0;
            while (streamEvents.length === 0 && waitCount < 100) {
              // Timeout after ~5 seconds
              await new Promise((resolve) => setTimeout(resolve, 50));
              waitCount++;
            }

            // Yield events as they come in
            let lastEventIndex = 0;

            while (true) {
              // Check if there are new events
              if (lastEventIndex < streamEvents.length) {
                // Yield all new events
                for (let i = lastEventIndex; i < streamEvents.length; i++) {
                  yield streamEvents[i];
                }

                // Update the last event index
                lastEventIndex = streamEvents.length;
              }

              // Check if the stream is complete
              const isComplete = await Promise.race([
                streamComplete.then(() => true),
                new Promise<boolean>((resolve) =>
                  setTimeout(() => resolve(false), 50)
                ),
              ]);

              if (isComplete && lastEventIndex >= streamEvents.length) {
                if (conversationHistory[conversationHistory.length - 1].break) {
                  console.log("BREAKING OUTER CONVO LOOP VIA NUM TURNS FROM INSIDE WHILE TRUE");
                  numTurns = max_turns;
                }
                if (conversationHistory[conversationHistory.length - 1].switchAgentTo) {
                  currentAgent = this.agentDirectory.getAgentByName(conversationHistory[conversationHistory.length - 1].switchAgentTo);
                }
                if (
                  conversationHistory[conversationHistory.length - 1].content[0].content &&
                  typeof conversationHistory[conversationHistory.length - 1].content[0].content === "string" &&
                  conversationHistory[conversationHistory.length - 1].content[0].content.startsWith(AGENT_PREFIX)
                ) {
                  const agentName = conversationHistory[conversationHistory.length - 1].content[0].content.split(
                    SERVER_TOOL_NAME_SEPARATOR
                  )[1];
                  currentAgent =
                    this.agentDirectory.getAgentByName(agentName);
                  console.log("SWITCHING AGENT TO", agentName);
                }
                // Ensure we break out of the loop when the stream is complete
                // and we've yielded all events
                console.log("MESSAGE FINISHED STREAMING. BREAKING OUT OF WHILE TRUE TO ADVANCE CONVO");
                break;
              }

              // Add a small delay to prevent tight looping
              await new Promise((resolve) => setTimeout(resolve, 50));
            }
          } catch (error) {
            console.error("Error in streaming:", error);
            yield {
              role: "assistant",
              sender: currentAgent.name,
              type: "text",
              content: `Error: ${
                error instanceof Error ? error.message : "Unknown error"
              }`,
            };
          }
        }

        console.log("STREAM GENERATOR FINISHED ", currentAgent.name);

        // Return the final response
        yield {
          response: {
            agentName: currentAgent?.name || PLANNER_AGENT,
            messages: conversationHistory,
          },
        };
      } catch (error) {
        console.error("Error in stream generator:", error);
        yield {
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }.bind(this);

    // Return the generator
    return streamGenerator();
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
    if (stream) {
      return await this.runAndStream({
        agentName,
        messages,
        contextVars,
        modelOverride,
        debug,
      });
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
    console.log("HANDLING TOOL CALL", toolUseBlock.id, toolUseBlock.name);
    if (toolCall.serverName === AGENT_PREFIX) {
      const toolResult = {
        type: "tool_result",
        role: "user",
        content: [
          {
            type: "tool_result",
            content:
              toolUseBlock.name +
              SERVER_TOOL_NAME_SEPARATOR +
              COMPLETED_HANDOFF +
              " Now please continue with my request: " +
              (toolUseBlock.input as any).user_request || " Please continue",
            tool_use_id: toolUseBlock.id,
          },
        ],
        sender: currentAgent.name,
      };
      console.log("AGENT TOOL RESULT", JSON.stringify(toolResult, null, 2));
      return toolResult;
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
      console.log("MCP TOOL RESULT", JSON.stringify(toolMessage, null, 2));
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
      // Special handling for browser agent which needs a longer timeout
      if (toolCall.toolName === "run_browser_agent") {
        console.log("Using extended timeout for run_browser_agent tool");
        // Pass a custom timeout option for this specific tool
        return await this.mcpClients[toolCall.serverName].callTool(
          toolCall,
          0,
          true
        );
      }

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
