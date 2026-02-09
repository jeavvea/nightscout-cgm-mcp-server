import { config as dotenvConfig } from 'dotenv';

dotenvConfig();

export const CONFIG = {
  // Bind address - use 0.0.0.0 for containers, or localhost for local dev
  // Set HOST=localhost in .env for local development to avoid OAuth URL mismatches
  host: process.env.HOST || 'localhost',
  port: Number(process.env.PORT) || 8000,
  apprunnerServiceUrl: process.env.APPRUNNER_SERVICE_URL || undefined,
};

const protocol = process.env.USE_HTTPS === 'true' ? 'https' : 'http';

// Base URL for OAuth metadata - should NOT include /mcp path
export const MCP_SERVER_URL = new URL(
  CONFIG.apprunnerServiceUrl || `http://${CONFIG.host}:${CONFIG.port}`
);

// Full URL to the MCP endpoint
export const MCP_ENDPOINT_URL = new URL(`${MCP_SERVER_URL}/mcp`);

export const COGNITO = {
  region: process.env.COGNITO_REGION || 'eu-west-1',
  userPoolId: process.env.COGNITO_USER_POOL_ID,
  appClientId: process.env.COGNITO_APP_CLIENT_ID,
  domain:
    process.env.COGNITO_DOMAIN ||
    `nightscout-mcp-demo.auth.${process.env.COGNITO_REGION || 'eu-west-1'}.amazoncognito.com`,
};
