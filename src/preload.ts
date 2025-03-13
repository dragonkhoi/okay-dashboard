// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from 'electron';
import { Agent } from './services/swarm/agent';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // MCP Client API
  connectMcpClient: (serverConfig: { command: string; args: string[]; name?: string }, serverName?: string) => 
    ipcRenderer.invoke('mcp:connect', serverConfig, serverName),
  disconnectMcpClient: (serverName?: string) => 
    ipcRenderer.invoke('mcp:disconnect', serverName),
  getMcpServers: () =>
    ipcRenderer.invoke('mcp:getServers'),
  getConnectedClients: () =>
    ipcRenderer.invoke('mcp:getConnectedClients'),
  onServersConnected: (callback: () => void) => {
    const subscription = (_event: Electron.IpcRendererEvent) => callback();
    ipcRenderer.on('mcp:serversConnected', subscription);
    
    return () => {
      ipcRenderer.removeListener('mcp:serversConnected', subscription);
    };
  },
  listMcpPrompts: (serverName?: string) => 
    ipcRenderer.invoke('mcp:listPrompts', serverName),
  getMcpPrompt: (name: string, args: Record<string, any>, serverName?: string) => 
    ipcRenderer.invoke('mcp:getPrompt', name, args, serverName),
  listMcpResources: (serverName?: string) => 
    ipcRenderer.invoke('mcp:listResources', serverName),
  readMcpResource: (uri: string, serverName?: string) => 
    ipcRenderer.invoke('mcp:readResource', uri, serverName),
  callMcpTool: (params: { serverName: string, name: string; arguments: Record<string, any> }) => 
    ipcRenderer.invoke('mcp:callTool', params),
  
  // AI Agent API
  runSwarm: (currentAgentName: string, conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>) => 
    ipcRenderer.invoke('ai:runSwarm', currentAgentName, conversationHistory),
  processAiMessage: (message: string, conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>) => 
    ipcRenderer.invoke('ai:processMessage', message, conversationHistory),
  processToolCalls: (toolCalls: Array<{ name: string; arguments: Record<string, any> }>, conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>) => 
    ipcRenderer.invoke('ai:processToolCalls', toolCalls, conversationHistory),
  callTools: (toolCalls: Array<{ name: string; arguments: Record<string, any> }>) => 
    ipcRenderer.invoke('ai:callTools', toolCalls),
  transformToolResponse: (toolResponses: Array<{ name: string; response: any }>, conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>) => 
    ipcRenderer.invoke('ai:transformToolResponse', toolResponses, conversationHistory),
  transformToolResponseToAlert: (toolResponses: Array<{ name: string; response: any }>, conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>) => 
    ipcRenderer.invoke('ai:transformToolResponseToAlert', toolResponses, conversationHistory),

  // React Component Generator API
  registerReactComponent: (componentCode: string, componentName: string) =>
    ipcRenderer.invoke('react:registerComponent', componentCode, componentName),
  getReactComponent: (name: string) =>
    ipcRenderer.invoke('react:getComponent', name),
  listReactComponents: () =>
    ipcRenderer.invoke('react:listComponents'),
  removeReactComponent: (name: string) =>
    ipcRenderer.invoke('react:removeComponent', name),
    
  // Dashboard Configuration API
  getDashboardQuestions: () =>
    ipcRenderer.invoke('dashboard:getQuestions'),
  addDashboardQuestion: (question: { 
    question: string; 
    additionalInstructions?: string; 
    suggestedTitle?: string; 
    suggestedType?: string; 
    customColor?: string; 
  }) =>
    ipcRenderer.invoke('dashboard:addQuestion', question),
  updateDashboardQuestion: (id: number, question: { 
    question?: string; 
    additionalInstructions?: string; 
    suggestedTitle?: string; 
    suggestedType?: string; 
    customColor?: string; 
  }) =>
    ipcRenderer.invoke('dashboard:updateQuestion', id, question),
  deleteDashboardQuestion: (id: number) =>
    ipcRenderer.invoke('dashboard:deleteQuestion', id),
});
