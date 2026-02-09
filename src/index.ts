import express from "express";
import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import cors from "cors";
import {
  mcpAuthMetadataRouter,
  getOAuthProtectedResourceMetadataUrl,
} from "@modelcontextprotocol/sdk/server/auth/router.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import { logger } from "./utils/logger.js";
import { CONFIG, MCP_SERVER_URL, MCP_ENDPOINT_URL, COGNITO } from "./config.js";
import { oauthMetadata } from "./auth/oauth.js";
import {
  verifyAccessToken,
  getUsernameFromRequest,
} from "./auth/tokenVerifier.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { transports } from "./transport/sessionRegistry.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerGetGlucoseEntriesTool } from "./tools/getGlucoseEntries.js";
import { registerAddCarbTreatmentTool } from "./tools/addCarbTreatment.js";
import { registerEstimateCarbsPrompt } from "./prompts/estimateCarbsPrompt.js";

const app = express();

app.use(
  express.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf?.toString() ?? "";
    },
  })
);

app.use(
  cors({
    origin: "*",
    exposedHeaders: ["Mcp-Session-Id"],
  })
);

app.use(requestLogger);

// OAuth metadata, token verification, and username extraction moved to dedicated modules
app.use(
  mcpAuthMetadataRouter({
    oauthMetadata,
    resourceServerUrl: MCP_SERVER_URL,
    scopesSupported: ["openid", "profile", "email"],
    resourceName: "Nightscout MCP Server",
  })
);

// Use the SDK's bearer auth middleware
const authMiddleware = requireBearerAuth({
  verifier: {
    verifyAccessToken: verifyAccessToken,
  },
  resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(MCP_SERVER_URL),
});

// Configure Cognito OAuth
const cognitoDomain = COGNITO.domain;
const cognitoRegion = COGNITO.region;
const userPoolId = COGNITO.userPoolId!;
const clientId = COGNITO.appClientId!;

logger.debug("[COGNITO] OAuth configuration", {
  cognitoDomain,
  cognitoRegion,
  userPoolId,
  clientId_preview: clientId.substring(0, 8) + "...",
});

const mcpPostHandler = async (req: express.Request, res: express.Response) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  let transport: StreamableHTTPServerTransport;

  if (sessionId && transports[sessionId]) {
    transport = transports[sessionId];
  } else if (!sessionId && isInitializeRequest(req.body)) {
    // Determine the authenticated Cognito username for this session
    let username: string;
    try {
      username = await getUsernameFromRequest(req);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(401).json({
        jsonrpc: "2.0",
        error: { code: -32001, message: `Unauthorized: ${msg}` },
        id: null,
      });
      return;
    }

    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sessionId) => {
        transports[sessionId] = transport;
      },
    });

    transport.onclose = () => {
      if (transport.sessionId) {
        delete transports[transport.sessionId];
      }
    };

    const server = new McpServer(
      {
        name: "nightscout-mcp-server",
        version: "1.1.0",
      },
      {
        capabilities: {
          logging: {},
          prompts: {
            listChanged: false,
          },
        },
      }
    );
    // Register tools
    registerGetGlucoseEntriesTool(server, { username });
    registerAddCarbTreatmentTool(server, { username });

    // Register prompts
    registerEstimateCarbsPrompt(server);

    await server.connect(transport);
  } else {
    res.status(400).json({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "Bad Request: No valid session ID provided",
      },
      id: null,
    });
    return;
  }

  await transport.handleRequest(req, res, req.body);
};

const handleSessionRequest = async (
  req: express.Request,
  res: express.Response
) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (!sessionId || !transports[sessionId]) {
    res.status(400).send("Invalid or missing session ID");
    return;
  }

  const transport = transports[sessionId];
  await transport.handleRequest(req, res);
};

app.post("/mcp", authMiddleware, mcpPostHandler);
app.get("/mcp", authMiddleware, handleSessionRequest);
app.delete("/mcp", authMiddleware, handleSessionRequest);

// Lightweight health check endpoint for App Runner and external monitors
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

// Centralized error handler to ensure auth errors return 401 instead of 500
// Must be registered after routes/middleware
app.use(
  (
    err: any,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    const status = err?.status || (err?.code === "ERR_JWT_EXPIRED" ? 401 : 500);
    const message = err?.message || "Internal Server Error";
    if (status === 401 && !res.headersSent) {
      res.setHeader(
        "WWW-Authenticate",
        'Bearer error="invalid_token", error_description="Invalid or expired token"'
      );
    }
    if (res.headersSent) {
      return;
    }
    res.status(status).json({ error: message });
  }
);

app.listen(CONFIG.port, CONFIG.host, () => {
  logger.info("MCP Server started", { origin: MCP_SERVER_URL.origin });
  logger.info("MCP endpoint available", { endpoint: MCP_ENDPOINT_URL.href });
  logger.info("OAuth metadata available", {
    metadataUrl: getOAuthProtectedResourceMetadataUrl(MCP_SERVER_URL),
  });
});
