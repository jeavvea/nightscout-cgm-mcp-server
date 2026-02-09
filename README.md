# NightScout MCP Server

TypeScript MCP server for NightScout CGM (Continuous Glucose Monitor) data access with JWT authentication using HTTP transport.

> [!WARN]
> ⚠️ **BETA SOFTWARE WARNING**  
> This project is in **beta** and is provided **as-is** without warranty of any kind. Use at your own risk. Documentation is incomplete and testing coverage is limited. There are known bugs. This software is not intended for production medical or critical use. Always verify glucose data through approved medical devices.

## Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Quickstart with Docker](#quickstart-with-docker)
- [Configuration](#configuration)
  - [Environment Variables Reference](#environment-variables-reference)
  - [Getting Your NightScout Access Token](#getting-your-nightscout-access-token)
- [Usage](#usage)
- [Authentication](#authentication)
- [Available Tools & Prompts](#available-tools--prompts)
  - [Tools](#tools)
  - [Prompts](#prompts)
- [MCP Protocol](#mcp-protocol)
- [Development](#development)
- [Troubleshooting](#troubleshooting)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [License](#license)
- [Support](#support)

## Features

- **HTTP-based MCP Server**: Streamable HTTP transport for MCP protocol
- **Multi-User Support**: Each user authenticates with their own credentials via Amazon Cognito
- **NightScout Integration**: Direct access to your NightScout CGM data
- **OAuth 2.1 Authentication**: Required authentication via Amazon Cognito with per-user NightScout credentials
- **JWT Token Verification**: Secure request validation using Cognito-issued access tokens
- **Blood Glucose Retrieval**: Get glucose entries from the last 30 days (or custom date range)
- **Treatment Logging**: Add carbohydrate treatments to NightScout
- **Type-Safe**: Built with TypeScript for reliability

## Prerequisites

- Node.js 18+
- **Amazon Cognito User Pool** (Required - see [OAuth Setup Guide](docs/oauth-setup.md))
- A NightScout instance with API access
- NightScout access token (stored per-user in Cognito custom attributes)

## Quickstart with Docker

The fastest way to get started is using Docker:

### 1. Set up Amazon Cognito

> [!IMPORTANT]
> This server **requires** Amazon Cognito for authentication. You must set up a Cognito User Pool before running the server.

Follow the [OAuth Setup Guide](docs/oauth-setup.md) to configure:
- Cognito User Pool with custom attributes for NightScout credentials
- App Client for the MCP server
- User accounts with their NightScout URLs and access tokens

### 2. Create your `.env` file

Copy the example and configure your Cognito credentials:

```bash
cp .env.example .env
# Edit .env with your Cognito User Pool ID and App Client ID
```

> [!TIP]
> See the [Configuration Reference](#configuration) section below for all available environment variables and detailed setup instructions.

### 3. Build the Docker image

```bash
docker build -t nightscout-mcp-server .
```

### 4. Run the container

```bash
docker run -d \
  --name nightscout-mcp \
  -p 8000:8000 \
  --env-file .env \
  nightscout-mcp-server
```

### 5. Verify it's running

```bash
# Check container logs
docker logs nightscout-mcp

# Test the server
curl -X POST http://localhost:8000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list",
    "params": {}
  }'
```

### Managing the container

```bash
# Stop the container
docker stop nightscout-mcp

# Start the container again
docker start nightscout-mcp

# Remove the container
docker rm nightscout-mcp

# View logs
docker logs -f nightscout-mcp
```

## Configuration

### Environment Variables Reference

Create a `.env` file in the root directory. You can start by copying the example:

```bash
cp .env.example .env
```

#### Required Variables

> [!IMPORTANT]
> Amazon Cognito configuration is **required** for this server to function. The server uses Cognito for authentication and retrieves per-user NightScout credentials from Cognito custom attributes.

| Variable | Description | Example |
|----------|-------------|---------|
| `COGNITO_REGION` | AWS region for your Cognito User Pool | `eu-west-1` |
| `COGNITO_USER_POOL_ID` | Cognito User Pool ID | `eu-west-1_XXXXXXXXX` |
| `COGNITO_APP_CLIENT_ID` | Cognito App Client ID | `xxxxxxxxxxxxxxxxxxxxxx` |

#### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Port number for the MCP server | `8000` |
| `HOST` | Host to bind to (`localhost` for local dev, `0.0.0.0` for Docker/production) | `localhost` |
| `LOG_LEVEL` | Logging verbosity (`debug`, `info`, `warn`, `error`) | `info` |
| `COGNITO_ISSUER` | Cognito issuer URL (auto-generated if not provided) | `https://cognito-idp.eu-west-1.amazonaws.com/eu-west-1_XXXXXXXXX` |
| `COGNITO_DOMAIN` | Cognito domain (auto-generated if not provided) | `your-domain.auth.eu-west-1.amazoncognito.com` |

#### Per-User NightScout Configuration

> [!NOTE]
> NightScout credentials are **NOT** configured via environment variables. Each user's NightScout URL and access token are stored in their Cognito user profile as custom attributes:
> - `custom:nightscout_base_url`
> - `custom:nightscout_access_token`
>
> See the [OAuth Setup Guide](docs/oauth-setup.md) for instructions on configuring these attributes.

#### Complete Example

```env
# Server Configuration
PORT=8000
HOST=0.0.0.0
LOG_LEVEL=info

# Amazon Cognito Configuration (REQUIRED)
COGNITO_REGION=eu-west-1
COGNITO_USER_POOL_ID=eu-west-1_XXXXXXXXX
COGNITO_APP_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxx
COGNITO_ISSUER=https://cognito-idp.eu-west-1.amazonaws.com/eu-west-1_XXXXXXXXX
COGNITO_DOMAIN=your-domain.auth.eu-west-1.amazoncognito.com
```

> [!WARNING]
> Never commit your `.env` file to version control. Keep your Cognito credentials secure.

## Usage

### Starting the Server

**Development mode** (with auto-rebuild):
```bash
npm run dev
```

**Production mode**:
```bash
npm run build
npm start
```

The server will start on the configured port (default: 8000) and be accessible at:
```
http://localhost:8000/mcp
```

## Authentication

### OAuth 2.1 with Amazon Cognito (Required)

This server **requires** OAuth 2.1 authentication using Amazon Cognito. All MCP endpoints are protected and require a valid Cognito-issued access token.

**Architecture:**
- Each user authenticates via Amazon Cognito
- User-specific NightScout credentials are stored in Cognito custom attributes
- MCP server retrieves credentials from Cognito for each authenticated user
- Multi-user support: Each user accesses their own NightScout instance

**Key Features:**
- PKCE (Proof Key for Code Exchange) for enhanced security
- Discovery endpoints for automatic client configuration
- Per-user NightScout credentials via Cognito custom attributes
- JWT token verification for all requests

**Setup Required:**
1. Create a Cognito User Pool with custom attributes
2. Configure app client for the MCP server
3. Add users with their NightScout credentials

For detailed setup instructions, see the [OAuth Setup Guide](docs/oauth-setup.md).

**Endpoints:**
- Authorization endpoint: `/authorize`
- Token endpoint: `/token`
- Protected resource: `/mcp` (requires `Authorization: Bearer <token>`)
- OAuth metadata: `/.well-known/oauth-protected-resource`


## Available Tools & Prompts

The MCP server exposes the following tools and prompts:

### Tools

#### `get_glucose_entries`

Retrieves blood glucose entries from NightScout for a specified date range.

**Parameters:**
- `startDate` (optional): ISO 8601 date string or timestamp. Defaults to 24 hours ago.
- `endDate` (optional): ISO 8601 date string or timestamp. Defaults to now.
- `limit` (optional): Maximum number of entries to retrieve (default: 1000, max: 10000)

**Returns:** Formatted blood glucose readings with timestamps, values, directions, unit type, and UTC offset.

**Example:**

```bash
curl -X POST http://localhost:8000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "get_glucose_entries",
      "arguments": {
        "startDate": "2024-01-01",
        "endDate": "2024-01-31"
      }
    }
  }'
```

#### `add_carb_treatment`

Adds a carbohydrate treatment entry to NightScout. This records carbohydrate intake without insulin.

> [!CAUTION]
> This tool writes data to NightScout. Ensure you have the correct permissions and understand the implications of adding treatment data.

**Parameters:**
- `carbs` (required): Amount of carbohydrates in grams (must be positive)
- `eventType` (optional): Type of event - `"Carb Correction"`, `"Meal Bolus"`, or `"Snack Bolus"` (default: `"Carb Correction"`)
- `created_at` (optional): ISO 8601 date string for when carbs were consumed (defaults to current time)
- `notes` (optional): Notes about the carbohydrate intake
- `enteredBy` (optional): Name of person entering data (default: `"MCP Server"`)

**Returns:** Success status, treatment ID, and confirmed treatment details.

**Example:**

```bash
curl -X POST http://localhost:8000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "add_carb_treatment",
      "arguments": {
        "carbs": 45,
        "eventType": "Meal Bolus",
        "notes": "Lunch - pasta with vegetables"
      }
    }
  }'
```

### Prompts

#### `estimate-carbs`

Helps estimate carbohydrate content in food descriptions using AI assistance.

**Arguments:**
- `foodDescription` (required): Description of the food or meal (e.g., "a medium apple", "bowl of pasta with tomato sauce")
- `units` (optional): Preferred unit - `"grams"`, `"exchanges"`, or `"both"` (default: `"grams"`)
- `confidence` (optional): Include confidence level in estimate (default: `true`)

**Returns:** AI-generated carbohydrate estimate with breakdown and assumptions.

> [!TIP]
> For complete API documentation and integration examples, see the [MCP Integration Guide](docs/mcp-integration.md).

## MCP Protocol

This server implements the [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) using HTTP transport.

**Quick Connection Info:**
- **Endpoint**: `http://localhost:8000/mcp`
- **Transport**: HTTP (Streamable HTTP)
- **Format**: JSON-RPC 2.0

> [!TIP]
> For detailed integration instructions, client examples, and protocol documentation, see the [MCP Integration Guide](docs/mcp-integration.md).

## Development

> [!NOTE]
> This section is for developers who want to contribute to or modify the server.

### Project Structure

```
nightscout-mcp-server/
├── src/
│   ├── index.ts              # Main server entry point
│   ├── config.ts             # Configuration and validation
│   ├── nightscout-client.ts  # NightScout API client
│   └── types.ts              # TypeScript type definitions
├── docs/                     # Documentation
│   ├── oauth-setup.md        # OAuth 2.1 setup guide
│   ├── mcp-integration.md    # MCP integration guide
│   └── error-reference.md    # Error reference
├── dist/                     # Compiled JavaScript output
├── .env                      # Environment variables (create this)
├── .env.example             # Example environment file
├── Dockerfile               # Docker build configuration
├── package.json
├── tsconfig.json
└── README.md
```


## Troubleshooting

**Common Issues:**

| Issue | Quick Fix |
|-------|-----------|
| Server exits immediately | Check all Cognito environment variables in `.env` are set correctly |
| Authentication fails | Verify Cognito credentials and ensure user has valid access token |
| "COGNITO_USER_POOL_ID is not configured" | Set `COGNITO_USER_POOL_ID` in `.env` file - it's required |
| 401 Unauthorized errors | Check that the Bearer token is valid and not expired |
| No data returned | Verify user's Cognito custom attributes have valid NightScout URL and token |
| Connection refused | Ensure server is running and port is correct |
| Missing NightScout credentials | Add `custom:nightscout_base_url` and `custom:nightscout_access_token` to user in Cognito |

> [!TIP]
> For detailed error messages and solutions, see the [Error Reference Guide](docs/error-reference.md).

## License

MIT

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## Documentation

> [!TIP]
> Check out these detailed guides for advanced topics.

- [OAuth Setup Guide](docs/oauth-setup.md) - Detailed OAuth 2.1 and Cognito configuration
- [MCP Integration Guide](docs/mcp-integration.md) - MCP protocol details and client examples
- [Error Reference](docs/error-reference.md) - Comprehensive error messages and solutions

## Support

For issues related to:
- **This server**: Open an issue in this repository
- **NightScout**: See [NightScout documentation](https://nightscout.github.io/)
- **MCP Protocol**: See [MCP documentation](https://modelcontextprotocol.io/)

---

[![Buy Me A Coffee](https://img.shields.io/badge/Buy_Me_A_Coffee-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://www.buymeacoffee.com/evecodes)