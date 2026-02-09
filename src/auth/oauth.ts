import { OAuthMetadata } from '@modelcontextprotocol/sdk/shared/auth.js';
import { COGNITO } from '../config.js';

export function createOAuthUrls() {
  const region = COGNITO.region;
  const userPoolId = COGNITO.userPoolId;
  const domain = COGNITO.domain;

  if (!userPoolId) {
    throw new Error('Missing COGNITO_USER_POOL_ID in environment');
  }

  const issuer = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`;
  const hosted = domain.startsWith('https://') ? domain : `https://${domain}`;

  return {
    issuer,
    authorization_endpoint: `${hosted}/oauth2/authorize`,
    token_endpoint: `${hosted}/oauth2/token`,
    userinfo_endpoint: `${hosted}/oauth2/userInfo`,
  } as Partial<OAuthMetadata> as OAuthMetadata;
}

export const oauthMetadata: OAuthMetadata = {
  ...createOAuthUrls(),
  response_types_supported: ['code'],
  grant_types_supported: ['authorization_code', 'refresh_token'],
  scopes_supported: ['openid', 'email', 'profile'],
  code_challenge_methods_supported: ['S256'], // PKCE support
};
