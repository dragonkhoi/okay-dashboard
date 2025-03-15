import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  getDefaultEnvironment,
  StdioClientTransport,
} from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import {
  CallToolRequest,
  CallToolResultSchema,
  ListToolsResultSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { cleanServerName } from "./utils";
import { SERVER_TOOL_NAME_SEPARATOR } from "../constants";
import { Transport } from "@modelcontextprotocol/sdk/dist/esm/shared/transport";

export interface McpServerConfig {
  sse?: string;
  command?: string;
  args?: string[];
  name?: string;
  connected?: boolean;
  env?: Record<string, string>;
  relevantAgents?: string[];
}

export interface MCPTool {
  name: string;
  description?: string;
  input_schema: {
    type: "object";
    properties?: Record<string, unknown>;
  };
}

export class McpClientService {
  private client: Client | null = null;
  private transport: Transport | null = null;
  private serverConfig: McpServerConfig;
  private isConnected = false;
  private availableTools: MCPTool[] = [];

  constructor(serverConfig: McpServerConfig) {
    this.serverConfig = {
      ...serverConfig,
      name: cleanServerName(serverConfig.name),
    };
  }

  getServerName() {
    return this.serverConfig.name;
  }

  public getIsConnected() {
    return this.isConnected;
  }

  async connect(): Promise<void> {
    if (this.isConnected) {
      console.log("MCP client already connected");
      return;
    }

    try {
      this.transport = this.serverConfig.sse
        ? new SSEClientTransport(new URL(this.serverConfig.sse))
        : new StdioClientTransport({
            command: this.serverConfig.command,
            args: this.serverConfig.args,
            env: { ...getDefaultEnvironment(), ...this.serverConfig.env },
          });

      this.client = new Client(
        {
          name: this.serverConfig.name || "dashboard-client",
          version: "1.0.0",
        },
        {
          capabilities: {
            prompts: {},
            resources: {},
            tools: {},
          },
        }
      );

      await this.client.connect(this.transport);
      this.isConnected = true;
      console.log("MCP client connected successfully!");

      try {
        const toolsResponse = await this.client.listTools();
        this.availableTools = toolsResponse.tools.map((tool) => ({
          name: this.getServerName() + SERVER_TOOL_NAME_SEPARATOR + tool.name,
          description: tool.description,
          input_schema: {
            type: tool.inputSchema.type || "object",
            properties: tool.inputSchema.properties || {},
          },
        }));
      } catch (error) {
        console.error("Error listing tools:", error);
        throw error;
      }
    } catch (error) {
      console.error("Failed to connect MCP client:", error);
      throw error;
    }
  }

  /**
   * Returns whatever the MCP Server returns, could be string or JSON if parseable
   */
  async callTool(
    params: {
      serverName: string;
      toolName: string;
      arguments: Record<string, any>;
    },
    retryCount = 0
  ): Promise<any> {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1000;

    try {
      console.log(
        `Using tool: ${params.toolName} from server: ${
          params.serverName
        } with args: ${JSON.stringify(params.arguments)}`
      );

      const response = await this.client.callTool({
        name: params.toolName,
        arguments: params.arguments,
      });
      console.log("Received response:", JSON.stringify(response, null, 2));

      if (response.isError) {
        console.error("Error calling tool:", response.error);
      }

      if (response.content && Array.isArray(response.content)) {
        const textContent = response.content
          .filter((item) => item.type === "text")
          .map((item) => item.text)
          .join("\n");

        if (textContent) {
          try {
            return JSON.parse(textContent);
          } catch (error) {
            console.error("Tool response is not JSON");
          }
          return textContent;
        }
      }

      throw new Error("Invalid response format from server");
    } catch (error) {
      console.error(
        `Failed to call tool ${params.toolName} from server ${params.serverName}:`,
        error
      );
      if (error instanceof Error) {
        const errorDetails = {
          name: error.name,
          message: error.message,
          stack: error.stack,
          cause: (error as any).cause,
          response: (error as any).response,
          status: (error as any).status,
          statusText: (error as any).statusText,
        };
        console.error("Error details:", errorDetails);

        // Check if it's a 500 error and we can retry
        if (errorDetails.status === 500 && retryCount < MAX_RETRIES) {
          console.log(
            `Retrying tool call (attempt ${retryCount + 1}/${MAX_RETRIES})...`
          );
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
          return this.callTool(params, retryCount + 1);
        }

        // If it's a 500 error but we're out of retries, throw a more specific error
        if (errorDetails.status === 500) {
          throw new Error(
            `Server error (500) after ${MAX_RETRIES} retries. The Rijksmuseum API might be experiencing issues.`
          );
        }
      }
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.isConnected || !this.client) {
      return;
    }

    try {
      // For now, we'll just close the transport since the Client class doesn't have a disconnect method
      if (this.transport) {
        await this.transport.close();
      }
      this.isConnected = false;
      console.log("MCP client disconnected");
    } catch (error) {
      console.error("Error disconnecting MCP client:", error);
      throw error;
    }
  }

  async listPrompts(): Promise<any> {
    if (!this.isConnected || !this.client) {
      throw new Error("MCP client not connected");
    }

    try {
      return await this.client.listPrompts();
    } catch (error) {
      console.error("Error listing prompts:", error);
      throw error;
    }
  }

  async getPrompt(name: string, args: Record<string, any>): Promise<any> {
    if (!this.isConnected || !this.client) {
      throw new Error("MCP client not connected");
    }

    try {
      return await this.client.getPrompt({ name, arguments: args });
    } catch (error) {
      console.error(`Error getting prompt ${name}:`, error);
      throw error;
    }
  }

  async listResources(): Promise<any> {
    if (!this.isConnected || !this.client) {
      throw new Error("MCP client not connected");
    }

    try {
      return await this.client.listResources();
    } catch (error) {
      console.error("Error listing resources:", error);
      throw error;
    }
  }

  async readResource(uri: string): Promise<any> {
    if (!this.isConnected || !this.client) {
      throw new Error("MCP client not connected");
    }

    try {
      return await this.client.readResource({ uri });
    } catch (error) {
      console.error(`Error reading resource ${uri}:`, error);
      throw error;
    }
  }

  getAvailableTools() {
    return this.availableTools;
  }
}
