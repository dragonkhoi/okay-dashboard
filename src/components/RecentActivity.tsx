import { useState } from "react";
import ActivityAlert, { ActivityAlertType } from "./ActivityAlert";
import { Button } from "./Button";
import { DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "./Dialog";
import { Dialog } from "./Dialog";
import { Input } from "./Input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./Tabs";
import { EnvelopeIcon, CalendarIcon, BellAlertIcon } from "@heroicons/react/24/solid";
export type RecentActivityBlock = {
  emails: Array<{
    subject: string;
    from: string;
    to: string;
    date: string;
    body: string;
    summary: string;
    type: "personal" | "automated" | "calendar_invite_received";
  }>;
  calendarEvents: Array<{
    title: string;
    start: string;
    end: string;
    location: string;
  }>;
  alerts: ActivityAlertType[];
  alertConfigs: {
    id?: number;
    question: string;
    additionalInstructions?: string;
    suggestedType?: "NewsAlert";
    customColor?: string
  }[];
};
interface RecentActivityProps {
  isRefreshingDashboard: boolean;
  activity: RecentActivityBlock;
  refreshRecentActivity: () => Promise<void>;
  alertsContext: Record<number, {
    aiResponse: string;
    toolCalls: Array<{ name: string; arguments: Record<string, any> }>;
    toolCallsResult: Array<{ name: string; response: any }>;
  }>;
}

const RecentActivity: React.FC<RecentActivityProps> = ({ isRefreshingDashboard, activity, refreshRecentActivity, alertsContext }) => {
  const [alertQuestion, setAlertQuestion] = useState("");
  const [alertAdditionalInstructions, setAlertAdditionalInstructions] = useState("");
  const [isCreatingAlert, setIsCreatingAlert] = useState(false);
  
  const handleCreateAlert = async () => {
    if (isCreatingAlert) return; // Prevent multiple calls
    
    try {
      setIsCreatingAlert(true);
      console.log("create alert");
      await window.electronAPI.addDashboardAlert({
        question: alertQuestion,
        additionalInstructions: alertAdditionalInstructions,
      });
      
      // Clear the form
      setAlertQuestion("");
      setAlertAdditionalInstructions("");
      
      // Refresh data
      await refreshRecentActivity();
    } catch (error) {
      console.error("Error creating alert:", error);
    } finally {
      setIsCreatingAlert(false);
    }
  }

  return (
    <div className="flex flex-col m-4 rounded-md shadow-md">
      <Tabs defaultValue="alerts" className="w-full rounded-br-none rounded-bl-none">
        <TabsList className="w-full flex py-1">
          <TabsTrigger value="alerts" className="flex-1">
            <BellAlertIcon className="size-6" />
          </TabsTrigger>
          {/* <TabsTrigger value="email" className="flex-1">
            <EnvelopeIcon className="size-6" />
          </TabsTrigger>
          <TabsTrigger value="calendar" className="flex-1">
            <CalendarIcon className="size-6" />
          </TabsTrigger> */}
        </TabsList>
        <TabsContent value="alerts">
          <div className="flex flex-col gap-2">
            {activity.alerts.map((alert, index) => (
                <ActivityAlert key={index} isRefreshingDashboard={isRefreshingDashboard} alertConfig={activity.alertConfigs[index]} alert={alert} alertsContext={alertsContext} refreshRecentActivity={refreshRecentActivity} />
            ))}
            {activity.alerts.length === 0 && (
              <div className="text-center text-gray-500">No alerts, add an alert to start building your activity feed</div>
            )}
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="secondary" className="w-full">New Alert{' '}+</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogTitle>Create New Alert</DialogTitle>
                <DialogDescription>
                  Add an alert to your dashboard
                </DialogDescription>
                <div className="flex flex-col gap-2">
                  <div className="text-sm text-gray-500">Question</div>
                  <Input type="text" placeholder="Look at my analytics events and highlight any spikes or drops" value={alertQuestion} onChange={(e) => setAlertQuestion(e.target.value)} />
                  <div className="text-sm text-gray-500">Additional Instructions</div>
                  <Input type="text" placeholder="Check Mixpanel for 'get today's events'" value={alertAdditionalInstructions} onChange={(e) => setAlertAdditionalInstructions(e.target.value)} />
                  <Button 
                    onClick={handleCreateAlert} 
                    disabled={isCreatingAlert || !alertQuestion.trim()}
                  >
                    {isCreatingAlert ? "Creating..." : "Create Alert"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </TabsContent>
        {/* <TabsContent value="email">
          <div className="flex flex-col gap-2">
            {activity.emails.map((email) => (
              <div key={email.subject}>{email.subject}</div>
            ))}
            {activity.emails.length === 0 && (
              <div className="text-center text-gray-500 text-sm px-8 text-pretty">Email not connected, add Email Connection to get started</div>
            )}
          </div>
        </TabsContent>
        <TabsContent value="calendar">

        </TabsContent> */}
      </Tabs>
    </div>
  );
};

export default RecentActivity;
