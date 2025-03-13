import { ToolChoice } from "@anthropic-ai/sdk/resources";
import { MCPTool } from "../mcpClient";

export type AgentFunction = (() => string) | Agent | Record<string, any> | MCPTool;

export class Agent {
  name: string;
  instructions: string | ((contextVariables?: Record<string, any>) => string) = "You are a helpful agent.";
  functions: AgentFunction[] = [];
  model: string;
  toolChoice: ToolChoice = {type: "auto"};
  parallelToolCalls = true;

  constructor(init?: Partial<Agent>) {
    Object.assign(this, init);
  }

  getInstructions(contextVariables?: Record<string, any>): string {
    return typeof this.instructions === "function"
      ? this.instructions(contextVariables)
      : this.instructions;
  }

  //  convertToolsToJsonSchema() {
  //   return this.tools.map(tool => {
  //     if (typeof tool === 'function') {
  //       return convertFunctionToJsonSchema(tool);
  //     } else if (typeof tool === 'object' && tool.function) {
  //       // Assume the tool is already in the correct format
  //       return tool;
  //     } else {
  //       throw new Error(`Invalid tool format: ${tool}`);
  //     }
  //   });
  // }
}
