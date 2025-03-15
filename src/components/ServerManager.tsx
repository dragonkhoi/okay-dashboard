import {
  cleanServerName,
  snakeCaseToCapitalizedReadable,
} from "../services/utils";
import { MCP_SERVER_DATA, MCP_SERVER_ICONS } from "../constants";
import { McpServerConfig } from "../services/mcpClient";
import { Button } from "./Button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./Dialog";
import { Label } from "./Label";
import { Input } from "./Input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./Select";
import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./Tabs";
import { ArrowLeftIcon } from "@heroicons/react/24/solid";
import { ExternalLinkIcon } from "lucide-react";

interface ServerManagerProps {
  connectedClients: string[];
  serverConnectionStatus: Record<string, "connecting" | "connected" | "error">;
}

type ServerInfo = {
  name: string;
  icon: string;
  key: string;
  type: "command" | "sse";
  command?: string;
  args?: string[];
  configArgNames?: Record<string, string>;
  sse?: string;
  requiresCustomSSE?: boolean;
  installInstructions?: string;
  infoUrl?: string;
  githubUrl?: string;
  env?: Record<string, string>;
  relevantAgents?: string[];
};

const ServerManager: React.FC<ServerManagerProps> = ({
  connectedClients,
  serverConnectionStatus,
}) => {
  const [selectedType, setSelectedType] = useState<"command" | "sse">(
    "command"
  );
  const [verifiedOrCustom, setVerifiedOrCustom] = useState<
    "verified" | "custom"
  >("verified");
  const [availableServers, setAvailableServers] = useState<ServerInfo[]>([]);
  const [serverConfig, setServerConfig] = useState<Partial<McpServerConfig>>(
    {}
  );

  // VERIFIED SERVER CONFIG
  const [selectedServer, setSelectedServer] = useState<ServerInfo | null>(null);
  const [verifiedUniqueSSEUrl, setVerifiedUniqueSSEUrl] = useState<string>("");
  const [configArgs, setConfigArgs] = useState<Record<string, string> | null>(
    {}
  );
  const [env, setEnv] = useState<Record<string, string> | null>(null);

  // CUSTOM SERVER CONFIG
  const [command, setCommand] = useState<string>("");
  const [envString, setEnvString] = useState<string>("");
  const [customSSEUrl, setCustomSSEUrl] = useState<string>("");
  const [inputtedServerName, setInputtedServerName] = useState<string>("");

  useEffect(() => {
    const servers = MCP_SERVER_DATA.map((server) => ({
      name: server.name,
      icon: MCP_SERVER_ICONS[server.key],
      key: server.key,
      type: server.type as "command" | "sse",
      command: server.command,
      sse: server.sse,
      args: server.args,
      env: server.env,
      configArgNames: server.configArgNames,
      requiresCustomSSE: server.requiresCustomSSE,
      installInstructions: server.installInstructions,
      infoUrl: server.infoUrl,
      githubUrl: server.githubUrl,
      relevantAgents: server.relevantAgents,
    }));
    setAvailableServers(servers);
  }, []);

  const handleConnect = () => {
    if (verifiedOrCustom === "verified") {
      console.log("SELECTED VERIFIED SERVER");
      if (selectedServer) {
        console.log("SELECTED SERVER", selectedServer);
        if (selectedServer.type === "command") {
          console.log("SELECTED SERVER TYPE", selectedServer.type);
          if (selectedServer.env) {
            console.log("SELECTED SERVER ENV", selectedServer.env);
            // check if all env keys are present
            const serverConfigEnvKeys = Object.keys(selectedServer.env);
            const inputtedEnvKeys = Object.keys(env);
            const allEnvKeysPresent = serverConfigEnvKeys.every((key) =>
              inputtedEnvKeys.includes(key)
            );
            if (!allEnvKeysPresent) {
              console.log(
                "ENV KEYS NOT PRESENT",
                serverConfigEnvKeys,
                inputtedEnvKeys
              );
              alert("Please fill in all environment variables");
            }
            const envConstruction: Record<string, string> = {};
            // Loop through each env key and replace the <ARG> tags with the env values
            for (let i = 0; i < serverConfigEnvKeys.length; i++) {
              let replacedString = selectedServer.env[serverConfigEnvKeys[i]];
              for (let j = 0; j < inputtedEnvKeys.length; j++) {
                if (
                  replacedString.includes(`<ARG><${inputtedEnvKeys[j]}></ARG>`)
                ) {
                  replacedString = replacedString.replace(
                    `<ARG><${inputtedEnvKeys[j]}></ARG>`,
                    env[inputtedEnvKeys[j]]
                  );
                }
              }
              envConstruction[serverConfigEnvKeys[i]] = replacedString;
            }
            serverConfig.env = envConstruction;
          }
          if (selectedServer.args) {
            if (selectedServer.configArgNames) {
              // check if all config arg names are present
              const serverConfigArgumentKeys = Object.keys(
                selectedServer.configArgNames
              );
              const inputtedArgKeys = Object.keys(configArgs);
              const allArgKeysPresent = serverConfigArgumentKeys.every((key) =>
                inputtedArgKeys.includes(key)
              );
              if (!allArgKeysPresent) {
                alert("Please fill in all config arguments");
              }
              const argConstruction = [];
              // Loop through each arg and replace the <ARG> tags with the config arg values
              for (let i = 0; i < selectedServer.args.length; i++) {
                let replacedString = selectedServer.args[i];
                for (let j = 0; j < inputtedArgKeys.length; j++) {
                  if (
                    replacedString.includes(
                      `<ARG><${inputtedArgKeys[j]}></ARG>`
                    )
                  ) {
                    replacedString = replacedString.replace(
                      `<ARG><${inputtedArgKeys[j]}></ARG>`,
                      configArgs[inputtedArgKeys[j]]
                    );
                  }
                }
                argConstruction.push(replacedString);
              }
              serverConfig.args = argConstruction;
            } else {
              serverConfig.args = selectedServer.args;
            }
          }

          serverConfig.command = selectedServer.command;
        }
        if (selectedServer.type === "sse") {
          if (selectedServer.requiresCustomSSE) {
            if (!verifiedUniqueSSEUrl) {
              alert("Please fill in your unique SSE URL");
            }
            serverConfig.sse = verifiedUniqueSSEUrl;
          } else {
            serverConfig.sse = selectedServer.sse;
          }
        }
        serverConfig.relevantAgents = selectedServer.relevantAgents;
      }
    } else if (verifiedOrCustom === "custom") {
      if (selectedType === "command") {
        serverConfig.command = command.split(" ")[0];
        serverConfig.args = command.split(" ").slice(1);
        if (envString) {
          try {
            serverConfig.env = JSON.parse(envString || "{}");
          } catch (error) {
            alert("Invalid JSON for environment variables");
          }
        }
      } else if (selectedType === "sse") {
        serverConfig.sse = customSSEUrl;
      }
    }

    console.log("SERVER CONFIG", serverConfig);
    // save to config file using IPC
    const serverName = cleanServerName(
      selectedServer?.name ||
        inputtedServerName ||
        "newmcp" +
          Date.now().toString().split("").reverse().join("").slice(0, 10)
    );

    // Use type assertion to access the electronAPI methods
    const api = window.electronAPI as any;
    api
      .loadMcpServersConfig()
      .then(
        (config: { mcpServers: Record<string, McpServerConfig> } | null) => {
          if (config) {
            let i = 1;
            let uniqueServerName = serverName;
            while (config.mcpServers[uniqueServerName]) {
              uniqueServerName = `${serverName}_${i}`;
              i++;
            }
            config.mcpServers[uniqueServerName] = serverConfig;
            api.saveMcpServersConfig(config);
            alert("Server added successfully");
            // Connect to new client
            window.electronAPI.connectMcpClient(serverConfig, uniqueServerName);
          }
        }
      );
  };

  return (
    <div>
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" className="my-2">Add Connection +</Button>
        </DialogTrigger>
        <DialogContent className="max-h-[calc(100vh-100px)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Connection</DialogTitle>
          </DialogHeader>
          {selectedServer ? (
            <div>
              {selectedServer && (
                <Button
                  className="w-full mb-4"
                  variant="outline"
                  onClick={() => {
                    setSelectedServer(null);
                    setConfigArgs({});
                    setServerConfig({});
                  }}
                >
                  Back <ArrowLeftIcon className="size-4" />
                </Button>
              )}
              <div className="flex flex-row items-center gap-1">
                <div className="flex items-center justify-center w-6 h-6">
                  <img
                    src={selectedServer.icon}
                    alt={selectedServer.name}
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
                <div className="text-xl font-bold">{selectedServer.name}</div>
              </div>
              <div className="text-sm text-gray-500 my-2">
                {selectedServer.installInstructions}
              </div>
              {selectedServer.configArgNames && (
                <div>
                  {Object.entries(selectedServer.configArgNames).map(
                    ([key, arg]) => (
                      <div key={key}>
                        <Label>{key}</Label>
                        <Input
                          placeholder={arg}
                          value={configArgs?.[key]}
                          onChange={(e) =>
                            setConfigArgs({
                              ...configArgs,
                              [key]: e.target.value,
                            })
                          }
                        />
                      </div>
                    )
                  )}
                </div>
              )}
              {selectedServer.env && (
                <div>
                  {Object.keys(selectedServer.env).map((key) => (
                    <div key={key}>
                      <Label>{snakeCaseToCapitalizedReadable(key)}</Label>
                      <Input
                        placeholder={"XXXXXXXXX"}
                        value={env?.[key]}
                        onChange={(e) =>
                          setEnv({ ...env, [key]: e.target.value })
                        }
                      />
                    </div>
                  ))}
                </div>
              )}
              {selectedServer.requiresCustomSSE && (
                <div>
                  {selectedServer.sse.includes("composio.dev/") && (
                    <div className="flex flex-row gap-2 items-center">
                      <Label>1.</Label>
                      <Button
                        variant="secondary"
                        className="w-full my-2"
                        onClick={() => {
                          if (selectedServer.infoUrl) {
                            window.electronAPI.openExternalLink(
                              selectedServer.infoUrl
                            );
                          }
                        }}
                      >
                        Get your custom URL from Composio{" "}
                        <ExternalLinkIcon className="size-4" />
                      </Button>
                    </div>
                  )}
                  <div className="flex flex-row gap-2 items-center">
                    {selectedServer.sse.includes("composio.dev/") && (
                      <Label>2.</Label>
                    )}
                    <Input
                      placeholder="https://mcp.composio.dev/gmail/"
                      value={verifiedUniqueSSEUrl}
                      onChange={(e) => setVerifiedUniqueSSEUrl(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Tabs
              defaultValue={verifiedOrCustom}
              onValueChange={(value) =>
                setVerifiedOrCustom(value as "verified" | "custom")
              }
            >
              <TabsList className="w-full flex">
                <TabsTrigger value="verified" className="flex-1">
                  Verified
                </TabsTrigger>
                <TabsTrigger value="custom" className="flex-1">
                  Custom
                </TabsTrigger>
              </TabsList>
              <TabsContent value="verified">
                <div className="grid grid-cols-3 items-center gap-4 overflow-y-auto pb-4">
                  {availableServers.map((availableServer) => (
                    <div
                      key={availableServer.key}
                      className="flex flex-col items-center justify-center border border-gray-200 rounded-md p-2 aspect-square shadow-md hover:bg-gray-50 cursor-pointer transition-all"
                      onClick={() => setSelectedServer(availableServer)}
                    >
                      <img
                        src={availableServer.icon}
                        alt={availableServer.name}
                        className="w-10 h-10 object-contain"
                      />
                      <div className="text-sm text-gray-500">
                        {availableServer.name}
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
              <TabsContent value="custom">
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right">
                      Name
                    </Label>
                    <Input
                      id="name"
                      placeholder="descriptive-server-name"
                      className="col-span-3"
                      value={inputtedServerName}
                      onChange={(e) => setInputtedServerName(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="type" className="text-right">
                      Type
                    </Label>
                    <div id="type" className="col-span-3">
                      <Select
                        value={selectedType}
                        onValueChange={(value) =>
                          setSelectedType(value as "command" | "sse")
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="command">Command</SelectItem>
                          <SelectItem value="sse">SSE</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {selectedType === "command" && (
                    <>
                      <p className="text-sm text-gray-500 w-full text-right">
                        If installing from Smithery, use Cursor-style command
                      </p>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="command" className="text-right">
                          Command*
                        </Label>
                        <Input
                          required
                          id="command"
                          placeholder={`npx -y @smithery/cli@latest run @dragonkhoi/mixpanel-mcp --config "{\\"username\\":\\"fff\\",\\"password\\":\\"fff\\",\\"projectId\\":\\"fff\\"}"`}
                          className="col-span-3"
                          value={command}
                          onChange={(e) => setCommand(e.target.value)}
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="env" className="text-right">
                          Env JSON
                        </Label>
                        <Input
                          id="env"
                          placeholder={`{"key": "value"}`}
                          className="col-span-3"
                          onChange={(e) => setEnvString(e.target.value)}
                          value={envString}
                        />
                      </div>
                    </>
                  )}
                  {selectedType === "sse" && (
                    <>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="url" className="text-right">
                          URL*
                        </Label>
                        <Input
                          required
                          id="url"
                          placeholder="https://mcp.composio.dev/gmail/thoughtless-repulsive-pizza"
                          className="col-span-3"
                          value={customSSEUrl}
                          onChange={(e) => setCustomSSEUrl(e.target.value)}
                        />
                      </div>
                    </>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          )}

          <DialogFooter className="w-full flex justify-between">
            <Button
              disabled={
                (verifiedOrCustom === "verified" && !selectedServer) ||
                (verifiedOrCustom === "custom" &&
                  selectedType === "command" &&
                  !command) ||
                (verifiedOrCustom === "custom" &&
                  selectedType === "sse" &&
                  !customSSEUrl)
              }
              onClick={handleConnect}
            >
              Connect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Connected Servers List */}
      <div className="server-list max-h-[calc(100vh-100px)] overflow-y-auto">
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
            </div>
          ))
        ) : (
          <div className="no-servers">No connected servers</div>
        )}
      </div>
    </div>
  );
};

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

export default ServerManager;
