import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables from .env file
dotenv.config();

export interface AppConfig {
  anthropicApiKey: string;
  aiModel: string;
  maxTokens: number;
}

export interface McpServerConfig {
  command?: string;
  sse?: string;
  args?: string[];
  name?: string;
  env?: Record<string, string>;
  relevantAgents?: string[];
}

export interface McpServersConfig {
  mcpServers: Record<string, McpServerConfig>;
}

// Get the app's root directory
export const getAppRoot = (): string => {
  // In development, use the current directory
  if (process.env.NODE_ENV === 'development') {
    return process.cwd();
  }
  
  // In production (Electron app), use the app's path
  if (process.type === 'renderer') {
    return path.join(process.resourcesPath, 'app');
  }
  
  return process.cwd();
};

// Load the configuration
export const loadConfig = (): AppConfig => {
  const appRoot = getAppRoot();
  const envPath = path.join(appRoot, '.env');
  
  // If .env file exists and we haven't loaded it yet, load it
  if (fs.existsSync(envPath) && !process.env.ANTHROPIC_API_KEY) {
    dotenv.config({ path: envPath });
  }
  
  // Get configuration from environment variables
  const config: AppConfig = {
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
    aiModel: process.env.AI_MODEL || 'claude-3-5-sonnet-20240620',
    maxTokens: parseInt(process.env.MAX_TOKENS || '4096', 10),
  };
  
  // Validate required configuration
  if (!config.anthropicApiKey) {
    console.error('Missing required environment variable: ANTHROPIC_API_KEY');
  }
  
  return config;
};

// Load MCP server configurations from a JSON file
export const loadMcpServersConfig = (configPath?: string): McpServersConfig => {
  try {
    const appRoot = getAppRoot();
    const filePath = configPath || path.join(appRoot, 'mcp-servers.json');
    
    if (!fs.existsSync(filePath)) {
      console.warn(`MCP servers config file not found at ${filePath}`);
      return { mcpServers: {} };
    }
    
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const config = JSON.parse(fileContent) as McpServersConfig;
    
    // Validate the configuration
    if (!config.mcpServers || typeof config.mcpServers !== 'object') {
      console.error('Invalid MCP servers configuration: mcpServers object is missing or invalid');
      return { mcpServers: {} };
    }
    
    // Process any special characters in args if needed
    Object.keys(config.mcpServers).forEach(serverName => {
      const server = config.mcpServers[serverName];
      
      // Ensure the server has a name property if not already set
      if (!server.name) {
        server.name = serverName;
      }
      
      // Process any JSON strings in args that might need parsing
      server.args = server.sse ? null : server.args.map(arg => {
        if (typeof arg === 'string' && arg.startsWith('"\\{') && arg.endsWith('\\}"')) {
          // This is likely a JSON string that needs to be properly parsed
          try {
            // Remove the outer quotes and unescape the inner quotes
            const cleanedArg = arg.slice(1, -1).replace(/\\"/g, '"');
            return cleanedArg;
          } catch (e) {
            console.warn(`Failed to parse JSON arg: ${arg}`, e);
            return arg;
          }
        }
        return arg;
      });
      
      // Inject environment variables if specified in the server config
      if (server.env && typeof server.env === 'object') {
        console.log(`Injecting environment variables for MCP server: ${serverName}`);
        Object.entries(server.env).forEach(([key, value]) => {
          if (typeof value === 'string') {
            process.env[key] = value;
            console.log(`Set environment variable: ${key}`);
          } else {
            console.warn(`Skipping non-string environment variable: ${key}`);
          }
        });
      }
    });

    console.log("mcp server config", config);
    
    return config;
  } catch (error) {
    console.error('Error loading MCP servers configuration:', error);
    return { mcpServers: {} };
  }
};

// Export the loaded configuration
export const config = loadConfig(); 