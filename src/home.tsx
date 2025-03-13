import React, { useState, useEffect, useRef } from "react";
import "./home.css";
import DynamicComponent from "./components/DynamicComponent";
import { McpServerConfig } from "./services/mcpClient";
import NumberMetric from "./components/NumberMetric";
import TailwindTest from "./components/TailwindTest";
import { AGENT_PREFIX, MCP_SERVER_ICONS, PLANNER_AGENT, SERVER_TOOL_NAME_SEPARATOR } from "./constants";
import { cleanServerName } from "./services/utils";
import { Agent } from "./services/swarm/agent";
import ToolUseCollapsible from "./components/ToolUseCollapsible";

// Extend the Window interface to include our Electron API
declare global {
  interface Window {
    electronAPI: {
      // MCP Client API
      connectMcpClient: (
        serverConfig: {
          command: string;
          args: string[];
          name?: string;
        },
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
      listMcpPrompts: () => Promise<any>;
      getMcpPrompt: (name: string, args: Record<string, any>) => Promise<any>;
      listMcpResources: () => Promise<any>;
      readMcpResource: (uri: string) => Promise<any>;
      callMcpTool: (params: {
        serverName: string;
        name: string;
        arguments: Record<string, any>;
      }) => Promise<any>;

      // AI Agent API
      runSwarm: (
        currentAgentName: string,
        conversationHistory: Array<{
          role: "user" | "assistant";
          content: string;
        }>
      ) => Promise<{
        agentName: string;
        messages: any[];
      }>;
      processAiMessage: (
        message: string,
        conversationHistory: Array<{
          role: "user" | "assistant";
          content: string;
        }>
      ) => Promise<{
        content: string;
        toolCalls?: Array<{ name: string; arguments: Record<string, any> }>;
      }>;
      processToolCalls: (
        toolCalls: Array<{ name: string; arguments: Record<string, any> }>,
        conversationHistory: Array<{
          role: "user" | "assistant";
          content: string;
        }>
      ) => Promise<string>;
      callTools: (
        toolCalls: Array<{ name: string; arguments: Record<string, any> }>
      ) => Promise<Array<{ name: string; response: any }>>;
      transformToolResponse: (
        toolResponses: Array<{ name: string; response: any }>,
        conversationHistory: Array<{
          role: "user" | "assistant";
          content: string;
        }>
      ) => Promise<string>;
      transformToolResponseToAlert: (
        toolResponses: Array<{ name: string; response: any }>,
        conversationHistory: Array<{
          role: "user" | "assistant";
          content: string;
        }>
      ) => Promise<string>;

      // React Component Generator API
      registerReactComponent: (
        componentCode: string,
        componentName: string
      ) => Promise<string>;
      getReactComponent: (name: string) => Promise<{ exists: boolean }>;
      listReactComponents: () => Promise<string[]>;
      removeReactComponent: (name: string) => Promise<{ success: boolean }>;

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
    };
  }
}

const colors = ["#4a90e2", "#50c878", "#f4a261", "#8338ec", "#e76f51"];

// ServerStatusIcon component to display server status with appropriate icon and color
const ServerStatusIcon = ({
  serverName,
  status,
  isAvailableForToolUse,
}: {
  serverName: string;
  status: "connecting" | "connected" | "error";
  isAvailableForToolUse: boolean;
}) => {
  // Get the server icon or use default
  const getServerIcon = () => {
    const serverKey = Object.keys(MCP_SERVER_ICONS).find((key) =>
      serverName.toLowerCase().includes(key.toLowerCase())
    );
    return serverKey
      ? MCP_SERVER_ICONS[serverKey]
      : MCP_SERVER_ICONS["default"];
  };

  // Get status color
  const getStatusColor = () => {
    switch (status) {
      case "connecting":
        return "#f6e05e"; // yellow
      case "connected":
        return "#48bb78"; // green
      case "error":
        return "#f56565"; // red
      default:
        return "#a0aec0"; // gray
    }
  };

  return (
    <div className="flex items-center gap-2 p-2 rounded hover:bg-gray-100">
      <img
        src={getServerIcon()}
        alt={`${serverName} icon`}
        className={`w-6 h-6 object-contain cursor-pointer ${
          isAvailableForToolUse ? "" : "opacity-50"
        }`}
        onError={(e) => {
          (e.target as HTMLImageElement).src = MCP_SERVER_ICONS["default"];
        }}
      />
      <div className="flex-1 text-sm font-medium truncate">{serverName}</div>
      {
        // only show status if server is not connected
        status !== "connected" && (
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: getStatusColor() }}
            title={`Status: ${status}`}
          />
        )
      }
    </div>
  );
};

const ChatBubble = ({ message, toolResultMessage }: { 
  message: { 
    role: "user" | "assistant"; 
    sender: string; 
    type: "text" | "tool_use" | "tool_result" | "agent_transfer"; 
    content: any 
  },
  toolResultMessage?: { 
    role: "user" | "assistant"; 
    sender: string; 
    type: "text" | "tool_use" | "tool_result"; 
    content: any 
  }
}) => {
  // Handle agent transfer messages
  if (message.type === "agent_transfer") {
    return <div className={`p-3 rounded-lg max-w-[80%] break-words whitespace-pre-wrap ${
      message.role === "user" ? "self-end bg-blue-500 text-white" : "self-start bg-gray-100 text-gray-800"
    }`}>
      <pre>{message.content}</pre>
    </div>
  }
  
  if (message.type === "tool_use") {
    if (message.content[0].name.startsWith(AGENT_PREFIX)) {
      return <p className={`p-3 rounded-lg max-w-[80%] break-words whitespace-pre-wrap ${
        message.role === "user" ? "self-end bg-blue-500 text-white" : "self-start bg-gray-100 text-gray-800"
      }`}>Asking {message.content[0].name.split(SERVER_TOOL_NAME_SEPARATOR)[1]}...</p>
    }
    
    // Use the ToolUseCollapsible component for tool calls
    return <ToolUseCollapsible 
      toolCall={message as any} 
      toolResult={toolResultMessage as any}
      isAssistant={message.role === "assistant"} 
    />
  }
  
  // If it's a tool result without a paired tool call, show it directly
  if (message.type === "tool_result" && !toolResultMessage) {
    // if the tool result is from transferring to an agent, don't show it
    if (message.content[0].content.startsWith(AGENT_PREFIX)) {
      return <></>
    }
    return <div className={`p-3 rounded-lg max-w-[80%] break-words whitespace-pre-wrap ${
      message.role === "user" ? "self-end bg-blue-500 text-white" : "self-start bg-gray-100 text-gray-800"
    }`}>
      <div className="text-xs font-medium mb-1 opacity-70">Tool Result:</div>
      <pre className="text-xs bg-gray-200 p-2 rounded overflow-auto max-h-60">
        {JSON.stringify(message.content, null, 2)}
      </pre>
    </div>
  }
  
  // Skip tool results that are paired with tool calls (they're shown in ToolUseCollapsible)
  if (message.type === "tool_result" && toolResultMessage) {
    return <></>;
  }
  
  // user message right and blue, assistant message left and gray
  return <div className={`p-3 rounded-lg max-w-[80%] break-words whitespace-pre-wrap ${
    message.role === "user"
      ? "self-end bg-blue-500 text-white"
      : "self-start bg-gray-100 text-gray-800"
  }`}>
    {typeof message.content === 'string' ? message.content : JSON.stringify(message.content)}
  </div>
}

export default function Home() {
  const [messages, setMessages] = useState<
    Array<{
      role: "user" | "assistant";
      content: any;
      sender: string;
      type: "text" | "tool_use" | "tool_result";
    }>
  >([
    {
      role: "assistant",
      content: "Okay, let's talk about your business",
      sender: "assistant",
      type: "text",
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [mcpConnected, setMcpConnected] = useState(false);
  const [mcpServerPath, setMcpServerPath] = useState("npx");
  const [mcpServerArgs, setMcpServerArgs] = useState("");
  const [currentAgentName, setCurrentAgentName] = useState<string>(PLANNER_AGENT);
  const [availableMcpServers, setAvailableMcpServers] = useState<
    Record<string, any>
  >({});
  const [connectedClients, setConnectedClients] = useState<string[]>([]);
  const [selectedMcpServer, setSelectedMcpServer] = useState<string>("");
  const [customServerMode, setCustomServerMode] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [selectedCard, setSelectedCard] = useState<any>(null);
  const [cardsData, setCardsData] = useState<any[]>([]);
  const [cardsContext, setCardsContext] = useState<Record<number, any>>({});
  const [dashboardQuestions, setDashboardQuestions] = useState<
    Array<{
      id?: number;
      question: string;
      additionalInstructions?: string;
      suggestedTitle?: string;
      suggestedType?: string;
      customColor?: string;
    }>
  >([]);
  const [dashboardAlerts, setDashboardAlerts] = useState<
    Array<{
      title: string;
      type: "NewsAlert";
      caption: string;
      color: string;
      hero: string;
    }>
  >([]);
  const [serverConnectionStatus, setServerConnectionStatus] = useState<
    Record<string, "connecting" | "connected" | "error">
  >({});
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<{
    id?: number;
    question: string;
    additionalInstructions: string;
    suggestedTitle: string;
    suggestedType: string;
    customColor: string;
  } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load dashboard questions when component mounts
  useEffect(() => {
    const loadDashboardQuestions = async () => {
      try {
        const result = await window.electronAPI.getDashboardQuestions();
        if (result.success && result.questions) {
          setDashboardQuestions(result.questions);
        } else {
          console.error("Failed to load dashboard questions:", result.error);
        }
      } catch (error) {
        console.error("Error loading dashboard questions:", error);
      }
    };

    loadDashboardQuestions();
  }, []);

  // Load available MCP servers and connected clients when component mounts
  useEffect(() => {
    loadMcpServers();

    // Set up listener for server connections
    const unsubscribe = window.electronAPI.onServersConnected(() => {
      console.log("Servers connected event received, refreshing client list");
      loadMcpServers();
    });

    // Clean up the listener when the component unmounts
    return () => {
      unsubscribe();
    };
  }, []);

  // Fetch Mixpanel data when connected to MCP
  useEffect(() => {
    const fetchCardsData = async () => {
      if (mcpConnected && dashboardQuestions.length > 0) {
        const results: any[] = [];

        for (const question of dashboardQuestions) {
          const result = await fetchQuestionData(question);
          results.push(result);
        }

        setCardsData(results);
      }
    };

    const fetchAlertData = async () => {
      if (mcpConnected) {
        const result = await askAINoChat(
          "Look at today's top events and flag the best thing demonstrating a business success standing out as a news alert",
          undefined,
          true
        );
        console.log("fetchAlertData result", result);
        const parsedResult = JSON.parse(result);
        const resultBad = await askAINoChat(
          "Look at my credit card transactions in the past week and flag high spending",
          undefined,
          true
        );
        console.log("fetchAlertData resultBad", resultBad);
        const parsedResultBad = JSON.parse(resultBad);
        setDashboardAlerts([parsedResult, parsedResultBad]);
      }
    };

    fetchCardsData();
    fetchAlertData();
  }, [mcpConnected, connectedClients, dashboardQuestions]);

  const loadMcpServers = async () => {
    try {
      // Get available servers from config
      const result = await window.electronAPI.getMcpServers();
      if (result.success && result.servers) {
        console.log("result.servers", result.servers);
        setAvailableMcpServers(result.servers);

        // If there are servers available, select the first one by default
        const serverNames = Object.keys(result.servers);
        if (serverNames.length > 0) {
          setSelectedMcpServer((prev) => prev || serverNames[0]);
        }
      }

      // Get connected clients
      const clientsResult = await window.electronAPI.getConnectedClients();
      if (clientsResult.success && clientsResult.connectedClients) {
        setConnectedClients(clientsResult.connectedClients);

        // Update connection status for all servers
        const newConnectionStatus: Record<
          string,
          "connecting" | "connected" | "error"
        > = {};

        // First, mark all available servers as not connected
        Object.keys(availableMcpServers).forEach((serverName) => {
          newConnectionStatus[serverName] = "error";
        });

        // Then mark connected servers as connected
        clientsResult.connectedClients.forEach((serverName) => {
          newConnectionStatus[serverName] = "connected";
        });

        // Preserve 'connecting' status for servers that are in the process of connecting
        Object.entries(serverConnectionStatus).forEach(
          ([serverName, status]) => {
            if (
              status === "connecting" &&
              !clientsResult.connectedClients.includes(serverName)
            ) {
              newConnectionStatus[serverName] = "connecting";
            }
          }
        );

        setServerConnectionStatus(newConnectionStatus);

        if (clientsResult.connectedClients.length > 0) {
          setMcpConnected(true);
        } else {
          setMcpConnected(false);
        }
      }
    } catch (error) {
      console.error("Failed to load MCP servers:", error);
    }
  };

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const askAINoChat = async (
    message: string,
    questionId?: number,
    alert?: boolean
  ) => {
    const response = await window.electronAPI.processAiMessage(message, []);
    let toolCallsResult: Array<{ name: string; response: any }> | undefined;
    console.log("tool calls", response.toolCalls);
    if (response.toolCalls && response.toolCalls.length > 0) {
      const toolCallsResponse = await window.electronAPI.callTools(
        response.toolCalls
      );
      toolCallsResult = toolCallsResponse;
    }

    const result = response.content + "\n\n" + toolCallsResult;
    console.log("askAINoChat result", result);
    if (questionId) {
      // Update the context with the new data
      setCardsContext((prev) => ({
        ...prev,
        [questionId]: {
          aiResponse: response.content,
          toolCallsResult: toolCallsResult,
        },
      }));
    }

    const transformedResult = alert
      ? await window.electronAPI.transformToolResponseToAlert(toolCallsResult, [
          { role: "user", content: message },
        ])
      : await window.electronAPI.transformToolResponse(toolCallsResult, [
          { role: "user", content: message },
        ]);
    console.log("askAINoChat transformedResult", transformedResult);
    return transformedResult;
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!inputValue.trim()) return;

    // Add user message to chat
    const userMessage = inputValue.trim();
    setMessages((prev) => [
      ...prev,
      { text: userMessage, role: "user", sender: "user", type: "text", content: userMessage },
    ]);
    setInputValue("");
    setIsProcessing(true);

    try {
      // Process message with AI agent
      const conversationHistory = messages.map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      }));

      let modifiedUserMessage = userMessage;
      console.log("selectedCard", selectedCard ?? "no card selected");
      // If a card is selected, include its context in the conversation
      if (selectedCard) {
        const cardContext = cardsContext[selectedCard.id];
        // Add context information to the conversation history
        const contextPrefix = `[Context from "${selectedCard.title}" dashboard card]\n`;
        const aiResponseContext = cardContext.aiResponse
          ? `AI Response: ${cardContext.aiResponse}\n`
          : "";
        const toolCallsContext = cardContext.toolCallsResult
          ? `Tool Calls: ${JSON.stringify(
              cardContext.toolCallsResult,
              null,
              2
            )}\n`
          : "";

        // Add the context to the conversation history as an assistant message
        // conversationHistory.push({
        //   role: "assistant",
        //   content: `${contextPrefix}${aiResponseContext}${toolCallsContext}[End Context]`
        // });
        modifiedUserMessage = `${userMessage}\n\n${contextPrefix}${aiResponseContext}${toolCallsContext}[End Context]`;
        console.log("modifiedUserMessage!!!!: ", modifiedUserMessage);
      }

      // const response = await window.electronAPI.processAiMessage(
      //   modifiedUserMessage,
      //   conversationHistory
      // );

      // // Add AI response to chat
      // setMessages((prev) => [
      //   ...prev,
      //   { text: response.content, sender: "assistant", type: "text" },
      // ]);

      // // Process any tool calls
      // if (response.toolCalls && response.toolCalls.length > 0) {
      //   const toolCallsResult = await window.electronAPI.processToolCalls(
      //     response.toolCalls,
      //     [
      //       ...conversationHistory,
      //       { role: "assistant", content: response.content },
      //     ]
      //   );

      //   setMessages((prev) => [
      //     ...prev,
      //     { text: toolCallsResult, sender: "assistant", type: "tool_result" },
      //   ]);
      // }
      const role: "user" | "assistant" = "user";
      const messagesToProcess = [
        ...conversationHistory,
        { role, content: modifiedUserMessage },
      ];
      const swarmResponse = await window.electronAPI.runSwarm(
        currentAgentName,
        messagesToProcess
      );
      console.log("swarmResponse", swarmResponse);
      setMessages(swarmResponse.messages.map((message) => ({
        role: message.role,
        sender: message.sender,
        type: message.type,
        content: message.content,
      })));
      setCurrentAgentName(swarmResponse.agentName);
    } catch (error) {
      console.error("Error processing message:", error);
      setMessages((prev) => [
        ...prev,
        {
          text: `Error: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
          role: "assistant",
          sender: "assistant",
          type: "text",
          content: error instanceof Error ? error.message : "Unknown error",
        },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConnectMcp = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsProcessing(true);
    let serverConfig: any;
    let serverName = "";

    try {
      if (customServerMode) {
        // Use custom server configuration
        const args = mcpServerArgs.trim() ? mcpServerArgs.split(" ") : [];
        serverConfig = {
          command: mcpServerPath,
          args,
          name: "custom-server",
        };
        serverName = "custom-server";
      } else if (selectedMcpServer && availableMcpServers[selectedMcpServer]) {
        // Use selected server from config
        serverConfig = availableMcpServers[selectedMcpServer];
        serverName = selectedMcpServer;
      } else {
        throw new Error("No MCP server selected");
      }

      // Set server status to connecting
      setServerConnectionStatus((prev) => ({
        ...prev,
        [serverName]: "connecting",
      }));

      const result = await window.electronAPI.connectMcpClient(
        serverConfig,
        serverName
      );

      if (result.success) {
        setMcpConnected(true);

        // Update server status to connected
        setServerConnectionStatus((prev) => ({
          ...prev,
          [serverName]: "connected",
        }));

        setMessages((prev) => [
          ...prev,
          {
            text: `Successfully connected to MCP server: ${
              serverName || serverConfig.name || "Custom server"
            }`,
            role: "assistant",
            sender: "assistant",
            type: "text",
            content: `Successfully connected to MCP server: ${
              serverName || serverConfig.name || "Custom server"
            }`,
          },
        ]);

        // Refresh the server list and connected clients
        await loadMcpServers();
      } else {
        // Update server status to error
        setServerConnectionStatus((prev) => ({
          ...prev,
          [serverName]: "error",
        }));

        setMessages((prev) => [
          ...prev,
          {
            text: `Failed to connect to MCP server: ${
              result.error || "Unknown error"
            }`,
            role: "assistant",
            sender: "assistant",
            type: "text",
            content: `Failed to connect to MCP server: ${
              result.error || "Unknown error"
            }`,
          },
        ]);
      }
    } catch (error) {
      console.error("Error connecting to MCP server:", error);

      // Update server status to error
      if (serverName) {
        setServerConnectionStatus((prev) => ({
          ...prev,
          [serverName]: "error",
        }));
      }

      setMessages((prev) => [
        ...prev,
        {
          text: `Error connecting to MCP server: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
          role: "assistant",
          sender: "assistant",
          type: "text",
          content: `Error connecting to MCP server: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDisconnectMcp = async (serverName?: string) => {
    setIsProcessing(true);
    try {
      const result = await window.electronAPI.disconnectMcpClient(serverName);
      if (result.success) {
        // If disconnecting a specific server
        if (serverName) {
          setMessages((prev) => [
            ...prev,
            {
              text: `Disconnected from MCP server: ${serverName}`,
              role: "assistant",
              sender: "assistant",
              type: "text",
              content: `Disconnected from MCP server: ${serverName}`,
            },
          ]);
        } else {
          // Disconnecting all servers
          setMessages((prev) => [
            ...prev,
            {
              text: "Disconnected from all MCP servers",
              role: "assistant",
              sender: "assistant",
              type: "text",
              content: "Disconnected from all MCP servers",
            },
          ]);
        }

        // Refresh the server list and connected clients
        await loadMcpServers();
      } else {
        setMessages((prev) => [
          ...prev,
          {
            text: `Failed to disconnect from MCP server: ${
              result.error || "Unknown error"
            }`,
            role: "assistant",
            sender: "assistant",
            type: "text",
            content: `Failed to disconnect from MCP server: ${
              result.error || "Unknown error"
            }`,
          },
        ]);
      }
    } catch (error) {
      console.error("Error disconnecting from MCP server:", error);
      setMessages((prev) => [
        ...prev,
        {
          text: `Error disconnecting from MCP server: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
          role: "assistant",
          sender: "assistant",
          type: "text",
          content: `Error disconnecting from MCP server: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddQuestion = async () => {
    setEditingQuestion({
      question: "",
      additionalInstructions: "",
      suggestedTitle: "",
      suggestedType: "NumberMetric",
      customColor: "#4a90e2",
    });
    setShowQuestionModal(true);
  };

  const handleEditQuestion = (id: number) => {
    const question = dashboardQuestions.find((q) => q.id === id);
    if (question) {
      setEditingQuestion({
        id: question.id,
        question: question.question,
        additionalInstructions: question.additionalInstructions || "",
        suggestedTitle: question.suggestedTitle || "",
        suggestedType: question.suggestedType || "NumberMetric",
        customColor: question.customColor || "#4a90e2",
      });
      setShowQuestionModal(true);
    }
  };

  const handleDeleteQuestion = async (id: number) => {
    if (window.confirm("Are you sure you want to delete this question?")) {
      try {
        const result = await window.electronAPI.deleteDashboardQuestion(id);
        if (result.success) {
          // Refresh questions list
          const questionsResult =
            await window.electronAPI.getDashboardQuestions();
          if (questionsResult.success) {
            setDashboardQuestions(questionsResult.questions);
            // Remove the card from the cards data
            setCardsData((prev) => prev.filter((card) => card.id !== id));
          }
        } else {
          console.error("Failed to delete question:", result.error);
        }
      } catch (error) {
        console.error("Error deleting question:", error);
      }
    }
  };

  // Fetch data for a specific question
  const fetchQuestionData = async (question: {
    id?: number;
    question: string;
    additionalInstructions?: string;
    suggestedTitle?: string;
    suggestedType?: string;
    customColor?: string;
  }) => {
    if (!mcpConnected) return null;

    try {
      // Process the question
      const result = await askAINoChat(
        `${question.question} ${
          question.additionalInstructions
            ? `(${question.additionalInstructions})`
            : ""
        }`,
        question.id
      );

      try {
        const parsedResult = JSON.parse(result);
        return {
          ...question,
          ...parsedResult,
          id: question.id,
          color: question.customColor || "#4a90e2",
        };
      } catch (e) {
        console.error("Error parsing result:", e);
        return {
          id: question.id,
          title: question.suggestedTitle || "Dashboard Metric",
          type: question.suggestedType || "NumberMetric",
          color: question.customColor || "#4a90e2",
          value: "Error",
          caption: "Failed to parse result",
        };
      }
    } catch (error) {
      console.error(`Error processing question "${question.question}":`, error);
      return {
        id: question.id,
        title: question.suggestedTitle || "Dashboard Metric",
        type: question.suggestedType || "NumberMetric",
        color: question.customColor || "#4a90e2",
        value: "Error",
        caption: `Failed to process: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  };

  const handleSaveQuestion = async () => {
    if (!editingQuestion) return;

    try {
      let result;
      if (editingQuestion.id) {
        // Update existing question
        result = await window.electronAPI.updateDashboardQuestion(
          editingQuestion.id,
          {
            question: editingQuestion.question,
            additionalInstructions: editingQuestion.additionalInstructions,
            suggestedTitle: editingQuestion.suggestedTitle,
            suggestedType: editingQuestion.suggestedType,
            customColor: editingQuestion.customColor,
          }
        );
      } else {
        // Add new question
        result = await window.electronAPI.addDashboardQuestion({
          question: editingQuestion.question,
          additionalInstructions: editingQuestion.additionalInstructions,
          suggestedTitle: editingQuestion.suggestedTitle,
          suggestedType: editingQuestion.suggestedType,
          customColor: editingQuestion.customColor,
        });
      }

      if (result.success) {
        // Refresh questions list
        const questionsResult =
          await window.electronAPI.getDashboardQuestions();
        if (questionsResult.success) {
          setDashboardQuestions(questionsResult.questions);

          if (editingQuestion.id) {
            // For an edited question, update the card with the new metadata
            // and mark it as refreshing
            setCardsData((prev) =>
              prev.map((card) =>
                card.id === editingQuestion.id
                  ? {
                      ...card,
                      title:
                        editingQuestion.suggestedTitle || "Dashboard Metric",
                      type: editingQuestion.suggestedType || "NumberMetric",
                      color: editingQuestion.customColor || "#4a90e2",
                      value: "Refreshing...",
                      caption: "Updating data...",
                    }
                  : card
              )
            );

            // Find the updated question in the questions list
            const updatedQuestion = questionsResult.questions.find(
              (q) => q.id === editingQuestion.id
            );
            if (updatedQuestion) {
              // Fetch fresh data for the updated question
              const questionData = await fetchQuestionData(updatedQuestion);
              if (questionData) {
                // Update the card with the fetched data
                setCardsData((prev) =>
                  prev.map((card) =>
                    card.id === editingQuestion.id ? questionData : card
                  )
                );
              }
            }
          } else if (result.question) {
            // For a new question, add a temporary placeholder card and fetch data immediately
            const newQuestion = result.question;

            // Add a temporary placeholder
            setCardsData((prev) => [
              ...prev,
              {
                id: newQuestion.id,
                title: newQuestion.suggestedTitle || "Dashboard Metric",
                type: newQuestion.suggestedType || "NumberMetric",
                color: newQuestion.customColor || "#4a90e2",
                value: "Loading...",
                caption: "Fetching data...",
              },
            ]);

            // Fetch data for the new question
            const questionData = await fetchQuestionData(newQuestion);
            if (questionData) {
              // Update the card with the fetched data
              setCardsData((prev) =>
                prev.map((card) =>
                  card.id === newQuestion.id ? questionData : card
                )
              );
            }
          }
        }
        setShowQuestionModal(false);
        setEditingQuestion(null);
      } else {
        console.error("Failed to save question:", result.error);
      }
    } catch (error) {
      console.error("Error saving question:", error);
    }
  };

  // Function to pair tool calls with their results
  const getPairedMessages = (messages: Array<any>) => {
    const pairedMessages: Array<{
      message: any;
      toolResultMessage?: any;
    }> = [];
    
    for (let i = 0; i < messages.length; i++) {
      const currentMessage = messages[i];
      
      // Check for agent transfer sequence (text + tool_use with agent prefix + tool_result with agent prefix)
      if (i < messages.length - 2 && 
          currentMessage.type === "text" && 
          messages[i+1].type === "tool_use" && 
          messages[i+1].content[0]?.name?.startsWith(AGENT_PREFIX) &&
          messages[i+2].type === "tool_result" && 
          typeof messages[i+2].content[0]?.content === 'string' &&
          messages[i+2].content[0]?.content?.startsWith(AGENT_PREFIX)) {
        
        // Get the agent name from the tool call
        const agentFullName = messages[i+1].content[0].name.split(SERVER_TOOL_NAME_SEPARATOR)[1] || "unknown";
        // Convert from snake_case to readable format
        const agentName = agentFullName
          .split('_')
          .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
        
        // Create a collapsed message
        pairedMessages.push({
          message: {
            ...currentMessage,
            content: `Asking ${agentName}...`,
            text: `Asking ${agentName}...`,
            type: "agent_transfer"
          }
        });
        
        // Skip the next two messages since we've collapsed them
        i += 2;
      }
      // If this is a tool_use message, check if the next message is its result
      else if (currentMessage.type === "tool_use") {
        const nextMessage = i < messages.length - 1 ? messages[i + 1] : null;
        
        if (nextMessage?.type === "tool_result") {
          // Add the pair and skip the next message (it will be included with this one)
          pairedMessages.push({
            message: currentMessage,
            toolResultMessage: nextMessage
          });
          i++; // Skip the next message since we've paired it
        } else {
          // No result yet, just add the tool call
          pairedMessages.push({
            message: currentMessage
          });
        }
      } else if (currentMessage.type !== "tool_result" || 
                (currentMessage.type === "tool_result" && 
                 (i === 0 || messages[i-1].type !== "tool_use"))) {
        // Add regular messages or unpaired tool results
        pairedMessages.push({
          message: currentMessage
        });
      }
      // Skip tool_result messages that follow tool_use (they're handled in the tool_use case)
    }
    
    return pairedMessages;
  };

  return (
    <div className="flex h-[100vh] w-full overflow-hidden">
      <div className={`sidebar ${sidebarExpanded ? "expanded" : "collapsed"}`}>
        <div className="sidebar-header">
          <h2>MCP Servers</h2>
          <button
            className="toggle-sidebar-button"
            onClick={() => setSidebarExpanded(!sidebarExpanded)}
            aria-label={sidebarExpanded ? "Collapse sidebar" : "Expand sidebar"}
          >
            {sidebarExpanded ? "←" : "+"}
          </button>
        </div>

        {/* Only render the content when sidebar is expanded */}
        {sidebarExpanded ? (
          <>
            {/* Connected Servers List */}
            <div className="server-list">
              <div className="server-list-header">
                <h3>Connected Servers</h3>
                <button
                  className="refresh-button"
                  onClick={loadMcpServers}
                  disabled={isProcessing}
                >
                  Refresh
                </button>
              </div>
              {connectedClients.length > 0 ? (
                connectedClients.map((name) => (
                  <div key={name} className={`flex flex-col`}>
                    <ServerStatusIcon
                      serverName={name}
                      status={serverConnectionStatus[name] || "connected"}
                      isAvailableForToolUse={
                        serverConnectionStatus[name] === "connected" && true
                      }
                    />
                    <div className="flex flex-row w-full justify-end">
                      <button
                        onClick={() => handleDisconnectMcp(name)}
                        disabled={isProcessing}
                        className="server-action-button disconnect"
                      >
                        Disconnect
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="no-servers">No connected servers</div>
              )}
            </div>

            {/* Connect to Server Form */}
            {false && (
              <form onSubmit={handleConnectMcp}>
                <div className="form-group">
                  <label>Custom Server</label>
                </div>

                <>
                  <div className="form-group">
                    <label>Command:</label>
                    <input
                      type="text"
                      value={mcpServerPath}
                      onChange={(e) => setMcpServerPath(e.target.value)}
                      disabled={isProcessing}
                    />
                  </div>
                  <div className="form-group">
                    <label>Arguments:</label>
                    <input
                      type="text"
                      value={mcpServerArgs}
                      onChange={(e) => setMcpServerArgs(e.target.value)}
                      disabled={isProcessing}
                      placeholder="Space-separated arguments"
                    />
                  </div>
                </>
              </form>
            )}
          </>
        ) : (
          <div className="flex flex-col gap-2 p-2">
            {Object.keys(availableMcpServers).map((serverName) => (
              <div key={serverName} className="flex justify-center">
                <div
                  className="w-8 h-8 relative flex items-center justify-center"
                  title={`${serverName}`}
                  onClick={() => {
                    console.log("clicked", serverName);
                  }}
                >
                  <img
                    src={(() => {
                      const serverKey = Object.keys(MCP_SERVER_ICONS).find(
                        (key) =>
                          cleanServerName(serverName)
                            .toLowerCase()
                            .includes(key.toLowerCase())
                      );
                      return serverKey
                        ? MCP_SERVER_ICONS[serverKey]
                        : MCP_SERVER_ICONS["default"];
                    })()}
                    alt={serverName}
                    className={`w-6 h-6 object-contain ${
                      serverConnectionStatus[cleanServerName(serverName)] !==
                      "connected"
                        ? "opacity-10"
                        : ""
                    }`}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        MCP_SERVER_ICONS["default"];
                    }}
                  />
                  {serverConnectionStatus[cleanServerName(serverName)] !==
                    "connected" && (
                    <div
                      className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-white"
                      style={{
                        backgroundColor:
                          serverConnectionStatus[
                            cleanServerName(serverName)
                          ] === "connecting"
                            ? "#f6e05e"
                            : "#f56565",
                      }}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-1/2 flex flex-col bg-white transition-width duration-300 border-r border-gray-200">
          <div className="flex-1 p-5 overflow-y-auto flex flex-col gap-3">
            {getPairedMessages(messages).map((item, index) => (
              <ChatBubble 
                key={index} 
                message={item.message} 
                toolResultMessage={item.toolResultMessage} 
              />
            ))}
            <div ref={messagesEndRef} />
          </div>

          <form
            onSubmit={handleSendMessage}
            className="flex flex-col p-4 border-t border-gray-200 bg-gray-50"
          >
            {selectedCard && (
              <div className="flex items-center mb-2">
                <div
                  className="px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1"
                  style={{
                    backgroundColor: `${selectedCard.color}22`,
                    color: selectedCard.color,
                    border: `1px solid ${selectedCard.color}`,
                  }}
                >
                  <span>@{selectedCard.title}</span>
                  <button
                    className="ml-1 text-xs hover:bg-gray-200 rounded-full h-5 w-5 flex items-center justify-center"
                    onClick={(e) => {
                      e.preventDefault();
                      setSelectedCard(null);
                    }}
                    title="Clear context"
                  >
                    ×
                  </button>
                </div>
              </div>
            )}
            <div className="flex">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Type your message..."
                disabled={isProcessing || !mcpConnected}
                className="flex-1 p-2.5 border border-gray-200 rounded mr-2 text-sm"
              />
              <button
                type="submit"
                disabled={isProcessing || !inputValue.trim() || !mcpConnected}
                className="px-5 py-2.5 bg-blue-500 text-white border-none rounded cursor-pointer font-medium disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-blue-600"
              >
                Send
              </button>
            </div>
          </form>
        </div>

        <div className="w-1/2 flex flex-col bg-white overflow-hidden">
          <div className="flex flex-col m-4 rounded-md shadow-md">
            <div className="p-3 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
              <h3 className="m-0 text-base text-gray-800 font-semibold">
                Recent Activity
              </h3>
            </div>
            <div className="flex flex-col gap-2 p-4 ">
              {dashboardAlerts.map((alert) => (
                <div key={alert.title} className="flex flex-col gap-2">
                  <div className="flex flex-row gap-2">
                    <h3
                      className={`text-xl font-semibold`}
                      style={{ color: alert.color }}
                    >
                      {alert.hero}
                    </h3>
                    <h4 className="text-lg font-semibold">{alert.title}</h4>
                  </div>
                  <p>{alert.caption}</p>
                </div>
              ))}
            </div>
          </div>

          {selectedCard !== null ? (
            <div className="flex flex-col h-full overflow-hidden bg-white rounded-lg shadow-md m-5">
              <div
                className="flex justify-between items-center p-4 bg-gray-100 border-b border-gray-200"
                style={{
                  borderTop: `4px solid ${
                    selectedCard?.color ||
                    colors[
                      cardsData.findIndex(
                        (card) => card.id === selectedCard.id
                      ) % colors.length
                    ]
                  }`,
                  background: `linear-gradient(to bottom, ${
                    selectedCard?.color ||
                    colors[
                      cardsData.findIndex(
                        (card) => card.id === selectedCard.id
                      ) % colors.length
                    ]
                  }22, #f5f5f5)`,
                }}
              >
                <h3 className="m-0 text-lg text-gray-800 font-semibold">
                  {selectedCard?.title || ""}
                </h3>
                <div className="flex gap-2">
                  <button
                    className="bg-red-500 text-white border-none rounded w-8 h-8 flex items-center justify-center cursor-pointer text-xl font-bold hover:bg-red-600"
                    onClick={() => setSelectedCard(null)}
                    aria-label="Close zoomed card"
                  >
                    ×
                  </button>
                </div>
              </div>
              <div className="p-4 flex-1 overflow-auto">
                {selectedCard?.type === "NumberMetric" && (
                  <NumberMetric
                    value={selectedCard?.value}
                    caption={selectedCard?.caption}
                  />
                )}
              </div>
              <div className="flex flex-col gap-2 px-4 pb-4">
                <div className="flex flex-col w-full gap-2">
                  <h3>Question</h3>
                  <input
                    value={selectedCard?.question}
                    placeholder="Question"
                    className="w-full p-2 border border-gray-200 rounded"
                    onChange={(e) => {
                      setSelectedCard({
                        ...selectedCard,
                        question: e.target.value,
                      });
                      setEditingQuestion({
                        ...editingQuestion,
                        question: e.target.value,
                      });
                    }}
                  />
                </div>
                <div className="flex flex-col w-full gap-2">
                  <h3>Additional Instructions</h3>
                  <textarea
                    value={selectedCard?.additionalInstructions}
                    placeholder="Additional Instructions"
                    className="w-full p-2 border border-gray-200 rounded"
                    onChange={(e) => {
                      setSelectedCard({
                        ...selectedCard,
                        additionalInstructions: e.target.value,
                      });
                      setEditingQuestion({
                        ...editingQuestion,
                        additionalInstructions: e.target.value,
                      });
                    }}
                  />
                </div>
                <div className="flex flex-row w-full justify-end">
                  <button
                    className="bg-blue-500 text-white border-none rounded w-8 h-8 flex items-center justify-center cursor-pointer text-sm font-bold hover:bg-blue-600"
                    onClick={() => handleSaveQuestion()}
                    aria-label="Save question"
                  >
                    💾
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-5 p-5 overflow-y-auto h-full">
                {cardsData.map((card, index) => (
                  <div
                    key={card.id || index}
                    className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow hover:shadow-md hover:-translate-y-1 transition-all cursor-pointer flex flex-col h-48"
                    onClick={() => {
                      setSelectedCard(card);
                      setEditingQuestion(card);
                    }}
                    style={{
                      borderTop: `4px solid ${
                        card.color || colors[index % colors.length]
                      }`,
                    }}
                  >
                    <div className="p-3 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                      <h3 className="m-0 text-base text-gray-800 font-semibold">
                        {card.title || ""}
                      </h3>
                    </div>
                    <div className="p-4 flex-1 overflow-hidden flex items-center justify-center text-center text-gray-600 text-sm leading-normal whitespace-pre-wrap">
                      {mcpConnected && card.type === "NumberMetric" && (
                        <NumberMetric
                          value={card.value}
                          caption={card.caption}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="w-full px-4">
                <button
                  onClick={handleAddQuestion}
                  className="px-3 w-full py-1 bg-blue-500 text-white border-none rounded cursor-pointer font-medium hover:bg-blue-600"
                  disabled={!mcpConnected}
                >
                  +
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Question Modal */}
      {showQuestionModal && editingQuestion && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg">
            <h2 className="text-xl font-semibold mb-4">
              {editingQuestion.id ? "Edit Question" : "Add Question"}
            </h2>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Question
              </label>
              <input
                type="text"
                value={editingQuestion.question}
                onChange={(e) =>
                  setEditingQuestion({
                    ...editingQuestion,
                    question: e.target.value,
                  })
                }
                className="w-full p-2 border border-gray-300 rounded"
                placeholder="e.g., How many daily active users do I have?"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Additional Instructions
              </label>
              <textarea
                value={editingQuestion.additionalInstructions}
                onChange={(e) =>
                  setEditingQuestion({
                    ...editingQuestion,
                    additionalInstructions: e.target.value,
                  })
                }
                className="w-full p-2 border border-gray-300 rounded h-24"
                placeholder="e.g., Use the Mixpanel API to get data from yesterday and today"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Display Title
              </label>
              <input
                type="text"
                value={editingQuestion.suggestedTitle}
                onChange={(e) =>
                  setEditingQuestion({
                    ...editingQuestion,
                    suggestedTitle: e.target.value,
                  })
                }
                className="w-full p-2 border border-gray-300 rounded"
                placeholder="e.g., DAU"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Component Type
              </label>
              <select
                value={editingQuestion.suggestedType}
                onChange={(e) =>
                  setEditingQuestion({
                    ...editingQuestion,
                    suggestedType: e.target.value,
                  })
                }
                className="w-full p-2 border border-gray-300 rounded"
              >
                <option value="NumberMetric">Number Metric</option>
                {/* Add more component types as needed */}
              </select>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Color
              </label>
              <input
                type="color"
                value={editingQuestion.customColor}
                onChange={(e) =>
                  setEditingQuestion({
                    ...editingQuestion,
                    customColor: e.target.value,
                  })
                }
                className="w-full p-1 border border-gray-300 rounded h-10"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowQuestionModal(false);
                  setEditingQuestion(null);
                }}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveQuestion}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                disabled={!editingQuestion.question.trim()}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
