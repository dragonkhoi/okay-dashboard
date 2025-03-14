import React, { useState } from "react";
import { AGENT_PREFIX, MCP_SERVER_ICONS, SERVER_TOOL_NAME_SEPARATOR } from "../constants";

interface ToolUseCollapsibleProps {
  toolCall: {
    type: "tool_use";
    content: Array<{
      name: string;
      content: string;
      input: any;
    }>;
  };
  toolResult?: {
    type: "tool_result";
    content: Array<{
      content: string;
      [key: string]: any;
    }>;
  };
  isAssistant?: boolean;
}

const ToolUseCollapsible: React.FC<ToolUseCollapsibleProps> = ({ 
  toolCall, 
  toolResult,
  isAssistant = true
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Handle agent handoff messages
  if (toolCall.content[0].name.startsWith(AGENT_PREFIX)) {
    // Get the agent name and format it from snake_case to readable format
    const agentFullName = toolCall.content[0].name.split(SERVER_TOOL_NAME_SEPARATOR)[1] || "unknown";
    const agentName = agentFullName
      .split('_')
      .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    
    return (
      <div className={`p-3 rounded-lg max-w-[80%] break-words whitespace-pre-wrap ${
        isAssistant ? "self-start bg-gray-100 text-gray-800" : "self-end bg-blue-500 text-white"
      }`}>
        <p>Asking {agentName}...</p>
      </div>
    );
  }

  // Check if tool result is from agent handoff
  const isAgentHandoffResult = toolResult && 
    toolResult.content[0] && 
    typeof toolResult.content[0].content === 'string' && 
    toolResult.content[0].content.startsWith(AGENT_PREFIX);

  if (isAgentHandoffResult) {
    return null; // Don't show agent handoff results
  }

  // Get tool name for display
  const toolName = toolCall.content[0].name;
  const displayToolName = toolName.includes(SERVER_TOOL_NAME_SEPARATOR) 
    ? toolName.split(SERVER_TOOL_NAME_SEPARATOR)[1] 
    : toolName;

  // Format the tool name to be more readable
  const formattedToolName = displayToolName
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase());

  // Determine if we have a result to show
  const hasResult = toolResult && toolResult.content && toolResult.content.length > 0;

  return (
    <div className={`p-3 rounded-lg max-w-[80%] break-words whitespace-pre-wrap shadow-sm transition-all duration-200 ${
      isAssistant ? "self-start bg-gray-50 text-gray-800 border border-gray-200" : "self-end bg-blue-500 text-white"
    } ${isExpanded ? "my-3" : "my-1"}`}>
      <div 
        className="flex items-center cursor-pointer" 
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex-1 font-medium flex items-center">
          <span className="mr-2 text-xs transition-transform duration-200" style={{ 
            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)'
          }}>
            ▶
          </span>
          <img
            src={MCP_SERVER_ICONS[toolName.split(SERVER_TOOL_NAME_SEPARATOR)[0]] || MCP_SERVER_ICONS["default"]}
            alt={`${toolName.split(SERVER_TOOL_NAME_SEPARATOR)[0]} icon`}
            className="w-4 h-4 mr-2 object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).src = MCP_SERVER_ICONS["default"];
            }}
          />
          <span className="text-sm">
            {formattedToolName}
            {hasResult && !isExpanded && (
              <span className="ml-2 text-xs opacity-60">
                {isAssistant ? "(completed)" : ""}
              </span>
            )}
          </span>
        </div>
      </div>
      
      {isExpanded && (
        <div className="mt-3 border-t pt-3 transition-all duration-300">
          <div className="mb-3">
            <div className="text-xs font-medium mb-1 opacity-70">Arguments:</div>
            <pre className={`text-xs p-2 rounded overflow-auto max-h-40 ${
              isAssistant ? "bg-gray-200" : "bg-blue-600"
            }`}>
              {JSON.stringify(toolCall.content[0].input, null, 2)}
            </pre>
          </div>
          
          {hasResult && (
            <div>
              <div className="text-xs font-medium mb-1 opacity-70">Result:</div>
              <pre className={`text-xs p-2 rounded overflow-auto max-h-60 ${
                isAssistant ? "bg-gray-200" : "bg-blue-600"
              }`}>
                {(() => {
                  try {
                    const parsed = JSON.parse(toolResult.content[0].content);
                    return JSON.stringify(parsed, null, 2);
                  } catch (e) {
                    return toolResult.content[0].content;
                  }
                })()}
              </pre>
            </div>
          )}
          
          {!hasResult && (
            <div className="text-xs italic opacity-70">
              Waiting for result...
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ToolUseCollapsible;