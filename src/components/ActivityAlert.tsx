export type ActivityAlert = {
  title: string;
  type: string;
  caption: string;
  color: string;
  hero: string;
};

interface ActivityAlertProps {
  alert: ActivityAlert;
}

const ActivityAlert = ({ alert }: ActivityAlertProps) => {
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
            {alert.hero}
          </h3>
          <h4 className="text-lg font-semibold">{alert.title}</h4>
        </div>
        <p>{alert.caption}</p>
        </div>
        <button className="text-gray-500">🔽</button>
      </div>
    </div>
  );
};

export default ActivityAlert;
