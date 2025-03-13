# The Dashboard

A simple Electron dashboard application that connects to multiple MCP (Model Context Protocol) servers.

## Features

- Connect to multiple MCP servers simultaneously
- Switch between connected servers
- Interact with AI using the active MCP server
- Configure MCP servers using a JSON configuration file

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/the-dashboard.git
cd the-dashboard

# Install dependencies
npm install

# Start the application
npm start
```

## MCP Server Configuration

The application automatically loads MCP server configurations from a `mcp-servers.json` file in the root directory. The file should have the following structure:

```json
{
  "mcpServers": {
    "server-name-1": {
      "command": "command-to-run",
      "args": ["arg1", "arg2", "..."]
    },
    "server-name-2": {
      "command": "another-command",
      "args": ["arg1", "arg2", "..."]
    }
  }
}
```

### Example Configuration

```json
{
  "mcpServers": {
    "mixpanel": {
      "command": "npx",
      "args": [
        "-y",
        "@smithery/cli@latest",
        "run",
        "@dragonkhoi/mixpanel-mcp",
        "--config",
        "{\"username\":\"your-username\",\"password\":\"your-password\",\"projectId\":\"your-project-id\"}"
      ]
    },
    "reddit": {
      "command": "uvx",
      "args": [
        "--from",
        "git+https://github.com/adhikasp/mcp-reddit.git",
        "mcp-reddit"
      ]
    }
  }
}
```

## Usage

1. Start the application
2. The application will automatically connect to all configured MCP servers
3. Use the sidebar to switch between connected servers or connect to additional servers
4. Type messages in the chat input to interact with the AI using the active MCP server

## Development

```bash
# Run in development mode
npm run dev

# Build the application
npm run make
```

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```
ANTHROPIC_API_KEY=your-anthropic-api-key
AI_MODEL=claude-3-5-sonnet-20240620
MAX_TOKENS=4096
```

## License

MIT
