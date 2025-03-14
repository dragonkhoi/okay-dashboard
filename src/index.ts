import { app, BrowserWindow, ipcMain, net, session } from 'electron';
import { McpClientService, McpServerConfig } from './services/mcpClient';
import { AiAgentService } from './services/aiAgent';
import { ReactComponentGeneratorService } from './services/reactComponentGenerator';
import { loadMcpServersConfig, config } from './services/config';
import { DashboardConfigService, DashboardQuestion } from './services/dashboardConfig';
import * as path from 'path';
import { cleanServerName } from './services/utils';
import { join } from 'path';
import { Swarm } from './services/swarm/swarm';
import { AgentDirectory } from './services/swarm/agentDirectory';
import { Agent } from './services/swarm/agent';
import { AGENT_PREFIX, COMMUNICATION_AGENT, EXTERNAL_SEARCH_AGENT, INTERNAL_SEARCH_AGENT, MONEY_AGENT, PLANNER_AGENT, PRODUCT_ANALYTICS_AGENT, SERVER_TOOL_NAME_SEPARATOR } from './constants';

// This allows TypeScript to pick up the magic constants that's auto-generated by Forge's Webpack
// plugin that tells the Electron app where to look for the Webpack-bundled app code (depending on
// whether you're running in development or production).
declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
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
const plannerInstructions = (contextVariables: Record<string, any>) => { 
  return `You are to triage a users request, and call a tool to transfer to the right intent.
    Once you are ready to transfer to the right intent, call the tool to transfer to the right intent.
    You dont need to know specifics, just the topic of the request.
    When you need more information to triage the request to an agent, ask a direct question without explaining why you're asking it.
    Do not share your thought process with the user! Do not make unreasonable assumptions on behalf of user.`
}
const bankingAndAccountingInstructions = (contextVariables: Record<string, any>) => {
  return `You are a banking and accounting agent.
    You are to help the user with their banking and accounting needs. This includes checking balances, looking up recent transactions, and monitoring accounts.
    You should be extremely concise in your responses, ideally giving 1-3 main points that the CEO should know.
  `
}
const productAnalyticsInstructions = (contextVariables: Record<string, any>) => {
  return `You are a product analytics agent.
    You are to help the user with their product analytics needs. This includes looking up product analytics data, event tracking, retention, and other product analytics metrics.
  `
}
const externalSearchInstructions = (contextVariables: Record<string, any>) => {
  return `You are an external search agent.
    You are to help the user with their external search needs. This includes looking up information on the web.
  `
}
const internalSearchInstructions = (contextVariables: Record<string, any>) => {
  return `You are an internal search agent.
    You are to help the user with their internal search needs. This includes looking up internal documents, files, notes such as Google Drive, Notion, Slack, etc.
  `
}
const communicationInstructions = (contextVariables: Record<string, any>) => {
  return `You are a communication agent.
    You are to help the user with their communication needs. This includes sending emails, Slack messages, and other communication needs.
    If the request is not related to communication, transfer to the planner agent.
  `
}
agentDirectory.registerAgent(PLANNER_AGENT, new Agent({
  name: PLANNER_AGENT,
  instructions:  plannerInstructions,
  model: config.aiModel,
  functions: [
    {
      name: AGENT_PREFIX + SERVER_TOOL_NAME_SEPARATOR + MONEY_AGENT,
      description: "Transfer to the banking and accounting agent",
      input_schema: {
        type: "object",
      }
    },
    {
      name: AGENT_PREFIX + SERVER_TOOL_NAME_SEPARATOR + PRODUCT_ANALYTICS_AGENT,
      description: "Transfer to the product analytics agent",
      input_schema: {
        type: "object",
      }
    },
    {
      name: AGENT_PREFIX + SERVER_TOOL_NAME_SEPARATOR + EXTERNAL_SEARCH_AGENT,
      description: "Transfer to the external search agent for web, YouTube or external tool search",
      input_schema: {
        type: "object",
      }
    },
    {
      name: AGENT_PREFIX + SERVER_TOOL_NAME_SEPARATOR + INTERNAL_SEARCH_AGENT,
      description: "Transfer to the internal search agent for internal documents, files, notes such as Google Drive, Notion, Slack, etc.",
      input_schema: {
        type: "object",
      }
    },
    {
      name: AGENT_PREFIX + SERVER_TOOL_NAME_SEPARATOR + COMMUNICATION_AGENT,
      description: "Transfer to the communication agent for Slack, email, calendar, and other communication needs",
      input_schema: {
        type: "object",
      }
    }
  ]
}));
agentDirectory.registerAgent(MONEY_AGENT, new Agent({
  name: MONEY_AGENT,
  instructions: bankingAndAccountingInstructions,
  model: config.aiModel,
  functions: [{
    name: AGENT_PREFIX + SERVER_TOOL_NAME_SEPARATOR + PLANNER_AGENT,
    description: "Transfer to the planner agent because this request is not related to money",
    input_schema: {
      type: "object",
    }
  },]
}));
agentDirectory.registerAgent(PRODUCT_ANALYTICS_AGENT, new Agent({
  name: PRODUCT_ANALYTICS_AGENT,
  instructions: productAnalyticsInstructions,
  model: config.aiModel,
  functions: [{
    name: AGENT_PREFIX + SERVER_TOOL_NAME_SEPARATOR + PLANNER_AGENT,
    description: "Transfer to the planner agent because this request is not related to product analytics",
    input_schema: {
      type: "object",
    }
  },]
}));
agentDirectory.registerAgent(EXTERNAL_SEARCH_AGENT, new Agent({
  name: EXTERNAL_SEARCH_AGENT,
  instructions: externalSearchInstructions,
  model: config.aiModel,
  functions: [{
    name: AGENT_PREFIX + SERVER_TOOL_NAME_SEPARATOR + PLANNER_AGENT,
    description: "Transfer to the planner agent because this request is not related to external search",
    input_schema: {
      type: "object",
    }
  }],
}));
agentDirectory.registerAgent(INTERNAL_SEARCH_AGENT, new Agent({
  name: INTERNAL_SEARCH_AGENT,
  instructions: internalSearchInstructions,
  model: config.aiModel,
  functions: [{
    name: AGENT_PREFIX + SERVER_TOOL_NAME_SEPARATOR + PLANNER_AGENT,
    description: "Transfer to the planner agent because this request is not related to internal search",
    input_schema: {
      type: "object",
    }
  }],
}));
agentDirectory.registerAgent(COMMUNICATION_AGENT, new Agent({
  name: COMMUNICATION_AGENT,
  instructions: communicationInstructions,
  model: config.aiModel,
  functions: [
    {
      name: AGENT_PREFIX + SERVER_TOOL_NAME_SEPARATOR + PLANNER_AGENT,
      description: "Transfer to the planner agent because this request is not related to communication",
      input_schema: {
        type: "object",
      }
    }
  ],
}));

const aiSwarmService = new Swarm({
  apiKey: config.anthropicApiKey,
  model: config.aiModel,
  maxTokens: config.maxTokens,
}, agentDirectory);

const reactComponentGeneratorService = new ReactComponentGeneratorService();
const dashboardConfigService = new DashboardConfigService();

// Load MCP server configurations
const mcpServersConfig = loadMcpServersConfig();

// Connect to all MCP servers
const connectToAllMcpServers = async () => {
  const serverConfigs = mcpServersConfig.mcpServers;
  const serverNames = Object.keys(serverConfigs);
  
  if (serverNames.length === 0) {
    console.log('No MCP servers configured');
    return;
  }
  
  console.log(`Found ${serverNames.length} MCP servers in configuration`);
  
  for (const serverName of serverNames) {
    try {
      const serverConfig = serverConfigs[serverName];
      console.log(`Connecting to MCP server: ${serverName}`);
      
      const mcpClient = new McpClientService(serverConfig);
      await mcpClient.connect();
      
      mcpClientServices[cleanServerName(serverName)] = mcpClient;
      if (serverConfig.relevantAgents) {
        for (const agentName of serverConfig.relevantAgents) {
          agentDirectory.addNewAgentFunctions(agentName, mcpClient.getAvailableTools());
        }
      }
      console.log(`Successfully connected to MCP server: ${serverName}`);
    } catch (error) {
      console.error(`Failed to connect to MCP server ${serverName}:`, error);
    }
  }
  
  // Register all connected clients with the AI agent
  const connectedClients = Object.values(mcpClientServices);
  for (const client of connectedClients) {
    aiAgentService.registerMcpClient(client);
    aiSwarmService.registerMcpClient(client);
  }
  
  // Notify the renderer process that all servers have been connected
  if (mainWindow) {
    mainWindow.webContents.send('mcp:serversConnected');
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
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
  
  // Connect to all MCP servers after the window is created
  connectToAllMcpServers();
};

// Set up IPC handlers for MCP client
ipcMain.handle('mcp:connect', async (_, serverConfig: McpServerConfig, serverName?: string) => {

  const cleanedServerName = cleanServerName(serverName);
  try {
    // If serverName is provided and the client already exists, return it
    if (serverName && mcpClientServices[cleanedServerName]) {
      aiAgentService.registerMcpClient(mcpClientServices[cleanedServerName]);
      aiSwarmService.registerMcpClient(mcpClientServices[cleanedServerName]);
      return { success: true, serverName };
    }
    
    // Otherwise create a new client
    const mcpClient = new McpClientService(serverConfig);
    await mcpClient.connect();
    
    // If serverName is provided, store the client with that name
    if (serverName) {
      mcpClientServices[cleanedServerName] = mcpClient;
    }
    
    aiAgentService.registerMcpClient(mcpClient);
    aiSwarmService.registerMcpClient(mcpClient);
    return { success: true, serverName };
  } catch (error) {
    console.error('Failed to connect MCP client:', error);
    return { success: false, error: (error as Error).message };
  }
});

// Get available MCP servers from config
ipcMain.handle('mcp:getServers', async () => {
  const servers = { ...mcpServersConfig.mcpServers };
  
  return {
    success: true,
    servers
  };
});

// Get connected MCP clients
ipcMain.handle('mcp:getConnectedClients', async () => {
  const connectedClients = Object.keys(mcpClientServices);
  
  return {
    success: true,
    connectedClients
  };
});

ipcMain.handle('mcp:disconnect', async (_, serverName?: string) => {
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
    console.error('Failed to disconnect MCP client:', error);
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('mcp:listPrompts', async (_, serverName?: string) => {
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
      throw new Error('No MCP client connected');
    }
    
    return await client.listPrompts();
  } catch (error) {
    console.error('Failed to list MCP prompts:', error);
    throw error;
  }
});

ipcMain.handle('mcp:getPrompt', async (_, name: string, args: Record<string, any>, serverName?: string) => {
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
      throw new Error('No MCP client connected');
    }
    
    return await client.getPrompt(name, args);
  } catch (error) {
    console.error(`Failed to get MCP prompt ${name}:`, error);
    throw error;
  }
});

ipcMain.handle('mcp:listResources', async (_, serverName?: string) => {
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
      throw new Error('No MCP client connected');
    }
    
    return await client.listResources();
  } catch (error) {
    console.error('Failed to list MCP resources:', error);
    throw error;
  }
});

ipcMain.handle('mcp:readResource', async (_, uri: string, serverName?: string) => {
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
      throw new Error('No MCP client connected');
    }
    
    return await client.readResource(uri);
  } catch (error) {
    console.error(`Failed to read MCP resource ${uri}:`, error);
    throw error;
  }
});

ipcMain.handle('mcp:callTool', async (_, params: { serverName: string, name: string; arguments: Record<string, any> }) => {
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
      throw new Error('No MCP client connected');
    }
    
    return await client.callTool({serverName: cleanedServerName, toolName: params.name, arguments: params.arguments});
  } catch (error) {
    console.error(`Failed to call MCP tool ${params.name}:`, error);
    throw error;
  }
});

ipcMain.handle('ai:runSwarm', async (_, currentAgentName: string, conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>) => {
  try {
    return await aiSwarmService.run({agentName: currentAgentName, messages: conversationHistory, debug: true});
  } catch (error) {
    console.error('Failed to run swarm:', error);
    throw error;
  }
});

// Set up IPC handlers for AI agent
ipcMain.handle('ai:processMessage', async (_, message: string, conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>) => {
  try {
    return await aiAgentService.processMessage(message, conversationHistory);
  } catch (error) {
    console.error('Failed to process AI message:', error);
    throw error;
  }
});

ipcMain.handle('ai:processToolCalls', async (_, toolCalls: Array<{ serverName: string; toolName: string; arguments: Record<string, any> }>, conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>) => {
  try {
    return await aiAgentService.processToolCalls(toolCalls, conversationHistory);
  } catch (error) {
    console.error('Failed to process tool calls:', error);
    throw error;
  }
});

ipcMain.handle('ai:callTools', async (_, toolCalls: Array<{ serverName: string; toolName: string; arguments: Record<string, any> }>) => {
  try {
    return await aiAgentService.callTools(toolCalls);
  } catch (error) {
    console.error('Failed to call tools:', error);
    throw error;
  }
});

ipcMain.handle('ai:transformToolResponse', async (_, toolResponses: Array<{ name: string; response: any }>, conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>) => {
  try {
    return await aiAgentService.transformToolResponse(toolResponses, conversationHistory);
  } catch (error) {
    console.error('Failed to transform tool response:', error);
    throw error;
  }
});

ipcMain.handle('ai:transformToolResponseToAlert', async (_, toolResponses: Array<{ name: string; response: any }>, conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>) => {
  try {
    return await aiAgentService.transformToolResponseToAlert(toolResponses, conversationHistory);
  } catch (error) {
    console.error('Failed to transform tool response to alert:', error);
    throw error;
  }
});


// Set up IPC handlers for React component generator
ipcMain.handle('react:registerComponent', async (_, componentCode: string, componentName: string) => {
  try {
    const result = await reactComponentGeneratorService.registerComponent(componentCode, componentName);
    return result;
  } catch (error) {
    console.error('Error registering React component:', error);
    return { error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('react:getComponent', async (_, name: string) => {
  try {
    const result = await reactComponentGeneratorService.getComponent(name);
    return { exists: !!result };
  } catch (error) {
    console.error('Error checking React component:', error);
    return { exists: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('react:listComponents', async () => {
  try {
    const components = await reactComponentGeneratorService.listComponents();
    return components;
  } catch (error) {
    console.error('Error listing React components:', error);
    return { error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('react:removeComponent', async (_, name: string) => {
  try {
    const success = await reactComponentGeneratorService.removeComponent(name);
    return { success };
  } catch (error) {
    console.error('Error removing React component:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

// Dashboard Configuration API
ipcMain.handle('dashboard:getQuestions', async () => {
  try {
    const questions = dashboardConfigService.getQuestions();
    return { success: true, questions };
  } catch (error) {
    console.error('Error getting dashboard questions:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('dashboard:addQuestion', async (_, question: DashboardQuestion) => {
  try {
    const newQuestion = dashboardConfigService.addQuestion(question);
    return { success: true, question: newQuestion };
  } catch (error) {
    console.error('Error adding dashboard question:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('dashboard:updateQuestion', async (_, id: number, question: Partial<DashboardQuestion>) => {
  try {
    const updatedQuestion = dashboardConfigService.updateQuestion(id, question);
    if (!updatedQuestion) {
      return { success: false, error: `Question with ID ${id} not found` };
    }
    return { success: true, question: updatedQuestion };
  } catch (error) {
    console.error('Error updating dashboard question:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('dashboard:deleteQuestion', async (_, id: number) => {
  try {
    const success = dashboardConfigService.deleteQuestion(id);
    if (!success) {
      return { success: false, error: `Question with ID ${id} not found` };
    }
    return { success: true };
  } catch (error) {
    console.error('Error deleting dashboard question:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
  session.defaultSession.protocol.registerFileProtocol('static', (request, callback) => {
    const fileUrl = request.url.replace('static://', '');
    const filePath = path.join(app.getAppPath(), '.webpack/renderer', fileUrl);
    callback(filePath);
  });
  createWindow();
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Clean up resources when quitting
app.on('will-quit', async () => {
  if (Object.values(mcpClientServices).length > 0) {
    try {
      for (const name in mcpClientServices) {
        await mcpClientServices[name].disconnect();
      }
    } catch (error) {
      console.error('Error disconnecting MCP clients during app quit:', error);
    }
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
