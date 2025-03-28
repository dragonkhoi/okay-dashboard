import React, { useState, useEffect, useRef, useCallback } from "react";
import "./home.css";
import DynamicComponent from "./components/DynamicComponent";
import { McpServerConfig } from "./services/mcpClient";
import NumberMetric from "./components/NumberMetric";
import TailwindTest from "./components/TailwindTest";
import {
  AGENT_PREFIX,
  MCP_SERVER_ICONS,
  PLANNER_AGENT,
  SERVER_TOOL_NAME_SEPARATOR,
} from "./constants";
import { cleanServerName, filterMessageContent, parseLinksInContent } from "./services/utils";
import { Agent } from "./services/swarm/agent";
import ToolUseCollapsible from "./components/ToolUseCollapsible";
import RecentActivity from "./components/RecentActivity";
import ServerManager from "./components/ServerManager";
import MainSidebar from "./components/MainSidebar";
import { Button } from "./components/Button";

const colors = ["#4a90e2", "#50c878", "#f4a261", "#8338ec", "#e76f51"];

const ChatBubble = ({
  message,
  toolResultMessage,
}: {
  message: {
    role: "user" | "assistant";
    sender: string;
    type: "text" | "tool_use" | "tool_result" | "agent_transfer";
    content: any;
  };
  toolResultMessage?: {
    role: "user" | "assistant";
    sender: string;
    type: "text" | "tool_use" | "tool_result";
    content: any;
  };
}) => {
  // Handle agent transfer messages
  if (message.type === "agent_transfer") {
    return (
      <div
        className={`p-3 rounded-lg max-w-[80%] break-words whitespace-pre-wrap ${
          message.role === "user"
            ? "self-end bg-blue-500 text-white"
            : "self-start bg-gray-100 text-gray-800"
        }`}
      >
        <pre>{parseLinksInContent(filterMessageContent(message.content))}</pre>
      </div>
    );
  }

  if (message.type === "tool_use") {
    if (message.content[0].name.startsWith(AGENT_PREFIX)) {
      return (
        <p
          className={`p-3 rounded-lg max-w-[80%] break-words text-sm whitespace-pre-wrap ${
            message.role === "user"
              ? "self-end bg-blue-500 text-white"
              : "self-start bg-gray-100 text-gray-800"
          }`}
        >
          Asking {message.content[0].name.split(SERVER_TOOL_NAME_SEPARATOR)[1]}
          ...
        </p>
      );
    }

    // Use the ToolUseCollapsible component for tool calls
    return (
      <ToolUseCollapsible
        toolCall={message as any}
        toolResult={toolResultMessage as any}
        isAssistant={message.role === "assistant"}
      />
    );
  }

  // If it's a tool result without a paired tool call, show it directly
  if (message.type === "tool_result" && !toolResultMessage) {
    // if the tool result is from transferring to an agent, don't show it
    if (message.content[0].content.startsWith(AGENT_PREFIX)) {
      return <></>;
    }
    return (
      <div
        className={`p-3 rounded-lg max-w-[80%] break-words whitespace-pre-wrap ${
          message.role === "user"
            ? "self-end bg-blue-500 text-white"
            : "self-start bg-gray-100 text-gray-800"
        }`}
      >
        <div className="text-xs font-medium mb-1 opacity-70">Tool Result:</div>
        <pre className="text-xs bg-gray-200 p-2 rounded overflow-auto max-h-60">
          {(() => {
            try {
              const content = JSON.stringify(message.content, null, 2);
              // Check if the content might contain links
              if (content.includes('http') || content.includes('file:') || content.includes(':/')) {
                return parseLinksInContent(content);
              }
              return content;
            } catch (e) {
              return JSON.stringify(message.content);
            }
          })()}
        </pre>
      </div>
    );
  }

  // Skip tool results that are paired with tool calls (they're shown in ToolUseCollapsible)
  if (message.type === "tool_result" && toolResultMessage) {
    return <></>;
  }

  // user message right and blue, assistant message left and gray
  return (
    <div
      className={`p-3 rounded-lg max-w-[80%] break-words whitespace-pre-wrap ${
        message.role === "user"
          ? "self-end bg-blue-500 text-white"
          : "self-start bg-gray-100 text-gray-800"
      }`}
    >
      {typeof message.content === "string"
        ? parseLinksInContent(filterMessageContent(message.content))
        : JSON.stringify(message.content)}
    </div>
  );
};

export default function Home() {
  const [messages, setMessages] = useState<
    Array<{
      role: "user" | "assistant";
      content: any;
      sender: string;
      type: "text" | "tool_use" | "tool_result";
      wasStreamed?: boolean;
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
  const [currentAgentName, setCurrentAgentName] =
    useState<string>(PLANNER_AGENT);
  const [connectedClients, setConnectedClients] = useState<string[]>([]);
  const [selectedCard, setSelectedCard] = useState<any>(null);
  const [cardsData, setCardsData] = useState<any[]>([]);
  const [alertsData, setAlertsData] = useState<any[]>([]);
  const [cardsContext, setCardsContext] = useState<
    Record<
      number,
      {
        aiResponse: string;
        toolCalls: Array<{ name: string; arguments: Record<string, any> }>;
        toolCallsResult: Array<{ name: string; response: any }>;
      }
    >
  >({});
  const [alertsContext, setAlertsContext] = useState<
    Record<
      number,
      {
        aiResponse: string;
        toolCalls: Array<{ name: string; arguments: Record<string, any> }>;
        toolCallsResult: Array<{ name: string; response: any }>;
      }
    >
  >({});
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
      id?: number;
      question: string;
      additionalInstructions?: string;
      suggestedType?: "NewsAlert";
      customColor?: string;
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
  const [isRefreshingDashboard, setIsRefreshingDashboard] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const refreshRecentActivity = useCallback(async () => {
    setIsRefreshingDashboard(true);
    const result = await window.electronAPI.getDashboardConfig();
    if (result.success && result.config) {
      setDashboardQuestions(result.config.questions);
      setDashboardAlerts(result.config.alerts);
    } else {
      console.error("Failed to load dashboard config:", result.error);
    }
  }, []);

  const askAINoChat = useCallback(
    async (message: string, questionId?: number, alert?: boolean) => {
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
        if (!alert) {
          // Update the context with the new data
          setCardsContext((prev) => ({
            ...prev,
            [questionId]: {
              aiResponse: response.content,
              toolCalls: response.toolCalls
                ? response.toolCalls.map((toolCall) => {
                    return {
                      name: toolCall.name,
                      arguments: toolCall.arguments,
                    };
                  })
                : [],
              toolCallsResult: toolCallsResult,
            },
          }));
        } else if (alert) {
          // Update the context with the new data
          setAlertsContext((prev) => ({
            ...prev,
            [questionId]: {
              aiResponse: response.content,
              toolCalls: response.toolCalls
                ? response.toolCalls.map((toolCall) => {
                    return {
                      name: toolCall.name,
                      arguments: toolCall.arguments,
                    };
                  })
                : [],
              toolCallsResult: toolCallsResult,
            },
          }));

          console.log("updating alertsContext", questionId);
        }
      }

      const transformedResult = alert
        ? await window.electronAPI.transformToolResponseToAlert(
            toolCallsResult,
            [{ role: "user", content: message }]
          )
        : await window.electronAPI.transformToolResponse(toolCallsResult, [
            { role: "user", content: message },
          ]);
      console.log("askAINoChat transformedResult", transformedResult);
      setIsRefreshingDashboard(false);
      return transformedResult;
    },
    []
  );

  const fetchAlertData = useCallback(
    async (alert: {
      id?: number;
      suggestedType?: "NewsAlert";
      color?: string;
      question: string;
      additionalInstructions?: string;
    }) => {
      if (!mcpConnected) {
        return {
          id: alert.id,
          title: "No connections",
          type: alert.suggestedType || "NewsAlert",
          caption: `Add new connections in top left`,
          color: alert.color || "#4a90e2",
          hero: "🔌",
        };
      }
      // Process the alert
      const result = await askAINoChat(
        `${alert.question} ${alert.additionalInstructions}`,
        alert.id,
        true
      );
      try {
        const parsedResult = JSON.parse(result);
        return {
          ...alert,
          ...parsedResult,
          id: alert.id,
        };
      } catch (error) {
        console.error(`Error processing alert "${alert.question}":`, error);
        return {
          id: alert.id,
          title: alert.question,
          type: alert.suggestedType || "NewsAlert",
          caption: alert.additionalInstructions || "",
          color: alert.color || "#4a90e2",
          hero: "🚨",
        };
      }
    },
    [askAINoChat, mcpConnected]
  );

  // Fetch data for a specific question
  const fetchQuestionData = useCallback(
    async (question: {
      id?: number;
      question: string;
      additionalInstructions?: string;
      suggestedTitle?: string;
      suggestedType?: string;
      customColor?: string;
    }) => {
      if (!mcpConnected)
        return {
          id: question.id,
          title: "No connections",
          type: question.suggestedType || "NumberMetric",
          color: question.customColor || "#4a90e2",
          value: "Error",
          caption: `Add new connections in top left`,
        };

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
        console.error(
          `Error processing question "${question.question}":`,
          error
        );
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
    },
    [askAINoChat, mcpConnected]
  );

  // Load dashboard questions when component mounts
  useEffect(() => {
    const loadDashboardQuestions = async () => {
      try {
        refreshRecentActivity();
      } catch (error) {
        console.error("Error loading dashboard questions:", error);
      }
    };

    loadDashboardQuestions();
  }, [refreshRecentActivity]);

  // Load available MCP servers and connected clients when component mounts
  useEffect(() => {
    console.log("Setting up MCP servers and event listeners");
    loadMcpServers();

    // Set up listener for server connections
    const unsubscribe = window.electronAPI.onServersConnected(() => {
      console.log("Servers connected event received, refreshing client list");
      loadMcpServers();
    });

    // Clean up the listener when the component unmounts
    return () => {
      console.log("Cleaning up server connection event listener");
      unsubscribe();
    };
  }, []);

  // Fetch Mixpanel data when connected to MCP
  useEffect(() => {
    const fetchCardsData = async (dummy = false) => {
      // START DUMMY DATA
      if (dummy) {
        setCardsData([
          {
            id: 1,
            title: "Dashboard Card 1",
            value: 100,
            caption: "This is a caption",
            type: "NumberMetric",
          },
          {
            id: 2,
            title: "Dashboard Card 2",
            value: "$200",
            caption: "This is a caption",
            type: "NumberMetric",
          },
        ]);
        return;
      }
      // END DUMMY DATA
      if (dashboardQuestions.length > 0) {
        const results = await Promise.all(
          dashboardQuestions.map((question) => fetchQuestionData(question))
        );
        setCardsData(results);
      }
    };

    const fetchAlertsData = async (dummy = false) => {
      if (dashboardAlerts.length > 0) {
        const results = dummy
          ? // START DUMMY DATA
            dashboardAlerts.map((alert) => {
              return {
                question: "What is the news?",
                id: 1,
                title: "Dashboard Alert 1",
                type: "NewsAlert",
                caption: "This is a news alert",
                color: "#000000",
                hero: "🚨",
              };
            })
          : // END DUMMY DATA

            await Promise.all(
              dashboardAlerts.map((alert) => fetchAlertData(alert))
            );
        console.log("fetchAlertsData results", results);
        setAlertsData(results);
      }
    };

    fetchCardsData(false);
    fetchAlertsData(false);
  }, [
    mcpConnected,
    connectedClients,
    dashboardQuestions,
    dashboardAlerts,
    fetchAlertData,
    fetchQuestionData,
  ]);

  const loadMcpServers = async () => {
    try {
      // Get connected clients
      const clientsResult = await window.electronAPI.getConnectedClients();
      if (clientsResult.success && clientsResult.connectedClients) {
        setConnectedClients(clientsResult.connectedClients);

        // Update connection status for all servers
        const newConnectionStatus: Record<
          string,
          "connecting" | "connected" | "error"
        > = {};

        // First, initialize all servers as not connected
        const allServerNames = [...Object.keys(serverConnectionStatus), ...clientsResult.connectedClients];
        allServerNames.forEach((serverName) => {
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

        console.log("Updated server connection status:", newConnectionStatus);
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

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!inputValue.trim()) return;

    // Add user message to chat
    const userMessage = inputValue.trim();
    setMessages((prev) => [
      ...prev,
      {
        text: userMessage,
        role: "user",
        sender: "user",
        type: "text",
        content: userMessage,
      },
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

      if (connectedClients.length === 0) {
        modifiedUserMessage = `${modifiedUserMessage}\n\nBy the way, I have not connected to any external tools or MCP servers yet, so you should tell me to connect to them first by saying "Check out the top left plus button to add new connections so I can access your business tools."`;
      }
      const role: "user" | "assistant" = "user";
      const messagesToProcess = [
        ...conversationHistory,
        { role, content: modifiedUserMessage },
      ];

      // Use streaming for better user experience
      const response = await window.electronAPI.runSwarm(
        currentAgentName,
        messagesToProcess,
        true // Enable streaming
      );

      // Check if we got a streamId for event-based streaming
      if (response && response.streamId) {
        // Create a temporary message for streaming content
        let streamingMessage: any = null;
        let isStreaming = false;
        let isComplete = false;

        // Set up event listeners for stream chunks
        const unsubscribeChunk = window.electronAPI.onStreamChunk(
          response.streamId,
          (chunk) => {
            // Skip processing if already complete
            if (isComplete) return;

            // Handle delimiter chunks that mark start/end of streaming
            if ("delim" in chunk) {
              if (chunk.delim === "start") {
                isStreaming = true;
                // Add a placeholder message for streaming content
                setMessages((prev) => {
                  const newMessages = [...prev];
                  streamingMessage = {
                    role: "assistant",
                    sender: currentAgentName,
                    type: "text",
                    content: "",
                    wasStreamed: true,
                  };
                  return [...newMessages, streamingMessage];
                });
              } else if (chunk.delim === "end") {
                console.log("RECEIVED END DELIM");
                isStreaming = false;
                // If we received an 'end' delimiter but no final response yet,
                // mark the streaming as complete to prevent further processing
                // if (!isComplete) {
                //   isComplete = true;

                //   // Clean up event listeners
                //   unsubscribeChunk();
                //   unsubscribeDone();

                //   // Reset processing state
                //   setIsProcessing(false);
                // }
              }
              return;
            }

            // Handle error chunks
            if ("error" in chunk) {
              setMessages((prev) => {
                const newMessages = [...prev];
                newMessages.push({
                  role: "assistant",
                  sender: currentAgentName,
                  type: "text",
                  content: `Error: ${chunk.error}`,
                });
                return newMessages;
              });
              // Mark as complete to prevent further processing
              isComplete = true;

              // Clean up event listeners
              unsubscribeChunk();
              unsubscribeDone();

              // Reset processing state
              setIsProcessing(false);
              return;
            }

            // Handle the final response object
            if ("response" in chunk) {
              // Update with the complete conversation
              const finalResponse = chunk.response;
              setMessages((prev) => {
                // Add all the messages from the final response
                return [
                  ...finalResponse.messages.map((message: any) => ({
                    role: message.role,
                    sender: message.sender,
                    type: message.type,
                    content: message.content,
                  })),
                ];
              });

              setCurrentAgentName(
                finalResponse.agentName || currentAgentName
              );
              // Mark as complete to prevent further processing
              isComplete = true;

              // Clean up event listeners
              unsubscribeChunk();
              unsubscribeDone();

              // Reset processing state
              setIsProcessing(false);
              return;
            }

            // Handle streaming content chunks
            if (isStreaming && !isComplete) {
              if (chunk.type === "text") {
                // Only process if there's actual content
                if (chunk.content) {
                  // Update the streaming message with new content
                  setMessages((prev) => {
                    const newMessages = [...prev];
                    const lastIndex = newMessages.length - 1;

                    // If the last message is from the assistant and is text, append to it
                    if (
                      lastIndex >= 0 &&
                      newMessages[lastIndex].role === "assistant" &&
                      newMessages[lastIndex].type === "text"
                    ) {
                      newMessages[lastIndex].content += chunk.content;
                    } else {
                      // Create a new message
                      newMessages.push({
                        role: "assistant",
                        sender: chunk.sender || currentAgentName,
                        type: "text",
                        content: chunk.content,
                        wasStreamed: true,
                      });
                    }

                    return newMessages;
                  });
                }
              } else if (chunk.type === "tool_use") {
                // Handle tool use messages
                setMessages((prev) => {
                  const newMessages = [...prev];

                  // Add the tool use message
                  newMessages.push({
                    role: "assistant",
                    sender: chunk.sender || currentAgentName,
                    type: "tool_use",
                    content: chunk.content,
                    wasStreamed: true,
                  });

                  return newMessages;
                });
              } else if (chunk.type === "tool_result") {
                // Handle tool result messages
                setMessages((prev) => {
                  const newMessages = [...prev];

                  console.log(
                    "RECEIVED TOOL RESULT",
                    JSON.stringify(chunk, null, 2)
                  );

                  // Add the tool result message
                  newMessages.push({
                    role: chunk.role || "user",
                    sender: chunk.sender || currentAgentName,
                    type: "tool_result",
                    content: chunk.content,
                    wasStreamed: true,
                  });

                  return newMessages;
                });
              }
            }
          }
        );

        // Set up event listener for stream completion
        const unsubscribeDone = window.electronAPI.onStreamDone(
          response.streamId,
          () => {
            // Mark as complete
            isComplete = true;

            // Clean up event listeners
            unsubscribeChunk();
            unsubscribeDone();

            // Ensure processing state is reset
            setIsProcessing(false);
          }
        );
      } else {
        // Fallback to non-streaming response
        console.log("Non-streaming response received:", response);
        if (response && response.messages) {
          setMessages(
            response.messages.map((message: any) => ({
              role: message.role,
              sender: message.sender,
              type: message.type,
              content: message.content,
            }))
          );
          setCurrentAgentName(response.agentName);
        }
        setIsProcessing(false);
      }
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
          const questionsResult = await window.electronAPI.getDashboardConfig();
          if (questionsResult.success) {
            setDashboardQuestions(questionsResult.config.questions);
            setDashboardAlerts(questionsResult.config.alerts);
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
      if (
        i < messages.length - 2 &&
        currentMessage.type === "text" &&
        messages[i + 1].type === "tool_use" &&
        messages[i + 1].content[0]?.name?.startsWith(AGENT_PREFIX) &&
        messages[i + 2].type === "tool_result" &&
        typeof messages[i + 2].content[0]?.content === "string" &&
        messages[i + 2].content[0]?.content?.startsWith(AGENT_PREFIX)
      ) {
        // Get the agent name from the tool call
        const agentFullName =
          messages[i + 1].content[0].name.split(
            SERVER_TOOL_NAME_SEPARATOR
          )[1] || "unknown";
        // Convert from snake_case to readable format
        const agentName = agentFullName
          .split("_")
          .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ");

        // Create a collapsed message
        pairedMessages.push({
          message: {
            ...currentMessage,
            content: `Asking ${agentName}...`,
            text: `Asking ${agentName}...`,
            type: "agent_transfer",
          },
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
            toolResultMessage: nextMessage,
          });
          i++; // Skip the next message since we've paired it
        } else {
          // No result yet, just add the tool call
          pairedMessages.push({
            message: currentMessage,
          });
        }
      } else if (
        currentMessage.type !== "tool_result" ||
        (currentMessage.type === "tool_result" &&
          (i === 0 || messages[i - 1].type !== "tool_use"))
      ) {
        // Add regular messages or unpaired tool results
        pairedMessages.push({
          message: currentMessage,
        });
      }
      // Skip tool_result messages that follow tool_use (they're handled in the tool_use case)
    }

    return pairedMessages;
  };

  return (
    <div className="flex h-[100vh] w-full overflow-hidden">
      <div className={`sidebar collapsed`}>
        <MainSidebar
          connectedClients={connectedClients}
          serverConnectionStatus={serverConnectionStatus}
        />
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
                  <Button
                    variant="ghost"
                    className="ml-1 text-xs hover:bg-gray-200 rounded-full h-5 w-5 flex items-center justify-center"
                    onClick={(e) => {
                      e.preventDefault();
                      setSelectedCard(null);
                    }}
                    title="Clear context"
                  >
                    ×
                  </Button>
                </div>
              </div>
            )}
            <div className="flex">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Type your message..."
                disabled={isProcessing}
                className="flex-1 p-2.5 border border-gray-200 rounded mr-2 text-sm"
              />
              <Button
                type="submit"
                disabled={isProcessing || !inputValue.trim()}
                className="px-5 py-2.5 bg-blue-500 text-white border-none rounded cursor-pointer font-medium disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-blue-600"
              >
                Send
              </Button>
            </div>
          </form>
        </div>

        <div className="w-1/2 flex flex-col bg-white overflow-hidden">
          <RecentActivity
            isRefreshingDashboard={isRefreshingDashboard}
            activity={{
              alertConfigs: dashboardAlerts,
              emails: [],
              calendarEvents: [],
              alerts: alertsData,
            }}
            alertsContext={alertsContext}
            refreshRecentActivity={refreshRecentActivity}
          />

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
                  <Button
                    variant="ghost"
                    className="bg-red-500 text-white border-none rounded w-8 h-8 flex items-center justify-center cursor-pointer text-xl font-bold hover:bg-red-600"
                    onClick={() => setSelectedCard(null)}
                    aria-label="Close zoomed card"
                  >
                    ×
                  </Button>
                </div>
              </div>
              <div className="px-4 flex-1 overflow-auto">
                {selectedCard?.type === "NumberMetric" && (
                  <NumberMetric
                    value={selectedCard?.value}
                    caption={selectedCard?.caption}
                  />
                )}
              </div>
              <div className="flex flex-col gap-2 px-4 pb-4 overflow-auto">
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
                <div className="px-4">
                  {selectedCard?.id &&
                    cardsContext[selectedCard.id]?.toolCalls &&
                    cardsContext[selectedCard.id].toolCalls.length > 0 && (
                      <div className="flex flex-col gap-2">
                        <h3>Tool Usage</h3>
                        {cardsContext[selectedCard.id].toolCalls.map(
                          (toolCall: any, index: number) => {
                            // Extract server name and tool name
                            const toolName = toolCall.name || "";
                            // Check if the tool name already contains the separator
                            const hasServerPrefix = toolName.includes(
                              SERVER_TOOL_NAME_SEPARATOR
                            );
                            // If it doesn't have a server prefix, add a default one
                            const fullToolName = hasServerPrefix
                              ? toolName
                              : `default${SERVER_TOOL_NAME_SEPARATOR}${toolName}`;

                            return (
                              <ToolUseCollapsible
                                key={index}
                                toolCall={{
                                  type: "tool_use",
                                  content: [
                                    {
                                      name: fullToolName,
                                      content: "",
                                      input: toolCall.arguments || {},
                                    },
                                  ],
                                }}
                                toolResult={
                                  cardsContext[selectedCard.id]
                                    .toolCallsResult &&
                                  cardsContext[selectedCard.id].toolCallsResult[
                                    index
                                  ]
                                    ? {
                                        type: "tool_result",
                                        content: [
                                          {
                                            content: JSON.stringify(
                                              cardsContext[selectedCard.id]
                                                .toolCallsResult[index]
                                                .response || {}
                                            ),
                                          },
                                        ],
                                      }
                                    : undefined
                                }
                                isAssistant={true}
                              />
                            );
                          }
                        )}
                      </div>
                    )}
                </div>
                <div className="flex flex-row w-full justify-end">
                  <Button
                    variant="secondary"
                    className="flex items-center justify-center cursor-pointer text-sm font-bold"
                    onClick={() => handleSaveQuestion()}
                    aria-label="Save question"
                  >
                    💾
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4 p-4 overflow-y-auto h-full">
                {cardsData.map((card, index) => (
                  <div
                    key={card.id || index}
                    className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow hover:shadow-md hover:-translate-y-1 transition-all cursor-pointer flex flex-col max-h-48"
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
                {cardsData.length === 0 && (
                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow hover:shadow-md hover:-translate-y-1 transition-all cursor-pointer flex flex-col h-48">
                    <div className="p-3 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                      <h3 className="m-0 text-base text-gray-800 font-semibold">
                        No metrics, add a metric to start building your
                        dashboard
                      </h3>
                    </div>
                  </div>
                )}
              </div>
              <div className="w-full px-4">
                <Button
                  variant="secondary"
                  onClick={handleAddQuestion}
                  className="px-3 w-full py-1 font-medium"
                  disabled={!mcpConnected}
                >
                  New Metric +
                </Button>
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
              <Button
                variant="secondary"
                onClick={() => {
                  setShowQuestionModal(false);
                  setEditingQuestion(null);
                }}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveQuestion}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                disabled={!editingQuestion.question.trim()}
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
