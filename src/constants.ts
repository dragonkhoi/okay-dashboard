export const AI_RESPONSE_PREPEND = `{"requiresMCPTools":`;
export const SERVER_TOOL_NAME_SEPARATOR = "___";
export const MCP_SERVER_ICONS: Record<string, string> = {
  "dragonkhoi-mercury-mcp": "static://assets/mercury-logo.svg",
  "dragonkhoi-mixpanel-mcp": "static://assets/mixpanel-logo.png",
  notion: "static://assets/notion-logo.png",
  supabase: "static://assets/supabase-logo.png",
  ramp: "static://assets/ramp-logo.png",
  "brave-search": "static://assets/brave-logo.png",
  gmail:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Gmail_icon_%282020%29.svg/1280px-Gmail_icon_%282020%29.svg.png",
  "google-calendar":
    "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Google_Calendar_icon_%282020%29.svg/1200px-Google_Calendar_icon_%282020%29.svg.png",
  "ZubeidHendricks-youtube": "static://assets/youtube-logo.png",
  default: "static://assets/plug.png",
};
export const AGENT_PREFIX = "_AGENT_HANDOFF";
export const PLANNER_AGENT = "planner_agent";
export const MONEY_AGENT = "money_agent";
export const PRODUCT_ANALYTICS_AGENT = "product_analytics_agent";
export const EXTERNAL_SEARCH_AGENT = "external_search_agent";
export const INTERNAL_SEARCH_AGENT = "internal_search_agent";
export const COMMUNICATION_AGENT = "communication_agent";

export const MCP_SERVER_DATA = [
  {
    name: "Mixpanel",
    key: "dragonkhoi-mixpanel-mcp",
    type: "command",
    command: "npx",
    args: [
      "-y",
      "@smithery/cli@latest",
      "run",
      "@dragonkhoi/mixpanel-mcp",
      "--config",
      '{"username":"<ARG><Service Account Username></ARG>","password":"<ARG><Service Account Password></ARG>","projectId":"<ARG><Project ID></ARG>"}',
    ],
    relevantAgents: ["product_analytics_agent"],
    installInstructions: "Go to your organization settings and create a service account.",
    infoUrl: "https://developer.mixpanel.com/reference/service-accounts",
    githubUrl: "https://github.com/dragonkhoi/mixpanel-mcp/tree/main",
    configArgNames: {
      "Service Account Username": "query-api.XXXXXXX.mp-service-account",
      "Service Account Password": "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
      "Project ID": "XXXXXXX",
    },
  },
  {
    name: "Mercury",
    key: "dragonkhoi-mercury-mcp",
    type: "command",
    command: "npx",
    args: [
      "-y",
      "@smithery/cli@latest",
      "run",
      "@dragonkhoi/mercury-mcp",
      "--config",
      '{"apiKey":"<ARG><API Key></ARG>"}',
    ],
    relevantAgents: ["money_agent"],
    installInstructions: "Go to your developer settings and create an API key.",
    infoUrl: "https://docs.mercury.com/reference/getting-started-with-your-api",
    githubUrl: "https://github.com/dragonkhoi/mercury-mcp",
    configArgNames: {
      "API Key": "secret-token:mercury_production_rma_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX_yrucrem",
    },
  },
  {
    name: "Supabase",
    key: "supabase",
    type: "command",
    command: "npx",
    args: [
      "-y",
      "@modelcontextprotocol/server-postgres",
      "<ARG><Connection String></ARG>",
    ],
    relevantAgents: ["product_analytics_agent"],
    installInstructions: "Go to your project Connection settings and get the Session pooler connection string with your database password.",
    infoUrl: "https://supabase.com/docs/guides/getting-started/mcp",
    githubUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/postgres",
    configArgNames: {
      "Connection String": "postgresql://postgres.XXXXXXXXXXXXXXXXXXX:<PASSWORD>@aws-XXXXXX.pooler.supabase.com:XXXX/postgres",
    },
  },
  {
    name: "Ramp",
    key: "ramp",
    type: "command",
    command: "node",
    args: [
      "/Users/khoile/src/mcp-ramp/build/index.js",
      "<ARG><Secret Key></ARG>",
      "<ARG><Project ID></ARG>",
    ],
    relevantAgents: ["money_agent"],
    installInstructions: "Go to your Ramp developer settings, create a new project, and get the secret key and project ID.",
    infoUrl: "https://docs.ramp.com/developer-api/v1/guides/getting-started",
    githubUrl: "https://github.com/dragonkhoi/ramp-mcp",
    configArgNames: {
      "Secret Key": "ramp_sec_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
      "Project ID": "ramp_id_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    },
  },
  {
    name: "Brave Search",
    key: "brave-search",
    type: "command",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-brave-search"],
    env: {
      "BRAVE_API_KEY": "<ARG><BRAVE_API_KEY></ARG>",
    },
    relevantAgents: ["external_search_agent"],
    installInstructions: "Go to your Brave Search settings and get the API key.",
    infoUrl: "https://api-dashboard.search.brave.com/app/documentation/web-search/get-started",
    githubUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/brave-search",
  },
  {
    name: "Notion",
    key: "notion",
    type: "command",
    command: "node",
    args: [
      "/Users/khoile/src/notion-mcp-server/dist/index.js",
      "-t",
      "<ARG><API Token></ARG>",
    ],
    relevantAgents: ["internal_search_agent"],
    installInstructions: "Go to your Notion developer settings, create an integration and get the API token. Add your integration to your Notion pages.",
    infoUrl: "https://developers.notion.com/docs/authorization",
    githubUrl: "https://github.com/orbit-logistics/notion-mcp-server",
    configArgNames: {
      "API Token": "ntn_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    },
  },
  {
    name: "Gmail",
    key: "gmail",
    type: "sse",
    sse: "https://mcp.composio.dev/gmail/",
    requiresCustomSSE: true,
    relevantAgents: ["communication_agent", "internal_search_agent"],
    installInstructions: "Get your custom URL through the Composio GMail page.",
    infoUrl: "https://mcp.composio.dev/gmail/",
  },
  {
    name: "Google Calendar",
    key: "google-calendar",
    sse: "https://mcp.composio.dev/googlecalendar/",
    type: "sse",
    requiresCustomSSE: true,
    relevantAgents: ["communication_agent", "internal_search_agent"],
    installInstructions: "Get your custom URL through the Composio Google Calendar page.",
    infoUrl: "https://mcp.composio.dev/googlecalendar/",
  },
];
