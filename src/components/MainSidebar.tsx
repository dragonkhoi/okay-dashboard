import { cleanServerName } from "../services/utils";
import { McpServerConfig } from "../services/mcpClient";
import ServerManager from "./ServerManager";
import { MCP_SERVER_ICONS } from "../constants";
import { Button } from "./Button";
import { Cog6ToothIcon, PlusIcon } from "@heroicons/react/24/solid";
import { SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "./Sheet";
import { Sheet } from "./Sheet";
import { Label } from "./Label";
import { Input } from "./Input";
import SettingsSheet from "./SettingsSheet";

interface MainSidebarProps {
  availableMcpServers: Record<string, McpServerConfig>;
  connectedClients: string[];
  serverConnectionStatus: Record<string, "connecting" | "connected" | "error">;
}
const MainSidebar: React.FC<MainSidebarProps> = ({
  availableMcpServers,
  connectedClients,
  serverConnectionStatus,
}) => {
  return (
    <div className="flex flex-col justify-between h-full items-center">
      <div className="flex flex-col gap-2 p-2">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" className="max-w-9">
              <PlusIcon />
            </Button>
          </SheetTrigger>
          <SheetContent side="left">
            <SheetHeader>
              <SheetTitle>Manage Connections</SheetTitle>
            </SheetHeader>
            <ServerManager
              connectedClients={connectedClients}
              serverConnectionStatus={serverConnectionStatus}
            />
          </SheetContent>
        </Sheet>
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
                  const serverKey = Object.keys(MCP_SERVER_ICONS).find((key) =>
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
                      serverConnectionStatus[cleanServerName(serverName)] ===
                      "connecting"
                        ? "#f6e05e"
                        : "#f56565",
                  }}
                />
              )}
            </div>
          </div>
        ))}
      </div>
      <SettingsSheet />
    </div>
  );
};

export default MainSidebar;
