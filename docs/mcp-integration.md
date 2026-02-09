# MCP Protocol Integration

This document provides detailed information about integrating with the NightScout MCP Server using the Model Context Protocol.

## Overview

This server implements the [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) using HTTP transport. It can be used with any MCP-compatible client.

## Transport Configuration

### HTTP Transport

The server uses Streamable HTTP transport for the MCP protocol.

**Connection Details:**

- **Transport**: HTTP (Streamable HTTP)
- **Endpoint**: `http://localhost:8000/mcp` (or your configured host and port)
- **Method**: POST
- **Headers**:
  - `Content-Type: application/json`
  - `Accept: application/json, text/event-stream`
  - `Authorization: Bearer <access_token>` (when using OAuth)

### Example Client Configuration

```json
{
  "transport": "http",
  "endpoint": "http://localhost:8000/mcp",
  "headers": {
    "Content-Type": "application/json",
    "Accept": "application/json, text/event-stream"
  }
}
```

## MCP Protocol Messages

### JSON-RPC 2.0 Format

All MCP messages follow the JSON-RPC 2.0 specification:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "method_name",
  "params": {}
}
```

### Listing Available Tools

To discover available tools on the server:

**Request:**

```bash
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

**Response:**

```json
{
  "jsonrpc": "2.0",
  "result": {
    "tools": [
      {
        "name": "get_glucose_entries",
        "description": "Retrieves blood glucose entries from NightScout",
        "inputSchema": {
          "type": "object",
          "properties": {
            "startDate": {
              "type": "string",
              "description": "ISO 8601 date string or timestamp"
            },
            "endDate": {
              "type": "string",
              "description": "ISO 8601 date string or timestamp"
            },
            "limit": {
              "type": "number",
              "description": "Maximum number of entries"
            }
          }
        }
      }
    ]
  },
  "id": 1
}
```

### Calling Tools

To invoke a tool:

**Request:**

```bash
curl -X POST http://localhost:8000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "get_glucose_entries",
      "arguments": {
        "startDate": "2024-01-01",
        "endDate": "2024-01-31",
        "limit": 500
      }
    }
  }'
```

**Response:**

```json
{
  "jsonrpc": "2.0",
  "result": {
    "content": [
      {
        "type": "text",
        "text": "[{\"_id\":\"...\",\"type\":\"sgv\",\"sgv\":120,\"direction\":\"Flat\",\"date\":1234567890000,...}]"
      }
    ]
  },
  "id": 1
}
```

## Logging Capability

### Server-Side Logging

The server declares the MCP `logging` capability and may send client-visible log notifications in limited cases via `notifications/message`.

**Log Notification Format:**

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/message",
  "params": {
    "level": "info",
    "logger": "nightscout-mcp-server",
    "data": "Tool execution started: get_glucose_entries"
  }
}
```

### Log Levels

The server uses Winston for logging and emits logs in JSON format to stdout with timestamps.

Configure verbosity with the `LOG_LEVEL` environment variable:

```env
LOG_LEVEL=debug
```

**Supported levels:**
- `debug` - Detailed debugging information
- `info` - General informational messages (default)
- `warn` - Warning messages
- `error` - Error messages

### Example Log Output

```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "info",
  "message": "Tool called: get_glucose_entries",
  "params": {
    "startDate": "2024-01-01",
    "endDate": "2024-01-31"
  }
}
```

## Error Handling

### MCP Error Responses

When an error occurs, the server responds with a JSON-RPC error object:

```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32603,
    "message": "Internal error",
    "data": {
      "details": "Failed to fetch entries from NightScout"
    }
  },
  "id": 1
}
```

### Common Error Codes

| Code | Meaning | Typical Cause |
|------|---------|---------------|
| `-32700` | Parse error | Invalid JSON |
| `-32600` | Invalid request | Malformed JSON-RPC |
| `-32601` | Method not found | Unknown method name |
| `-32602` | Invalid params | Missing or invalid parameters |
| `-32603` | Internal error | Server-side error |

## Streaming Responses

The server supports streaming responses using Server-Sent Events (SSE) when the `Accept` header includes `text/event-stream`.

### Example Streaming Response

```
event: message
data: {"jsonrpc":"2.0","id":1,"result":{"content":[...]}}

event: log
data: {"level":"info","message":"Tool execution completed"}
```

## Client Libraries

### JavaScript/TypeScript

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

const transport = new SSEClientTransport(
  new URL('http://localhost:8000/mcp')
);

const client = new Client({
  name: 'nightscout-client',
  version: '1.0.0',
}, {
  capabilities: {}
});

await client.connect(transport);

// List available tools
const tools = await client.listTools();

// Call a tool
const result = await client.callTool({
  name: 'get_glucose_entries',
  arguments: {
    startDate: '2024-01-01',
    endDate: '2024-01-31'
  }
});
```

### Python

```python
import requests

endpoint = "http://localhost:8000/mcp"
headers = {
    "Content-Type": "application/json",
    "Accept": "application/json, text/event-stream"
}

# List tools
response = requests.post(endpoint, json={
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list",
    "params": {}
}, headers=headers)

tools = response.json()

# Call a tool
response = requests.post(endpoint, json={
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
        "name": "get_glucose_entries",
        "arguments": {
            "startDate": "2024-01-01",
            "endDate": "2024-01-31"
        }
    }
}, headers=headers)

result = response.json()
```

## Best Practices

1. **Handle errors gracefully** - Always check for error responses
2. **Use unique request IDs** - Increment or use UUIDs for request IDs
3. **Respect rate limits** - Implement backoff strategies if needed
4. **Log appropriately** - Use `LOG_LEVEL=debug` during development
5. **Validate parameters** - Check parameter types before sending requests
6. **Handle streaming** - Be prepared to handle both streaming and non-streaming responses

## Troubleshooting

### Connection refused
- Verify the server is running (`docker logs nightscout-mcp` or check process)
- Check the port configuration in your `.env` file
- Ensure firewall rules allow connections

### 401 Unauthorized
- Include the `Authorization: Bearer <token>` header when using OAuth
- Verify the token hasn't expired
- Check Cognito configuration

### Tool not found
- List available tools first using `tools/list`
- Verify the tool name is spelled correctly

### Invalid parameters
- Check the tool's input schema using `tools/list`
- Ensure parameter types match (string, number, etc.)
- Provide required parameters

## Further Reading

- [Model Context Protocol Specification](https://modelcontextprotocol.io/)
- [JSON-RPC 2.0 Specification](https://www.jsonrpc.org/specification)
- [Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
