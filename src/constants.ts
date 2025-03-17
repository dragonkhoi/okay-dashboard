export const AI_RESPONSE_PREPEND = `{"requiresMCPTools":`;
export const SERVER_TOOL_NAME_SEPARATOR = "___";
export const MCP_SERVER_ICONS: Record<string, string> = {
  "dragonkhoi-mercury-mcp": "static://assets/mercury-logo.svg",
  mercury: "static://assets/mercury-logo.svg",
  "dragonkhoi-mixpanel-mcp": "static://assets/mixpanel-logo.png",
  mixpanel: "static://assets/mixpanel-logo.png",
  "notion-composio": "static://assets/notion-logo.png",
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
  "browser-use":
    "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/Google_Chrome_icon_%28February_2022%29.svg/768px-Google_Chrome_icon_%28February_2022%29.svg.png",
  discord: "https://pngimg.com/d/discord_PNG3.png",
  "google-drive":
    "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ3RaendkWxwbnlsA8UyDPmcDbqIMQETxKYpw&s",
  slack:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d5/Slack_icon_2019.svg/2048px-Slack_icon_2019.svg.png",
  "google-sheets":
    "https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Google_Sheets_logo_%282014-2020%29.svg/1200px-Google_Sheets_logo_%282014-2020%29.svg.png",
    "posthog": "https://cdn.jsdelivr.net/gh/ComposioHQ/open-logos@master/posthog.svg",
    "youtube": "https://cdn.jsdelivr.net/gh/ComposioHQ/open-logos@master/youtube.svg",
  "google-docs": "https://cdn.jsdelivr.net/gh/ComposioHQ/open-logos@master/google-docs.svg",
  "zoom": "https://cdn.jsdelivr.net/gh/ComposioHQ/open-logos@master/zoom.svg",
  "linear": "https://cdn.jsdelivr.net/gh/ComposioHQ/open-logos@master/linear.png",
  "amplitude": "https://cdn.jsdelivr.net/gh/ComposioHQ/open-logos@master//amplitude.svg",
  "trello": "https://cdn.jsdelivr.net/gh/ComposioHQ/open-logos@master/trello.svg"
};
export const AGENT_PREFIX = "_AGENT_HANDOFF";
export const COMPLETED_HANDOFF = "_COMPLETED_HANDOFF";
export const PLANNER_AGENT = "planner_agent";
export const MONEY_AGENT = "money_agent";
export const PRODUCT_ANALYTICS_AGENT = "product_analytics_agent";
export const EXTERNAL_SEARCH_AGENT = "external_search_agent";
export const INTERNAL_SEARCH_AGENT = "internal_search_agent";
export const COMMUNICATION_AGENT = "communication_agent";

export const MCP_SERVER_DATA = [
  {
    name: "Mercury",
    key: "mercury",
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
      "API Key":
        "secret-token:mercury_production_rma_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX_yrucrem",
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
    installInstructions:
      "Go to your project Connection settings and get the Session pooler connection string with your database password.",
    infoUrl: "https://supabase.com/docs/guides/getting-started/mcp",
    githubUrl:
      "https://github.com/modelcontextprotocol/servers/tree/main/src/postgres",
    configArgNames: {
      "Connection String":
        "postgresql://postgres.XXXXXXXXXXXXXXXXXXX:<PASSWORD>@aws-XXXXXX.pooler.supabase.com:XXXX/postgres",
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
    installInstructions:
      "Go to your Ramp developer settings, create a new project, and get the secret key and project ID.",
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
      BRAVE_API_KEY: "<ARG><BRAVE_API_KEY></ARG>",
    },
    relevantAgents: ["external_search_agent"],
    installInstructions:
      "Go to your Brave Search settings and get the API key.",
    infoUrl:
      "https://api-dashboard.search.brave.com/app/documentation/web-search/get-started",
    githubUrl:
      "https://github.com/modelcontextprotocol/servers/tree/main/src/brave-search",
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
    installInstructions:
      "Get your custom URL through the Composio Google Calendar page.",
    infoUrl: "https://mcp.composio.dev/googlecalendar/",
  },
  {
    name: "Google Drive",
    key: "google-drive",
    sse: "https://mcp.composio.dev/googledrive/",
    type: "sse",
    requiresCustomSSE: true,
    relevantAgents: ["internal_search_agent"],
    installInstructions:
      "Get your custom URL through the Composio Google Drive page.",
    infoUrl: "https://mcp.composio.dev/googledrive/",
  },
  {
    name: "Google Docs",
    key: "google-docs",
    sse: "https://mcp.composio.dev/googledocs/",
    type: "sse",
    requiresCustomSSE: true,
    relevantAgents: ["internal_search_agent"],
    installInstructions:
      "Get your custom URL through the Composio Google Docs page.",
    infoUrl: "https://mcp.composio.dev/googledocs/",
  },
  {
    name: "Google Sheets",
    key: "google-sheets",
    sse: "https://mcp.composio.dev/googlesheets/",
    type: "sse",
    requiresCustomSSE: true,
    relevantAgents: ["internal_search_agent"],
    installInstructions:
      "Get your custom URL through the Composio Google Sheets page.",
    infoUrl: "https://mcp.composio.dev/googlesheets/",
  },
  {
    name: "Slack",
    key: "slack",
    sse: "https://mcp.composio.dev/slack/",
    type: "sse",
    requiresCustomSSE: true,
    relevantAgents: ["communication_agent"],
    installInstructions: "Get your custom URL through the Composio Slack page.",
    infoUrl: "https://mcp.composio.dev/slack/",
  },
  {
    name: "Discord",
    key: "discord",
    sse: "https://mcp.composio.dev/discord/",
    type: "sse",
    requiresCustomSSE: true,
    relevantAgents: ["communication_agent"],
    installInstructions:
      "Get your custom URL through the Composio Discord page.",
    infoUrl: "https://mcp.composio.dev/discord/",
  },
  {
    name: "Notion (Composio)",
    key: "notion-composio",
    sse: "https://mcp.composio.dev/notion/",
    type: "sse",
    requiresCustomSSE: true,
    relevantAgents: ["internal_search_agent"],
    installInstructions:
      "Get your custom URL through the Composio Notion page.",
    infoUrl: "https://mcp.composio.dev/notion/",
  },
  {
    name: "Notion (API)",
    key: "notion",
    type: "command",
    command: "node",
    args: [
      "/Users/khoile/src/notion-mcp-server/dist/index.js",
      "-t",
      "<ARG><API Token></ARG>",
    ],
    relevantAgents: ["internal_search_agent"],
    installInstructions:
      "Go to your Notion developer settings, create an integration and get the API token. Add your integration to your Notion pages.",
    infoUrl: "https://developers.notion.com/docs/authorization",
    githubUrl: "https://github.com/orbit-logistics/notion-mcp-server",
    configArgNames: {
      "API Token": "ntn_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    },
  },
  {
    name: "Amplitude",
    key: "amplitude",
    sse: "https://mcp.composio.dev/amplitude/",
    type: "sse",
    requiresCustomSSE: true,
    relevantAgents: ["product_analytics_agent"],
    installInstructions:
      "Get your custom URL through the Composio Amplitude page.",
    infoUrl: "https://mcp.composio.dev/amplitude/",
  },
  {
    name: "Mixpanel",
    key: "mixpanel",
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
    installInstructions:
      "Go to your organization settings and create a service account.",
    infoUrl: "https://developer.mixpanel.com/reference/service-accounts",
    githubUrl: "https://github.com/dragonkhoi/mixpanel-mcp/tree/main",
    configArgNames: {
      "Service Account Username": "query-api.XXXXXXX.mp-service-account",
      "Service Account Password": "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
      "Project ID": "XXXXXXX",
    },
  },
  {
    name: "Posthog",
    key: "posthog",
    sse: "https://mcp.composio.dev/posthog/",
    type: "sse",
    requiresCustomSSE: true,
    relevantAgents: ["product_analytics_agent"],
    installInstructions:
      "Get your custom URL through the Composio Posthog page.",
    infoUrl: "https://mcp.composio.dev/posthog/",
  },
  {
    name: "Linear",
    key: "linear",
    sse: "https://mcp.composio.dev/linear/",
    type: "sse",
    requiresCustomSSE: true,
    relevantAgents: ["internal_search_agent"],
    installInstructions:
      "Get your custom URL through the Composio Linear page.",
    infoUrl: "https://mcp.composio.dev/linear/",
  },
  {
    name: "Zoom",
    key: "zoom",
    sse: "https://mcp.composio.dev/zoom/",
    type: "sse",
    requiresCustomSSE: true,
    relevantAgents: ["communication_agent"],
    installInstructions: "Get your custom URL through the Composio Zoom page.",
    infoUrl: "https://mcp.composio.dev/zoom/",
  },
  {
    name: "YouTube",
    key: "youtube",
    sse: "https://mcp.composio.dev/youtube/",
    type: "sse",
    requiresCustomSSE: true,
    relevantAgents: ["external_search_agent"],
    installInstructions: "Get your custom URL through the Composio YouTube page.",
    infoUrl: "https://mcp.composio.dev/youtube/",
  },
  {
    name: "Trello",
    key: "trello",
    sse: "https://mcp.composio.dev/trello/",
    type: "sse",
    requiresCustomSSE: true,
    relevantAgents: ["internal_search_agent"],
    installInstructions: "Get your custom URL through the Composio Trello page.",
    infoUrl: "https://mcp.composio.dev/trello/",
  },
];
