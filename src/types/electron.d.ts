interface ElectronAPI {
  // MCP Client API
  connectMcpClient: (
    serverConfig: McpServerConfig,
    serverName: string
  ) => Promise<{ success: boolean; error?: string }>;
  disconnectMcpClient: (
    serverName: string
  ) => Promise<{ success: boolean; error?: string }>;
  getMcpServers: () => Promise<{
    success: boolean;
    servers: Record<string, McpServerConfig>;
    error?: string;
  }>;
  getConnectedClients: () => Promise<{
    success: boolean;
    connectedClients: string[];
    error?: string;
  }>;
  onServersConnected: (callback: () => void) => () => void;
  listMcpPrompts: (serverName?: string) => Promise<any>;
  getMcpPrompt: (name: string, args: Record<string, any>, serverName?: string) => Promise<any>;
  listMcpResources: (serverName?: string) => Promise<any>;
  readMcpResource: (uri: string, serverName?: string) => Promise<any>;
  callMcpTool: (params: { serverName: string, name: string; arguments: Record<string, any> }) => Promise<any>;
  
  // External link handling
  openExternalLink: (url: string) => Promise<any>;
  
  // AI Agent API
  runSwarm: (currentAgentName: string, conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>) => Promise<{
    agentName: string;
    messages: any[];
  }>;
  processAiMessage: (message: string, conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>) => Promise<{
    content: string;
    toolCalls?: Array<{ name: string; arguments: Record<string, any> }>;
  }>;
  processToolCalls: (toolCalls: Array<{ name: string; arguments: Record<string, any> }>, conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>) => Promise<string>;
  callTools: (toolCalls: Array<{ name: string; arguments: Record<string, any> }>) => Promise<Array<{ name: string; response: any }>>;
  transformToolResponse: (toolResponses: Array<{ name: string; response: any }>, conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>) => Promise<string>;
  transformToolResponseToAlert: (toolResponses: Array<{ name: string; response: any }>, conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>) => Promise<string>;

  // React Component Generator API
  registerReactComponent: (componentCode: string, componentName: string) => Promise<any>;
  getReactComponent: (name: string) => Promise<any>;
  listReactComponents: () => Promise<any>;
  removeReactComponent: (name: string) => Promise<any>;
    
  // Dashboard Configuration API
  getDashboardQuestions: () => Promise<{
    success: boolean;
    questions: Array<{
      id?: number;
      question: string;
      additionalInstructions?: string;
      suggestedTitle?: string;
      suggestedType?: string;
      customColor?: string;
    }>;
    error?: string;
  }>;
  addDashboardQuestion: (question: {
    question: string;
    additionalInstructions?: string;
    suggestedTitle?: string;
    suggestedType?: string;
    customColor?: string;
  }) => Promise<{
    success: boolean;
    question?: any;
    error?: string;
  }>;
  updateDashboardQuestion: (
    id: number,
    question: {
      question?: string;
      additionalInstructions?: string;
      suggestedTitle?: string;
      suggestedType?: string;
      customColor?: string;
    }
  ) => Promise<{
    success: boolean;
    question?: any;
    error?: string;
  }>;
  deleteDashboardQuestion: (id: number) => Promise<{
    success: boolean;
    error?: string;
  }>;

  // Configuration API
  loadMcpServersConfig: () => Promise<{
    success: boolean;
    config: Record<string, McpServerConfig>;
    error?: string;
  }>;
  saveMcpServersConfig: (config: Record<string, McpServerConfig>) => Promise<{
    success: boolean;
    error?: string;
  }>;
  saveEnvConfig: (envVars: Record<string, string>) => Promise<{
    success: boolean;
    error?: string;
  }>;
  getAppConfig: () => Promise<AppConfig>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {}; 