// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from 'electron';
import { Agent } from './services/swarm/agent';
import { McpServerConfig } from './services/mcpClient';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // MCP Client API
  connectMcpClient: (serverConfig: McpServerConfig, serverName: string) => 
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
  
  // External link handling
  openExternalLink: (url: string) => 
    ipcRenderer.invoke('open-external-link', url),
  
  // AI Agent API
  runSwarm: (currentAgentName: string, conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>, stream?: boolean) => 
    ipcRenderer.invoke('ai:runSwarm', currentAgentName, conversationHistory, stream),
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
  getDashboardConfig: () =>
    ipcRenderer.invoke('dashboard:getConfig'),
  getDashboardQuestions: () =>
    ipcRenderer.invoke('dashboard:getQuestions'),
  saveDashboardQuestions: (questions: Array<any>) =>
    ipcRenderer.invoke('dashboard:saveQuestions', questions),
  addDashboardQuestion: (question: any) =>
    ipcRenderer.invoke('dashboard:addQuestion', question),
  updateDashboardQuestion: (id: number, question: any) =>
    ipcRenderer.invoke('dashboard:updateQuestion', id, question),
  deleteDashboardQuestion: (id: number) =>
    ipcRenderer.invoke('dashboard:deleteQuestion', id),
  addDashboardAlert: (alert: any) =>
    ipcRenderer.invoke('dashboard:addAlert', alert),
  updateDashboardAlert: (id: number, alert: any) =>
    ipcRenderer.invoke('dashboard:updateAlert', id, alert),
  deleteDashboardAlert: (id: number) =>
    ipcRenderer.invoke('dashboard:deleteAlert', id),

  
  // Config API
  loadMcpServersConfig: () =>
    ipcRenderer.invoke('config:loadMcpServers'),
  saveMcpServersConfig: (config: any) =>
    ipcRenderer.invoke('config:saveMcpServers', config),
  saveEnvConfig: (envVars: Record<string, string>) =>
    ipcRenderer.invoke('config:saveEnvVars', envVars),
  getAppConfig: () =>
    ipcRenderer.invoke('config:getAppConfig'),

  // Stream events
  onStreamChunk: (streamId: string, callback: (chunk: any) => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, chunk: any) => callback(chunk);
    ipcRenderer.on(`ai:stream-chunk-${streamId}`, subscription);
    
    return () => {
      ipcRenderer.removeListener(`ai:stream-chunk-${streamId}`, subscription);
    };
  },
  
  onStreamDone: (streamId: string, callback: () => void) => {
    const subscription = (_event: Electron.IpcRendererEvent) => callback();
    ipcRenderer.on(`ai:stream-done-${streamId}`, subscription);
    
    return () => {
      ipcRenderer.removeListener(`ai:stream-done-${streamId}`, subscription);
    };
  },
});
