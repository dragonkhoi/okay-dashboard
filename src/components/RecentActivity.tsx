import ActivityAlert from "./ActivityAlert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./Tabs";

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
  alerts: Array<{
    title: string;
    type: "NewsAlert";
    caption: string;
    color: string;
    hero: string;
  }>;
};
interface RecentActivityProps {
  activity: RecentActivityBlock;
}

const RecentActivity: React.FC<RecentActivityProps> = ({ activity }) => {
  return (
    <div className="flex flex-col m-4 rounded-md shadow-md">
      <div className="p-3 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
        <h3 className="m-0 text-base text-gray-800 font-semibold">
          Recent Activity
        </h3>
      </div>
      <Tabs defaultValue="email" className="w-[400px]">
        <TabsList>
          <TabsTrigger value="email">
            Email
          </TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
        </TabsList>
        <TabsContent value="email">
          Make changes to your account here.
        </TabsContent>
        <TabsContent value="calendar">Change your password here.</TabsContent>
      </Tabs>

      <div className="flex flex-col gap-2">
        {activity.alerts.map((alert) => (
          <ActivityAlert key={alert.title} alert={alert} />
        ))}
      </div>
    </div>
  );
};

export default RecentActivity;
