import {
  CognitoIdentityProviderClient,
  AdminGetUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { logger } from '../utils/logger.js';

const client = new CognitoIdentityProviderClient({ region: process.env.COGNITO_REGION || 'eu-west-1' });

export type NightscoutAttrs = {
  baseUrl: string;
  accessToken: string; // demo-only sensitive
};

export async function getNightscoutAttrs(username: string): Promise<NightscoutAttrs> {
  const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID!;
  logger.debug('[COGNITO] Fetching user attributes', { username, userPoolId: USER_POOL_ID });
  
  try {
    const out = await client.send(
      new AdminGetUserCommand({ UserPoolId: USER_POOL_ID, Username: username })
    );
    logger.debug('[COGNITO] User attributes retrieved', { 
      username, 
      attributeCount: out.UserAttributes?.length,
      userStatus: out.UserStatus 
    });

    const map = Object.fromEntries((out.UserAttributes ?? []).map(a => [a.Name!, a.Value ?? '']));
    logger.debug('[COGNITO] Parsed attributes', { 
      hasBaseUrl: !!map['custom:nightscout_base_url'],
      hasAccessToken: !!map['custom:nightscout_token'],
      availableAttributes: Object.keys(map)
    });
    
    const baseUrl = map['custom:nightscout_base_url'];
    const accessToken = map['custom:nightscout_token'];

    if (!baseUrl) {
      logger.error('[COGNITO] Missing custom:nightscout_base_url for user', { username });
      throw new Error('Missing custom:nightscout_base_url');
    }
    if (!accessToken) {
      logger.error('[COGNITO] Missing custom:nightscout_token for user', { username });
      throw new Error('Missing custom:nightscout_token');
    }

    logger.debug('[COGNITO] Nightscout attributes found', { 
      baseUrl, 
      hasAccessToken: !!accessToken 
    });

    return { baseUrl, accessToken };
  } catch (error) {
    logger.error('[COGNITO] Error fetching user attributes', {
      username,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}
