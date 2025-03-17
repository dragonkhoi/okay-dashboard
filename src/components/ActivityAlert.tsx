import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./Dialog";
import ToolUseCollapsible from "./ToolUseCollapsible";
import { SERVER_TOOL_NAME_SEPARATOR } from "../constants";
import { Input } from "./Input";
import { useState } from "react";
import { Button } from "./Button";
export type ActivityAlertType = {
  id: number;
  title: string;
  type: string;
  caption: string;
  color: string;
  hero: string;
};

interface ActivityAlertProps {
  isRefreshingDashboard: boolean;
  alertConfig: {
    id?: number;
    question: string;
    additionalInstructions?: string;
    suggestedType?: "NewsAlert";
    customColor?: string
  };
  alert: ActivityAlertType;
  alertsContext: Record<
    number,
    {
      aiResponse: string;
      toolCalls: Array<{ name: string; arguments: Record<string, any> }>;
      toolCallsResult: Array<{ name: string; response: any }>;
    }
  >;
  refreshRecentActivity: () => Promise<void>;
}

const ActivityAlert = ({ isRefreshingDashboard, alertConfig, alert, alertsContext, refreshRecentActivity }: ActivityAlertProps) => {
  const [question, setQuestion] = useState(alertConfig.question);
  const [additionalInstructions, setAdditionalInstructions] = useState(alertConfig.additionalInstructions);
  const [open, setOpen] = useState(false);
  return (
    <div
      key={alert.title}
      className="flex flex-col gap-2 border-b border-gray-200 p-4"
    >
      <div className="flex flex-row justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex flex-row gap-2">
            <h3
              className={`text-xl font-semibold`}
              style={{ color: alert.color }}
            >
              { isRefreshingDashboard ? "⏳" : alert.hero}
            </h3>
            <h4 className="text-lg font-semibold">{ isRefreshingDashboard ? "Refreshing..." : alert.title}</h4>
          </div>
          <p>{ isRefreshingDashboard ? "..." : alert.caption}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <button className="text-gray-500">🔽</button>
          </DialogTrigger>
          <DialogContent>
          <DialogHeader>
            <DialogTitle>{ isRefreshingDashboard ? "Refreshing..." : alert.title}</DialogTitle>
            <DialogDescription>{ isRefreshingDashboard ? "..." : alert.caption}</DialogDescription>
          </DialogHeader>
            <div className="flex flex-col gap-2">
              {alertConfig.question && (
                <div className="mb-3">
                  <div className="text-xs font-medium mb-1 opacity-70">Question:</div>
                  <Input className="text-sm p-3 bg-gray-50 rounded border border-gray-200 mb-2" value={question} onChange={(e) => setQuestion(e.target.value)} />
                  <div className="text-xs font-medium mb-1 opacity-70">Additional Instructions:</div>
                  <Input className="text-sm p-3 bg-gray-50 rounded border border-gray-200 mb-2" value={additionalInstructions} onChange={(e) => setAdditionalInstructions(e.target.value)} />
                  <Button variant="secondary" className="w-full" onClick={async () => {
                    await window.electronAPI.updateDashboardAlert(alertConfig.id, {
                      question,
                      additionalInstructions,
                    });
                    await refreshRecentActivity();
                    setOpen(false);   
                  }}>Save</Button>
                </div>
              )}
              
              {alertsContext[alert.id] && alertsContext[alert.id].aiResponse && (
                <div className="mb-3">
                  <div className="text-xs font-medium mb-1 opacity-70">AI Response:</div>
                  <div className="text-sm p-3 bg-gray-50 rounded border border-gray-200">
                    {alertsContext[alert.id].aiResponse}
                  </div>
                </div>
              )}
              
              {alertsContext[alert.id] && alertsContext[alert.id].toolCalls && 
               alertsContext[alert.id].toolCalls.length > 0 && (
                <div className="flex flex-col gap-2">
                  <div className="text-xs font-medium mb-1 opacity-70">Tool Usage:</div>
                  {alertsContext[alert.id].toolCalls.map((toolCall, index) => {
                    // Extract server name and tool name
                    const toolName = toolCall.name || "";
                    // Check if the tool name already contains the separator
                    const hasServerPrefix = toolName.includes(SERVER_TOOL_NAME_SEPARATOR);
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
                          alertsContext[alert.id].toolCallsResult &&
                          alertsContext[alert.id].toolCallsResult[index]
                            ? {
                                type: "tool_result",
                                content: [
                                  {
                                    content: JSON.stringify(
                                      alertsContext[alert.id].toolCallsResult[index].response || {}
                                    ),
                                  },
                                ],
                              }
                            : undefined
                        }
                        isAssistant={true}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default ActivityAlert;
