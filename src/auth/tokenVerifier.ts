import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';
import { COGNITO } from '../config.js';
import { logger } from '../utils/logger.js';
import type express from 'express';

type RemoteJwks = ReturnType<typeof createRemoteJWKSet>;
const jwksCache: Record<string, RemoteJwks> = {};

function getIssuer(): string {
  if (!COGNITO.userPoolId) {
    throw new Error('COGNITO_USER_POOL_ID is not configured');
  }
  return `https://cognito-idp.${COGNITO.region}.amazonaws.com/${COGNITO.userPoolId}`;
}

function getJwks(): RemoteJwks {
  const issuer = getIssuer();
  if (!jwksCache[issuer]) {
    jwksCache[issuer] = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
  }
  return jwksCache[issuer];
}

export interface VerifiedAuthInfo {
  token: string;
  clientId: string;
  scopes: string[];
  expiresAt?: number | undefined;
}

export async function verifyAccessToken(token: string): Promise<VerifiedAuthInfo> {
  const expectedClientId = COGNITO.appClientId;
  const issuer = getIssuer();
  const jwks = getJwks();

  let payload: JWTPayload;
  try {
    const { payload: verified } = await jwtVerify(token, jwks, {
      issuer,
      clockTolerance: '60s',
    });
    payload = verified;
  } catch (e) {
    logger.error('[auth] JWT verification failed', { error: e });
    const err = new Error('Invalid or expired token');
    (err as any).status = 401;
    (err as any).code = 'invalid_token'; // Use a standard code
    throw err;
  }

  if (payload.token_use !== 'access') {
    throw new Error('Invalid token type; expected access token');
  }

  const clientIdFromToken = (payload.client_id || payload.aud) as string | undefined;
  if (expectedClientId && clientIdFromToken && clientIdFromToken !== expectedClientId) {
    throw new Error('Token client_id does not match configured application client');
  }

  const clientId = clientIdFromToken || expectedClientId;
  if (!clientId) {
    throw new Error('Could not determine client_id from token or configuration');
  }

  const scopes = typeof payload.scope === 'string' ? payload.scope.split(' ') : [];
  return {
    token,
    clientId,
    scopes,
    expiresAt: payload.exp,
  };
}

export async function getUsernameFromRequest(req: express.Request): Promise<string> {
  const authHeader = (req.headers['authorization'] || req.headers['Authorization']) as string | undefined;
  if (!authHeader) throw new Error('Missing Authorization header');
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new Error('Invalid Authorization header format');
  const token = match[1];

  const issuer = getIssuer();
  const jwks = getJwks();

  const { payload } = await jwtVerify(token, jwks, { issuer, clockTolerance: '60s' });
  const username = (payload as any).username || (payload as any)['cognito:username'] || payload.sub;
  if (!username || typeof username !== 'string') {
    throw new Error('Unable to determine username from token');
  }
  return username;
}
