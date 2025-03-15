import ActivityAlert from "./ActivityAlert";
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
      {/* <div className="p-3 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
        <h3 className="m-0 text-base text-gray-800 font-semibold">
          Recent Activity
        </h3>
      </div> */}
      <Tabs defaultValue="alerts" className="w-full rounded-br-none rounded-bl-none">
        <TabsList className="w-full flex py-1">
          <TabsTrigger value="alerts" className="flex-1">
            <BellAlertIcon className="size-6" />
          </TabsTrigger>
          <TabsTrigger value="email" className="flex-1">
            <EnvelopeIcon className="size-6" />
          </TabsTrigger>
          <TabsTrigger value="calendar" className="flex-1">
            <CalendarIcon className="size-6" />
          </TabsTrigger>
        </TabsList>
        <TabsContent value="alerts">
          <div className="flex flex-col gap-2">
            {activity.alerts.map((alert) => (
              <ActivityAlert key={alert.title} alert={alert} />
            ))}
          </div>
        </TabsContent>
        <TabsContent value="email">
          <div className="flex flex-col gap-2">
            {activity.emails.map((email) => (
              <div key={email.subject}>{email.subject}</div>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="calendar">Calendar</TabsContent>
      </Tabs>
    </div>
  );
};

export default RecentActivity;
