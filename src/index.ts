import { app, BrowserWindow, ipcMain, net, session, shell } from "electron";
import { McpClientService, McpServerConfig } from "./services/mcpClient";
import { AiAgentService } from "./services/aiAgent";
import { ReactComponentGeneratorService } from "./services/reactComponentGenerator";
import {
  loadMcpServersConfig,
  saveMcpServersConfig,
  config,
  saveEnvConfig,
} from "./services/config";
import {
  DashboardAlert,
  DashboardConfigService,
  DashboardQuestion,
} from "./services/dashboardConfig";
import * as path from "path";
import { cleanServerName } from "./services/utils";
import { join } from "path";
import { Swarm } from "./services/swarm/swarm";
import { AgentDirectory } from "./services/swarm/agentDirectory";
import { Agent } from "./services/swarm/agent";
import {
  AGENT_PREFIX,
  COMMUNICATION_AGENT,
  COMPLETED_HANDOFF,
  EXTERNAL_SEARCH_AGENT,
  INTERNAL_SEARCH_AGENT,
  MONEY_AGENT,
  PLANNER_AGENT,
  PRODUCT_ANALYTICS_AGENT,
  SERVER_TOOL_NAME_SEPARATOR,
} from "./constants";

// This allows TypeScript to pick up the magic constants that's auto-generated by Forge's Webpack
// plugin that tells the Electron app where to look for the Webpack-bundled app code (depending on
// whether you're running in development or production).
declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require("electron-squirrel-startup")) {
  app.quit();
}

// Keep a global reference of the window object to avoid it being garbage collected
let mainWindow: BrowserWindow | null = null;

// Services
const mcpClientServices: Record<string, McpClientService> = {};
const aiAgentService = new AiAgentService({
  apiKey: config.anthropicApiKey,
  model: config.aiModel,
  maxTokens: config.maxTokens,
});
const agentDirectory = new AgentDirectory();
const plannerInstructions = (
  contextVariables: Record<string, any>,
  userMessage: string
) => {
  return `You are an AI assistant responsible for triaging user requests and routing them to the appropriate specialized agent. Your task is to analyze the user's request and determine which agent it should be directed to.
    Here is the user's request:
    <user_request>
    ${userMessage}
    </user_request>

    Instructions:
    1. Analyze the user's request to determine its primary topic.
    2. Based on the topic, decide which specialized agent should handle the request:
      - Product Analytics Agent: For questions related to analytics, Mixpanel, Supabase, database, or other product-related inquiries.
      - Money Agent: For questions about bank accounts, payments, invoices, or other financial matters.
      - Communication Agent: For inquiries about sending/reading emails, Slack messages, calendar events, scheduling, or other communication-related topics.
      - Internal Search Agent: For questions about company policies, procedures, company information, employees, Notion, or information that might be found in emails.
    3. If you need more information to make a decision, ask a direct question without explaining why you're asking it.
    4. Do not share your thought process with the user or make assumptions on their behalf.
    5. Provide a single-line response indicating your routing decision.

    Wrap your analysis in <request_analysis> tags:
    - List key words or phrases from the user request that relate to each agent's specialty.
    - Score each agent from 0-10 based on the relevance of these key words/phrases.
    - Justify your choice of the highest-scoring agent in 1-2 sentences.

    Then, in <routing_decision> tags, provide a concise, one-line response about the routing decision.

    Example output structure:
    <request_analysis>
    [Analysis of key words/phrases, agent scores, and justification]
    </request_analysis>

    <routing_decision>
    Transfer to [Agent Name] Agent
    </routing_decision>`;
};
const bankingAndAccountingInstructions = (
  contextVariables: Record<string, any>,
  userMessage: string
) => {
  return `
  <role>You are an AI assistant specialized in product analytics tasks.</role>
  <tool_capabilities>You might have access to various analytics tools, such as Mixpanel for product analytics and Supabase for database queries and more, in which case you should use them to answer the user's request.</tool_capabilities>
  <handoff_to_planner>If you do not know how to answer the user's request, use the tool to handoff to the planner agent.</handoff_to_planner>
  <no_tools>If you do not have access to any tools, respond with: "Are you sure you have connected all the necessary tools?"</no_tools>

  <tool_use_example>If using a tool, just say "Using" or "Looking up..." or "Fetching..." or "Analyzing..." or "Searching..." etc.</tool_use_example>
  <formatting> Limit your response to 1-3 main points. </formatting>
  Example of desired output structure:

    <request_analysis>
    [Your analysis and planning goes here]
    </request_analysis>

    [If using a tool: "Using <toolname>"]

    1. [First main point]
    2. [Second main point (if necessary)]
    3. [Third main point (if necessary)]

    Remember to adhere to these guidelines strictly and provide only the most relevant information to the user.
  `;
};
const productAnalyticsInstructions = (
  contextVariables: Record<string, any>,
  userMessage: string
) => {
  return `
  <role>You are an AI assistant specialized in product analytics tasks.</role>
  <tool_capabilities>You might have access to various analytics tools, such as Mixpanel for product analytics and Supabase for database queries and more, in which case you should use them to answer the user's request.</tool_capabilities>
  <handoff_to_planner>If you do not know how to answer the user's request, use the tool to handoff to the planner agent.</handoff_to_planner>
  <no_tools>If you do not have access to any tools, respond with: "Are you sure you have connected all the necessary tools?"</no_tools>

  <tool_use_example>If using a tool, just say "Using" or "Looking up..." or "Fetching..." or "Analyzing..." or "Searching..." etc.</tool_use_example>
  <formatting> Limit your response to 1-3 main points. </formatting>
  Example of desired output structure:

    <request_analysis>
    [Your analysis and planning goes here]
    </request_analysis>

    [If using a tool: "Using <toolname>"]

    1. [First main point]
    2. [Second main point (if necessary)]
    3. [Third main point (if necessary)]

    Remember to adhere to these guidelines strictly and provide only the most relevant information to the user.
  `;
};
const externalSearchInstructions = (
  contextVariables: Record<string, any>,
  userMessage: string
) => {
  return `
  <role>You are an AI assistant specialized in external search tasks.</role>
  <tool_capabilities>You might have access to various search tools, such as Google, YouTube, or other search engines, in which case you should use them to answer the user's request.</tool_capabilities>
  <handoff_to_planner>If you do not know how to answer the user's request, use the tool to handoff to the planner agent.</handoff_to_planner>
  <no_tools>If you do not have access to any tools, respond with: "Are you sure you have connected all the necessary tools?"</no_tools>

  <tool_use_example>If using a tool, just say "Using" or "Looking up..." or "Fetching..." or "Analyzing..." or "Searching..." etc.</tool_use_example>
  <formatting> Limit your response to 1-3 main points. </formatting>
  Example of desired output structure:

    <request_analysis>
    [Your analysis and planning goes here]
    </request_analysis>

    [If using a tool: "Using <toolname>"]

    1. [First main point]
    2. [Second main point (if necessary)]
    3. [Third main point (if necessary)]

    Remember to adhere to these guidelines strictly and provide only the most relevant information to the user.
  `;
};
const internalSearchInstructions = (
  contextVariables: Record<string, any>,
  userMessage: string
) => {
  return `
  <role>You are an AI assistant specialized in internal search tasks.</role>
  <tool_capabilities>You might have access to various search tools within the company, such as Google Drive, Notion, Slack, etc., in which case you should use them to answer the user's request.</tool_capabilities>
  <handoff_to_planner>If you do not know how to answer the user's request, use the tool to handoff to the planner agent.</handoff_to_planner>
  <no_tools>If you do not have access to any tools, respond with: "Are you sure you have connected all the necessary tools?"</no_tools>

  <tool_use_example>If using a tool, just say "Using" or "Looking up..." or "Fetching..." or "Analyzing..." or "Searching..." etc.</tool_use_example>
  <formatting> Limit your response to 1-3 main points. </formatting>
  Example of desired output structure:

    <request_analysis>
    [Your analysis and planning goes here]
    </request_analysis>

    [If using a tool: "Using <toolname>"]

    1. [First main point]
    2. [Second main point (if necessary)]
    3. [Third main point (if necessary)]

    Remember to adhere to these guidelines strictly and provide only the most relevant information to the user.
  `;
};
const communicationInstructions = (
  contextVariables: Record<string, any>,
  userMessage: string
) => {
  return `
  <role>You are an AI assistant specialized in communication tasks.</role>
  <tool_capabilities>You might have access to various communication tools, such as Slack, email, calendar, etc., in which case you should use them to answer or fulfill the user's request.</tool_capabilities>
  <handoff_to_planner>If you do not know how to answer the user's request, use the tool to handoff to the planner agent.</handoff_to_planner>
  <no_tools>If you do not have access to any tools, respond with: "Are you sure you have connected all the necessary tools?"</no_tools>

  <tool_use_example>If using a tool, just say "Using" or "Looking up..." or "Fetching..." or "Analyzing..." or "Searching..." etc.</tool_use_example>
  <formatting> Limit your response to 1-3 main points. </formatting>
  Example of desired output structure:

    <request_analysis>
    [Your analysis and planning goes here]
    </request_analysis>

    [If using a tool: "Using <toolname>"]

    1. [First main point]
    2. [Second main point (if necessary)]
    3. [Third main point (if necessary)]

    Remember to adhere to these guidelines strictly and provide only the most relevant information to the user.
  `;
};
agentDirectory.registerAgent(
  PLANNER_AGENT,
  new Agent({
    name: PLANNER_AGENT,
    instructions: plannerInstructions,
    model: config.aiModel,
    functions: [
      {
        name: AGENT_PREFIX + SERVER_TOOL_NAME_SEPARATOR + MONEY_AGENT,
        description:
          "Transfer to the banking and accounting agent to handle money related questions like Mercury, Stripe, Ramp, credit cards, spending, invoices, etc.",
        input_schema: {
          type: "object",
        },
      },
      {
        name:
          AGENT_PREFIX + SERVER_TOOL_NAME_SEPARATOR + PRODUCT_ANALYTICS_AGENT,
        description:
          "Transfer to the product analytics agent to handle product analytics related questions like Mixpanel, Supabase, database, etc.",
        input_schema: {
          type: "object",
          properties: {
            user_request: {
              type: "string",
              description: "The user's request",
            },
          },
        },
      },
      {
        name: AGENT_PREFIX + SERVER_TOOL_NAME_SEPARATOR + EXTERNAL_SEARCH_AGENT,
        description:
          "Transfer to the external search agent to handle web, YouTube or external tool search",
        input_schema: {
          type: "object",
        },
      },
      {
        name: AGENT_PREFIX + SERVER_TOOL_NAME_SEPARATOR + INTERNAL_SEARCH_AGENT,
        description:
          "Transfer to the internal search agent for internal documents, files, notes such as Google Drive, Notion, Slack, etc.",
        input_schema: {
          type: "object",
        },
      },
      {
        name: AGENT_PREFIX + SERVER_TOOL_NAME_SEPARATOR + COMMUNICATION_AGENT,
        description:
          "Transfer to the communication agent for Slack, email, calendar, and other communication needs",
        input_schema: {
          type: "object",
        },
      },
    ],
  })
);
agentDirectory.registerAgent(
  MONEY_AGENT,
  new Agent({
    name: MONEY_AGENT,
    instructions: bankingAndAccountingInstructions,
    model: config.aiModel,
    functions: [
      {
        name: AGENT_PREFIX + SERVER_TOOL_NAME_SEPARATOR + PLANNER_AGENT,
        description:
          "Transfer to the planner agent because this request is not related to money",
        input_schema: {
          type: "object",
        },
      },
    ],
  })
);
agentDirectory.registerAgent(
  PRODUCT_ANALYTICS_AGENT,
  new Agent({
    name: PRODUCT_ANALYTICS_AGENT,
    instructions: productAnalyticsInstructions,
    model: config.aiModel,
    functions: [
      {
        name: AGENT_PREFIX + SERVER_TOOL_NAME_SEPARATOR + PLANNER_AGENT,
        description:
          "Transfer to the planner agent because this request is not related to product analytics",
        input_schema: {
          type: "object",
        },
      },
    ],
  })
);
agentDirectory.registerAgent(
  EXTERNAL_SEARCH_AGENT,
  new Agent({
    name: EXTERNAL_SEARCH_AGENT,
    instructions: externalSearchInstructions,
    model: config.aiModel,
    functions: [
      {
        name: AGENT_PREFIX + SERVER_TOOL_NAME_SEPARATOR + PLANNER_AGENT,
        description:
          "Transfer to the planner agent because this request is not related to external search",
        input_schema: {
          type: "object",
        },
      },
    ],
  })
);
agentDirectory.registerAgent(
  INTERNAL_SEARCH_AGENT,
  new Agent({
    name: INTERNAL_SEARCH_AGENT,
    instructions: internalSearchInstructions,
    model: config.aiModel,
    functions: [
      {
        name: AGENT_PREFIX + SERVER_TOOL_NAME_SEPARATOR + PLANNER_AGENT,
        description:
          "Transfer to the planner agent because this request is not related to internal search",
        input_schema: {
          type: "object",
        },
      },
    ],
  })
);
agentDirectory.registerAgent(
  COMMUNICATION_AGENT,
  new Agent({
    name: COMMUNICATION_AGENT,
    instructions: communicationInstructions,
    model: config.aiModel,
    functions: [
      {
        name: AGENT_PREFIX + SERVER_TOOL_NAME_SEPARATOR + PLANNER_AGENT,
        description:
          "Transfer to the planner agent because this request is not related to communication",
        input_schema: {
          type: "object",
        },
      },
    ],
  })
);

const aiSwarmService = new Swarm(
  {
    apiKey: config.anthropicApiKey,
    model: config.aiModel,
    maxTokens: config.maxTokens,
  },
  agentDirectory
);

const reactComponentGeneratorService = new ReactComponentGeneratorService();
const dashboardConfigService = new DashboardConfigService();

// Load MCP server configurations
const mcpServersConfig = loadMcpServersConfig();

// Connect to all MCP servers
const connectToAllMcpServers = async () => {
  const serverConfigs = mcpServersConfig.mcpServers;
  const serverNames = Object.keys(serverConfigs);

  if (serverNames.length === 0) {
    console.log("No MCP servers configured");
    return;
  }

  console.log(`Found ${serverNames.length} MCP servers in configuration`);

  await Promise.all(
    serverNames.map(async (serverName) => {
      try {
        const serverConfig = serverConfigs[serverName];
        console.log(`Connecting to MCP server: ${serverName}`);

        serverConfig.name = cleanServerName(serverName);

        const mcpClient = new McpClientService(serverConfig);
        mcpClientServices[cleanServerName(serverName)] = mcpClient;
        await mcpClient.connect();

        if (serverConfig.relevantAgents) {
          for (const agentName of serverConfig.relevantAgents) {
            agentDirectory.addNewAgentFunctions(
              agentName,
              mcpClient.getAvailableTools()
            );
          }
        } else {
          // If no relevant agents are specified, add the tools to the planner agent
          agentDirectory.addNewAgentFunctions(
            PLANNER_AGENT,
            mcpClient.getAvailableTools()
          );
        }
        console.log(`Successfully connected to MCP server: ${serverName}`);
      } catch (error) {
        console.error(`Failed to connect to MCP server ${serverName}:`, error);
      }
    })
  );

  // Register all connected clients with the AI agent
  const connectedClients = Object.values(mcpClientServices);
  for (const client of connectedClients) {
    aiAgentService.registerMcpClient(client);
    aiSwarmService.registerMcpClient(client);
  }

  // Notify the renderer process that all servers have been connected
  if (mainWindow) {
    mainWindow.webContents.send("mcp:serversConnected");
  }
};

const createWindow = (): void => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // and load the index.html of the app.
  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  // Open the DevTools in development mode
  if (process.env.NODE_ENV === "development") {
    mainWindow.webContents.openDevTools();
  }

  // Connect to all MCP servers after the window is created
  connectToAllMcpServers();
};

// Set up IPC handlers for MCP client
ipcMain.handle(
  "mcp:connect",
  async (_, serverConfig: McpServerConfig, serverName: string) => {
    const cleanedServerName = cleanServerName(serverName);
    try {
      // If serverName is provided and the client already exists, return it
      if (serverName && mcpClientServices[cleanedServerName]) {
        aiAgentService.registerMcpClient(mcpClientServices[cleanedServerName]);
        aiSwarmService.registerMcpClient(mcpClientServices[cleanedServerName]);
        return { success: true, serverName };
      }

      serverConfig.name = cleanedServerName;

      // Otherwise create a new client
      const mcpClient = new McpClientService(serverConfig);

      // If serverName is provided, store the client with that name
      if (cleanedServerName) {
        mcpClientServices[cleanedServerName] = mcpClient;
      } else if (serverConfig.name) {
        mcpClientServices[cleanServerName(serverConfig.name)] = mcpClient;
      }

      await mcpClient.connect();

      if (serverConfig.relevantAgents) {
        for (const agentName of serverConfig.relevantAgents) {
          agentDirectory.addNewAgentFunctions(
            agentName,
            mcpClient.getAvailableTools()
          );
        }
      } else {
        // If no relevant agents are specified, add the tools to the planner agent
        agentDirectory.addNewAgentFunctions(
          PLANNER_AGENT,
          mcpClient.getAvailableTools()
        );
      }

      aiAgentService.registerMcpClient(mcpClient);
      aiSwarmService.registerMcpClient(mcpClient);
      if (mainWindow) {
        mainWindow.webContents.send("mcp:serversConnected");
      }
      return { success: true, serverName };
    } catch (error) {
      console.error("Failed to connect MCP client:", error);
      return { success: false, error: (error as Error).message };
    }
  }
);

// Get available MCP servers from config
ipcMain.handle("mcp:getServers", async () => {
  const servers = { ...mcpServersConfig.mcpServers };

  return {
    success: true,
    servers,
  };
});

// Get connected MCP clients
ipcMain.handle("mcp:getConnectedClients", async () => {
  const connectedClients = Object.keys(mcpClientServices);

  return {
    success: true,
    connectedClients,
  };
});

ipcMain.handle("mcp:disconnect", async (_, serverName?: string) => {
  try {
    if (serverName) {
      // Disconnect specific server
      if (mcpClientServices[cleanServerName(serverName)]) {
        await mcpClientServices[cleanServerName(serverName)].disconnect();
        delete mcpClientServices[cleanServerName(serverName)];
      }
    } else {
      // Disconnect all servers
      for (const name in mcpClientServices) {
        await mcpClientServices[name].disconnect();
        delete mcpClientServices[name];
      }
    }

    // Reset the AI agent's MCP client
    aiAgentService.unregisterMcpClient(cleanServerName(serverName));
    aiSwarmService.unregisterMcpClient(cleanServerName(serverName));

    return { success: true };
  } catch (error) {
    console.error("Failed to disconnect MCP client:", error);
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle("mcp:listPrompts", async (_, serverName?: string) => {
  try {
    let client: McpClientService | null = null;

    if (serverName && mcpClientServices[cleanServerName(serverName)]) {
      client = mcpClientServices[cleanServerName(serverName)];
    } else {
      // Use the first available client
      const clients = Object.values(mcpClientServices);
      if (clients.length > 0) {
        client = clients[0];
      }
    }

    if (!client) {
      throw new Error("No MCP client connected");
    }

    return await client.listPrompts();
  } catch (error) {
    console.error("Failed to list MCP prompts:", error);
    throw error;
  }
});

ipcMain.handle(
  "mcp:getPrompt",
  async (_, name: string, args: Record<string, any>, serverName?: string) => {
    try {
      let client: McpClientService | null = null;

      if (serverName && mcpClientServices[cleanServerName(serverName)]) {
        client = mcpClientServices[cleanServerName(serverName)];
      } else {
        // Use the first available client
        const clients = Object.values(mcpClientServices);
        if (clients.length > 0) {
          client = clients[0];
        }
      }

      if (!client) {
        throw new Error("No MCP client connected");
      }

      return await client.getPrompt(name, args);
    } catch (error) {
      console.error(`Failed to get MCP prompt ${name}:`, error);
      throw error;
    }
  }
);

ipcMain.handle("mcp:listResources", async (_, serverName?: string) => {
  try {
    let client: McpClientService | null = null;

    if (serverName && mcpClientServices[cleanServerName(serverName)]) {
      client = mcpClientServices[cleanServerName(serverName)];
    } else {
      // Use the first available client
      const clients = Object.values(mcpClientServices);
      if (clients.length > 0) {
        client = clients[0];
      }
    }

    if (!client) {
      throw new Error("No MCP client connected");
    }

    return await client.listResources();
  } catch (error) {
    console.error("Failed to list MCP resources:", error);
    throw error;
  }
});

ipcMain.handle(
  "mcp:readResource",
  async (_, uri: string, serverName?: string) => {
    try {
      let client: McpClientService | null = null;

      if (serverName && mcpClientServices[cleanServerName(serverName)]) {
        client = mcpClientServices[cleanServerName(serverName)];
      } else {
        // Use the first available client
        const clients = Object.values(mcpClientServices);
        if (clients.length > 0) {
          client = clients[0];
        }
      }

      if (!client) {
        throw new Error("No MCP client connected");
      }

      return await client.readResource(uri);
    } catch (error) {
      console.error(`Failed to read MCP resource ${uri}:`, error);
      throw error;
    }
  }
);

ipcMain.handle(
  "mcp:callTool",
  async (
    _,
    params: { serverName: string; name: string; arguments: Record<string, any> }
  ) => {
    try {
      let client: McpClientService | null = null;
      const cleanedServerName = cleanServerName(params.serverName);
      if (params.serverName && mcpClientServices[cleanedServerName]) {
        client = mcpClientServices[cleanedServerName];
      } else {
        // Use the first available client
        const clients = Object.values(mcpClientServices);
        if (clients.length > 0) {
          client = clients[0];
        }
      }

      if (!client) {
        throw new Error("No MCP client connected");
      }

      // Check if this is a browser agent tool that needs extended timeout
      const useExtendedTimeout = params.name === "run_browser_agent";

      return await client.callTool(
        {
          serverName: cleanedServerName,
          toolName: params.name,
          arguments: params.arguments,
        },
        0,
        useExtendedTimeout
      );
    } catch (error) {
      console.error(`Failed to call MCP tool ${params.name}:`, error);
      throw error;
    }
  }
);

ipcMain.handle(
  "ai:runSwarm",
  async (
    event,
    currentAgentName: string,
    conversationHistory: Array<{ role: "user" | "assistant"; content: string }>,
    stream = false
  ) => {
    try {
      if (stream) {
        // Create a unique ID for this streaming session
        const streamId = Date.now().toString();

        // Start the streaming process asynchronously
        (async () => {
          try {
            // Get the streaming generator
            const streamGenerator = await aiSwarmService.run({
              agentName: currentAgentName,
              messages: conversationHistory,
              stream: true,
              debug: true,
            });

            // Send start event
            event.sender.send(`ai:stream-chunk-${streamId}`, {
              delim: "start",
            });

            // Process each chunk and send it to the renderer
            let finalResponse = null;

            for await (const chunk of streamGenerator) {
              // If this is the final response, save it for later
              if ("response" in chunk) {
                finalResponse = chunk.response;
                continue; // Don't send it yet
              }

              // Send the chunk to the renderer
              event.sender.send(`ai:stream-chunk-${streamId}`, chunk);
            }

            // Send end event
            event.sender.send(`ai:stream-chunk-${streamId}`, { delim: "end" });

            // If we have a final response, send it after the end delimiter
            if (finalResponse) {
              event.sender.send(`ai:stream-chunk-${streamId}`, {
                response: finalResponse,
              });
            }

            // Signal that streaming is complete
            event.sender.send(`ai:stream-done-${streamId}`);
          } catch (error) {
            console.error("Error in streaming:", error);
            // Send error to the renderer
            event.sender.send(`ai:stream-chunk-${streamId}`, {
              error: error instanceof Error ? error.message : "Unknown error",
            });
            event.sender.send(`ai:stream-done-${streamId}`);
          }
        })();

        // Return the stream ID so the renderer can listen for events
        return { streamId };
      } else {
        // Regular non-streaming response
        const response = await aiSwarmService.run({
          agentName: currentAgentName,
          messages: conversationHistory,
        });
        return response;
      }
    } catch (error) {
      console.error("Error running swarm:", error);
      return {
        agentName: currentAgentName,
        messages: [
          {
            role: "assistant",
            content: `Error: ${
              error instanceof Error ? error.message : "Unknown error"
            }`,
            sender: currentAgentName,
          },
        ],
      };
    }
  }
);

// Set up IPC handlers for AI agent
ipcMain.handle(
  "ai:processMessage",
  async (
    _,
    message: string,
    conversationHistory: Array<{ role: "user" | "assistant"; content: string }>
  ) => {
    try {
      return await aiAgentService.processMessage(message, conversationHistory);
    } catch (error) {
      console.error("Failed to process AI message:", error);
      throw error;
    }
  }
);

ipcMain.handle(
  "ai:processToolCalls",
  async (
    _,
    toolCalls: Array<{
      serverName: string;
      toolName: string;
      arguments: Record<string, any>;
    }>,
    conversationHistory: Array<{ role: "user" | "assistant"; content: string }>
  ) => {
    try {
      return await aiAgentService.processToolCalls(
        toolCalls,
        conversationHistory
      );
    } catch (error) {
      console.error("Failed to process tool calls:", error);
      throw error;
    }
  }
);

ipcMain.handle(
  "ai:callTools",
  async (
    _,
    toolCalls: Array<{
      serverName: string;
      toolName: string;
      arguments: Record<string, any>;
    }>
  ) => {
    try {
      return await aiAgentService.callTools(toolCalls);
    } catch (error) {
      console.error("Failed to call tools:", error);
      throw error;
    }
  }
);

ipcMain.handle(
  "ai:transformToolResponse",
  async (
    _,
    toolResponses: Array<{ name: string; response: any }>,
    conversationHistory: Array<{ role: "user" | "assistant"; content: string }>
  ) => {
    try {
      return await aiAgentService.transformToolResponse(
        toolResponses,
        conversationHistory
      );
    } catch (error) {
      console.error("Failed to transform tool response:", error);
      throw error;
    }
  }
);

ipcMain.handle(
  "ai:transformToolResponseToAlert",
  async (
    _,
    toolResponses: Array<{ name: string; response: any }>,
    conversationHistory: Array<{ role: "user" | "assistant"; content: string }>
  ) => {
    try {
      return await aiAgentService.transformToolResponseToAlert(
        toolResponses,
        conversationHistory
      );
    } catch (error) {
      console.error("Failed to transform tool response to alert:", error);
      throw error;
    }
  }
);

// Set up IPC handlers for React component generator
ipcMain.handle(
  "react:registerComponent",
  async (_, componentCode: string, componentName: string) => {
    try {
      const result = await reactComponentGeneratorService.registerComponent(
        componentCode,
        componentName
      );
      return result;
    } catch (error) {
      console.error("Error registering React component:", error);
      return {
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
);

ipcMain.handle("react:getComponent", async (_, name: string) => {
  try {
    const result = await reactComponentGeneratorService.getComponent(name);
    return { exists: !!result };
  } catch (error) {
    console.error("Error checking React component:", error);
    return {
      exists: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
});

ipcMain.handle("react:listComponents", async () => {
  try {
    const components = await reactComponentGeneratorService.listComponents();
    return components;
  } catch (error) {
    console.error("Error listing React components:", error);
    return { error: error instanceof Error ? error.message : "Unknown error" };
  }
});

ipcMain.handle("react:removeComponent", async (_, name: string) => {
  try {
    const success = await reactComponentGeneratorService.removeComponent(name);
    return { success };
  } catch (error) {
    console.error("Error removing React component:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
});

// Dashboard Configuration API
ipcMain.handle("dashboard:getConfig", async () => {
  try {
    const config = dashboardConfigService.getDashboardConfig();
    return { success: true, config };
  } catch (error) {
    console.error("Error getting dashboard config:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
});

ipcMain.handle("dashboard:getQuestions", async () => {
  try {
    const questions = dashboardConfigService.getDashboardQuestions();
    return { success: true, questions };
  } catch (error) {
    console.error("Error getting dashboard questions:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
});

ipcMain.handle(
  "dashboard:addQuestion",
  async (_, question: DashboardQuestion) => {
    try {
      const newQuestion = dashboardConfigService.addQuestion(question);
      return { success: true, question: newQuestion };
    } catch (error) {
      console.error("Error adding dashboard question:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
);

ipcMain.handle(
  "dashboard:updateQuestion",
  async (_, id: number, question: Partial<DashboardQuestion>) => {
    try {
      const updatedQuestion = dashboardConfigService.updateQuestion(
        id,
        question
      );
      if (!updatedQuestion) {
        return { success: false, error: `Question with ID ${id} not found` };
      }
      return { success: true, question: updatedQuestion };
    } catch (error) {
      console.error("Error updating dashboard question:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
);

ipcMain.handle("dashboard:deleteQuestion", async (_, id: number) => {
  try {
    const success = dashboardConfigService.deleteQuestion(id);
    if (!success) {
      return { success: false, error: `Question with ID ${id} not found` };
    }
    return { success: true };
  } catch (error) {
    console.error("Error deleting dashboard question:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
});

ipcMain.handle("dashboard:addAlert", async (_, alert: DashboardAlert) => {
  try {
    const newAlert = dashboardConfigService.addAlert(alert);
    return { success: true, alert: newAlert };
  } catch (error) {
    console.error("Error adding dashboard alert:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
});

ipcMain.handle(
  "dashboard:updateAlert",
  async (_, id: number, alert: Partial<DashboardAlert>) => {
    try {
      const updatedAlert = dashboardConfigService.updateAlert(id, alert);
      if (!updatedAlert) {
        return { success: false, error: `Alert with ID ${id} not found` };
      }
      return { success: true, alert: updatedAlert };
    } catch (error) {
      console.error("Error updating dashboard alert:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
);

ipcMain.handle("dashboard:deleteAlert", async (_, id: number) => {
  try {
    const success = dashboardConfigService.deleteAlert(id);
    if (!success) {
      return { success: false, error: `Alert with ID ${id} not found` };
    }
    return { success: true };
  } catch (error) {
    console.error("Error deleting dashboard alert:", error);
    return { success: false };
  }
});

// Add IPC handler for saving environment variables to .env file
ipcMain.handle("config:saveEnvVars", async (_, envVars) => {
  const success = saveEnvConfig(envVars);

  // If the API key was updated, update it in the services
  if (success && envVars.ANTHROPIC_API_KEY) {
    // Update the API key in the Swarm service
    aiSwarmService.setAnthropicApiKey(envVars.ANTHROPIC_API_KEY);

    // Update the API key in the AI Agent service
    aiAgentService.setAnthropicApiKey(envVars.ANTHROPIC_API_KEY);

    // Update the config object
    config.anthropicApiKey = envVars.ANTHROPIC_API_KEY;
  }

  // Update other config values (these will require restart to fully take effect)
  if (success && envVars.AI_MODEL) {
    config.aiModel = envVars.AI_MODEL;
  }

  if (success && envVars.MAX_TOKENS) {
    config.maxTokens = parseInt(envVars.MAX_TOKENS, 10);
  }

  return success;
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", () => {
  session.defaultSession.protocol.registerFileProtocol(
    "static",
    (request, callback) => {
      const fileUrl = request.url.replace("static://", "");
      const filePath = path.join(
        app.getAppPath(),
        ".webpack/renderer",
        fileUrl
      );
      callback(filePath);
    }
  );

  // Handle opening external links in default browser
  ipcMain.handle("open-external-link", async (_, url) => {
    try {
      await shell.openExternal(url);
      return { success: true };
    } catch (error) {
      console.error("Failed to open external link:", error);
      return { success: false, error: error.message };
    }
  });

  // Add IPC handlers for MCP server configuration
  ipcMain.handle("config:loadMcpServers", async () => {
    return loadMcpServersConfig();
  });

  ipcMain.handle("config:saveMcpServers", async (_, config) => {
    return saveMcpServersConfig(config);
  });

  // Add IPC handler for getting app configuration
  ipcMain.handle("config:getAppConfig", async () => {
    return config;
  });

  createWindow();
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Clean up resources when quitting
app.on("will-quit", async () => {
  if (Object.values(mcpClientServices).length > 0) {
    try {
      for (const name in mcpClientServices) {
        await mcpClientServices[name].disconnect();
      }
    } catch (error) {
      console.error("Error disconnecting MCP clients during app quit:", error);
    }
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
