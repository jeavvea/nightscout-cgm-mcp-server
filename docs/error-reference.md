# Error Reference

This document provides a comprehensive reference for error messages and troubleshooting steps for the NightScout MCP Server.

## Configuration Errors

### Missing Environment Variables

**Error Message:**
```
Configuration error: ZodError: [
  {
    "code": "invalid_type",
    "expected": "string",
    "received": "undefined",
    "path": ["nightscoutUrl"],
    "message": "Required"
  }
]
```

**Cause:** Required environment variable is not set in your `.env` file.

**Solution:**
1. Check your `.env` file exists in the project root
2. Verify all required variables are present:
   - `NIGHTSCOUT_URL`
   - `NIGHTSCOUT_ACCESS_TOKEN`
3. Copy from `.env.example` if needed: `cp .env.example .env`
4. Restart the server after updating `.env`

### Invalid URL Format

**Error Message:**
```
Configuration error: NIGHTSCOUT_URL must be a valid URL with https://
```

**Cause:** The `NIGHTSCOUT_URL` is not a properly formatted HTTPS URL.

**Solution:**
1. Ensure the URL starts with `https://` (not `http://`)
2. Example: `NIGHTSCOUT_URL=https://your-nightscout.herokuapp.com`
3. Do not include trailing slashes or path segments

### Invalid Port Number

**Error Message:**
```
Configuration error: PORT must be a number between 1 and 65535
```

**Cause:** The `PORT` environment variable is not a valid port number.

**Solution:**
1. Use a number between 1024 and 65535 (recommended)
2. Example: `PORT=8000`
3. Avoid privileged ports (1-1023) unless running with appropriate permissions

## Authentication Errors

### Invalid Access Token

**Error Message:**
```
Failed to get JWT token: 401 Unauthorized
```

**Cause:** The NightScout access token is incorrect or has been revoked.

**Solution:**
1. Log into your NightScout instance
2. Navigate to **Admin Tools** → **Security**
3. Verify the token exists and has the correct permissions
4. Generate a new token if needed
5. Update `NIGHTSCOUT_ACCESS_TOKEN` in your `.env` file
6. Restart the server

### Insufficient Permissions

**Error Message:**
```
Failed to fetch entries: 403 Forbidden
```

**Cause:** The access token doesn't have the required permissions.

**Solution:**
1. Ensure the token has `read` permissions for entries
2. In NightScout Admin Tools → Security, check token permissions
3. Create a new token with appropriate permissions if needed

### Token Expired

**Error Message:**
```
Authentication failed: Token expired
```

**Cause:** The access token has expired (if tokens have expiration configured).

**Solution:**
1. Generate a new access token from NightScout
2. Update your `.env` file
3. Restart the server

## API Errors

### NightScout Server Unreachable

**Error Message:**
```
Failed to fetch entries: ECONNREFUSED
```

**Cause:** Cannot connect to the NightScout server.

**Solution:**
1. Verify `NIGHTSCOUT_URL` is correct
2. Check that your NightScout instance is running
3. Test the URL in a browser
4. Check your network connection
5. Verify firewall rules allow outbound HTTPS connections

### Internal Server Error

**Error Message:**
```
Failed to fetch entries: 500 Internal Server Error
```

**Cause:** NightScout server encountered an error.

**Solution:**
1. Check NightScout server logs
2. Verify NightScout instance is functioning properly
3. Try accessing NightScout directly in a browser
4. Contact your NightScout administrator

### Rate Limiting

**Error Message:**
```
Failed to fetch entries: 429 Too Many Requests
```

**Cause:** Too many requests sent to NightScout API.

**Solution:**
1. Implement request throttling in your client
2. Reduce the frequency of API calls
3. Check if multiple clients are using the same token
4. Wait before retrying (check `Retry-After` header if present)

## Request Errors

### Invalid Date Range

**Error Message:**
```
Invalid date range: startDate must be before endDate
```

**Cause:** The `startDate` parameter is after the `endDate` parameter.

**Solution:**
1. Verify date parameters are in correct order
2. Use ISO 8601 format: `YYYY-MM-DD` or full timestamps
3. Example: `startDate: "2024-01-01", endDate: "2024-01-31"`

### Invalid Date Format

**Error Message:**
```
Invalid date format: Unable to parse date
```

**Cause:** Date parameter is not in a recognized format.

**Solution:**
1. Use ISO 8601 format: `YYYY-MM-DD` or `YYYY-MM-DDTHH:mm:ss.sssZ`
2. Examples:
   - `"2024-01-01"`
   - `"2024-01-01T00:00:00.000Z"`
   - `1704067200000` (Unix timestamp in milliseconds)

### Limit Exceeded

**Error Message:**
```
Limit exceeds maximum allowed value of 10000
```

**Cause:** The `limit` parameter exceeds the maximum allowed value.

**Solution:**
1. Use a limit value between 1 and 10000
2. For large datasets, make multiple requests with different date ranges
3. Default limit is 1000 if not specified

### Missing Required Parameters

**Error Message:**
```
Missing required parameter: name
```

**Cause:** A required parameter was not included in the request.

**Solution:**
1. Check the tool's input schema using `tools/list`
2. Include all required parameters
3. Ensure parameter names are spelled correctly

## OAuth Errors

### Invalid Client ID

**Error Message:**
```
OAuth error: Invalid client_id
```

**Cause:** The `client_id` is not recognized by the server.

**Solution:**
1. Verify `COGNITO_APP_CLIENT_ID` in your `.env` file
2. Check the client ID in AWS Cognito console
3. Ensure the client is properly configured

### Invalid Redirect URI

**Error Message:**
```
OAuth error: redirect_uri mismatch
```

**Cause:** The redirect URI doesn't match what's configured in Cognito.

**Solution:**
1. Check allowed callback URLs in Cognito app client settings
2. Ensure exact match including protocol, domain, and path
3. URL-encode the redirect URI in the authorization request

### Invalid Code Verifier

**Error Message:**
```
OAuth error: Invalid code_verifier
```

**Cause:** PKCE code verifier doesn't match the code challenge.

**Solution:**
1. Ensure you're using the same verifier that generated the challenge
2. Use S256 (SHA-256) as the code challenge method
3. Verify the verifier is properly generated (43-128 character random string)

## Runtime Errors

### Server Exits Immediately

**Symptoms:** Server starts but exits without error message.

**Possible Causes:**
1. Configuration validation failed
2. Port already in use
3. Permission denied for port binding

**Solutions:**
1. Check server logs for error messages
2. Verify all environment variables in `.env`
3. Try a different port (e.g., 8080 instead of 8000)
4. Check if another process is using the port:
   - Linux/Mac: `lsof -i :8000`
   - Windows: `netstat -ano | findstr :8000`
5. Run with elevated permissions if using port < 1024

### Out of Memory

**Error Message:**
```
JavaScript heap out of memory
```

**Cause:** Server ran out of memory, possibly due to large response from NightScout.

**Solution:**
1. Reduce the `limit` parameter in requests
2. Use smaller date ranges
3. Increase Node.js memory limit:
   ```bash
   NODE_OPTIONS="--max-old-space-size=4096" npm start
   ```
4. For Docker, increase container memory limit

## Docker-Specific Errors

### Container Exits Immediately

**Symptoms:** Docker container stops right after starting.

**Solution:**
```bash
# Check container logs
docker logs nightscout-mcp

# Verify environment variables are passed
docker run --env-file .env nightscout-mcp-server

# Check if .env file exists and has correct variables
cat .env
```

### Cannot Connect to Container

**Symptoms:** Server runs but cannot be reached from host.

**Solution:**
1. Ensure `HOST=0.0.0.0` in `.env` for Docker
2. Verify port mapping: `-p 8000:8000`
3. Check Docker network settings
4. Test from inside container:
   ```bash
   docker exec nightscout-mcp curl http://localhost:8000/mcp
   ```

### Environment Variables Not Loading

**Symptoms:** Configuration errors despite having `.env` file.

**Solution:**
1. Use `--env-file` flag: `docker run --env-file .env ...`
2. Alternatively, pass variables individually:
   ```bash
   docker run -e NIGHTSCOUT_URL=... -e NIGHTSCOUT_ACCESS_TOKEN=...
   ```
3. Verify `.env` file format (no spaces around `=`)

## Troubleshooting Checklist

### Server Won't Start

- [ ] `.env` file exists in project root
- [ ] All required environment variables are set
- [ ] `NIGHTSCOUT_URL` is a valid HTTPS URL
- [ ] Port is not in use by another process
- [ ] Dependencies are installed (`npm install`)
- [ ] Project is built (`npm run build`)

### Authentication Fails

- [ ] Access token is correct and not expired
- [ ] Token has `read` permissions for entries
- [ ] NightScout instance supports API access
- [ ] NightScout URL is accessible from server

### No Data Returned

- [ ] Date range parameters are valid
- [ ] Data exists in NightScout for the specified period
- [ ] Token has permissions to read entries
- [ ] NightScout server is responding correctly
- [ ] Check NightScout logs for errors

### OAuth Not Working

- [ ] Cognito configuration is complete in `.env`
- [ ] Custom attributes exist in Cognito User Pool
- [ ] User has custom attributes set
- [ ] Redirect URIs match exactly
- [ ] PKCE verifier/challenge are properly generated

## Getting Help

If you're still experiencing issues:

1. **Check the logs** - Enable debug logging: `LOG_LEVEL=debug`
2. **Search existing issues** - Check GitHub issues for similar problems
3. **Create a new issue** - Include:
   - Error messages (sanitize sensitive data)
   - Steps to reproduce
   - Environment details (Node version, OS, Docker version)
   - Relevant configuration (without secrets)

## Further Reading

- [Configuration Reference](../README.md#configuration)
- [OAuth Setup Guide](oauth-setup.md)
- [MCP Integration Guide](mcp-integration.md)
