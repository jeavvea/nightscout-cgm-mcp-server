import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

// Registry of transports keyed by MCP session ID.
// Kept as a simple object map for compatibility with existing code.
export const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};
