# OAuth 2.1 Setup Guide

This document provides detailed information about the OAuth 2.1 implementation in the NightScout MCP Server.

## Overview

> [!IMPORTANT]
> **Amazon Cognito is REQUIRED** for this server to function. OAuth 2.1 authentication via Cognito is not optional - all MCP endpoints are protected and require valid Cognito-issued access tokens.

This server implements the Minimal OAuth 2.1 pattern outlined in the Simplescraper MCP guide, using Amazon Cognito for authentication and user management.

**Multi-User Architecture:**
- Each user authenticates with their own Cognito credentials
- Per-user NightScout URLs and access tokens are stored in Cognito custom attributes
- The server retrieves the appropriate NightScout credentials for each authenticated user
- Multiple users can use the same MCP server instance with their own NightScout instances

## OAuth Endpoints

The server provides the following OAuth endpoints:

### Discovery Endpoints

These endpoints allow MCP clients to discover OAuth configuration:

- `/.well-known/oauth-protected-resource` - Protected resource metadata
- `/.well-known/oauth-authorization-server` - Authorization server metadata

### Authentication Flow Endpoints

- **Authorization endpoint**: `/authorize`
  - Redirects to Cognito Hosted UI for user authentication

- **Callback endpoint**: `/callback`
  - Exchanges authorization code with Cognito

- **Token endpoint**: `/token`
  - Validates PKCE and returns Cognito access token

- **Client registration** (optional): `/register`
  - Stub endpoint for client registration

## Security Features

### PKCE (Proof Key for Code Exchange)

The implementation uses PKCE to prevent authorization code interception attacks:

- The issued authorization code is bound to the `client_id` and the PKCE `code_challenge`
- The token endpoint verifies both `code_verifier` and `client_id` before issuing tokens
- MCP clients must send `Authorization: Bearer <access_token>` for subsequent `/mcp` calls

## Cognito Custom Attributes (Required)

> [!IMPORTANT]
> Each user MUST have the following custom attributes configured in Cognito. Without these, the server cannot access NightScout data.

For each user, you must define and set these custom attributes in your Cognito User Pool:

- `custom:nightscout_base_url` - The user's NightScout instance URL (e.g., `https://your-nightscout.herokuapp.com`)
- `custom:nightscout_access_token` - The user's NightScout access token

These custom attributes enable multi-tenant operation, where each user accesses their own NightScout instance through the same MCP server.

## Testing OAuth Flow

### Quick Test

1. Start the server, then visit the authorization URL (example):

```
http://localhost:8000/authorize?response_type=code&client_id=test-client&redirect_uri=http%3A%2F%2Flocalhost%3A8000%2Fclient-callback&code_challenge=<S256_CODE_CHALLENGE>&code_challenge_method=S256&state=xyz
```

2. After Cognito login, you'll be redirected to `redirect_uri` with a `code` parameter.

3. Exchange the code at `/token` with your `code_verifier` to get an `access_token`:

```bash
curl -X POST http://localhost:8000/token \
  -H "Content-Type: application/json" \
  -d '{
    "grant_type": "authorization_code",
    "code": "AUTHORIZATION_CODE_FROM_STEP_2",
    "redirect_uri": "http://localhost:8000/client-callback",
    "client_id": "test-client",
    "code_verifier": "YOUR_CODE_VERIFIER"
  }'
```

4. Use the `access_token` as a Bearer token in the `Authorization` header when calling `/mcp`:

```bash
curl -X POST http://localhost:8000/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list",
    "params": {}
  }'
```

## Setting Up Amazon Cognito

> [!IMPORTANT]
> This section is **required** before running the server. You cannot skip Cognito setup.

### Prerequisites

1. An AWS account
2. AWS CLI configured (optional, but recommended)
3. Permissions to create Cognito User Pools in your AWS account

### Step-by-Step Setup

1. **Create a Cognito User Pool**
   - Navigate to AWS Cognito in your AWS Console
   - Choose your region (e.g., `eu-west-1`)
   - Create a new User Pool with the following settings:
     - Enable hosted UI
     - **Required:** Add custom attributes: `nightscout_base_url` (String) and `nightscout_access_token` (String)
     - Set these custom attributes as mutable

2. **Configure App Client**
   - Create an app client for the hosted UI
   - Note the `App client ID` - this becomes your `COGNITO_APP_CLIENT_ID`
   - Enable OAuth flows: Authorization code grant
   - Configure OAuth scopes: `openid`, `profile`, `email`
   - Set callback URLs for your MCP clients

3. **Set Up Domain**
   - Configure a Cognito domain (e.g., `your-app.auth.eu-west-1.amazoncognito.com`)
   - This becomes your `COGNITO_DOMAIN`

4. **Update Environment Variables**
   - Add all Cognito configuration to your `.env` file (see [Configuration Reference](../README.md#configuration))
   - **Required:** `COGNITO_REGION`, `COGNITO_USER_POOL_ID`, `COGNITO_APP_CLIENT_ID`

5. **Create Users and Set Custom Attributes**
   - Add users through the Cognito console or AWS CLI
   - **Critical:** For each user, set their custom attributes:
     - `custom:nightscout_base_url` = their NightScout URL
     - `custom:nightscout_access_token` = their NightScout API token
   - Without these attributes, users cannot access NightScout data

## Troubleshooting

### Common Issues

**Redirect URI mismatch**
- Ensure the `redirect_uri` in your authorization request exactly matches what's configured in Cognito

**Invalid code_verifier**
- Verify that the `code_verifier` sent to `/token` matches the one used to generate `code_challenge`
- The code challenge method must be `S256` (SHA-256)

**Token expired**
- Access tokens have an expiration time
- Implement token refresh logic in your client application

**Custom attributes not found**
- Ensure custom attributes are set for the user in Cognito
- Custom attribute names must include the `custom:` prefix

## Security Best Practices

1. **Use HTTPS in production** - Never use OAuth over plain HTTP in production
2. **Validate redirect URIs** - Only allow whitelisted redirect URIs
3. **Rotate secrets regularly** - Update Cognito app client secrets periodically
4. **Monitor access** - Use AWS CloudWatch to monitor authentication attempts
5. **Limit token lifetime** - Configure appropriate token expiration times in Cognito

## Further Reading

- [OAuth 2.1 Specification](https://oauth.net/2.1/)
- [AWS Cognito Documentation](https://docs.aws.amazon.com/cognito/)
- [PKCE RFC 7636](https://tools.ietf.org/html/rfc7636)
- [Model Context Protocol](https://modelcontextprotocol.io/)
