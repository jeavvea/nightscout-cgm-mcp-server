import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { NightScoutClient } from '../services/nightscoutService.js';
import { formatEntriesToCompact } from '../utils/glucoseFormat.js';
import { getNightscoutAttrs } from '../services/cognitoUserService.js';
import { logger } from '../utils/logger.js';

export function registerGetGlucoseEntriesTool(
  server: McpServer,
  sessionUser: { username: string }
) {
  const GetGlucoseEntriesSchema = z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    limit: z.number().int().positive().max(10000).optional(),
  });

  server.registerTool(
    'get_glucose_entries',
    {
      title: 'Get Glucose Entries',
      description: 'Retrieves blood glucose entries from NightScout for the last 24 hours by default, or within a specified date range.',
      inputSchema: {
        startDate: z.string()
          .optional()
          .describe('ISO 8601 date string or timestamp (defaults to 24 hours ago)'),
        endDate: z.string()
          .optional()
          .describe('ISO 8601 date string or timestamp (defaults to now)'),
        limit: z.number()
          .int()
          .positive()
          .max(10000)
          .optional()
          .describe('Maximum number of entries (default 1000)'),
      },
      outputSchema: {
        unit: z.enum(['mmol/l', 'mg/dl']),
        utcOffset: z.number(),
        blood_glucose_readings: z.array(z.object({
          value: z.number(),
          direction: z.string().optional(),
          dateString: z.string(),
        })),
        count: z.number(),
        startDate: z.number(),
        endDate: z.number(),
      },
    },
    async (args: any, extra?: { sessionId?: string }) => {
      logger.debug('[TOOL] get_glucose_entries called');

      const validatedArgs = GetGlucoseEntriesSchema.parse(args);
      logger.debug('[TOOL] Arguments validated', validatedArgs);

      const now = Date.now();
      const oneDayAgo = now - 24 * 60 * 60 * 1000;

      const startDate = validatedArgs.startDate ? new Date(validatedArgs.startDate).getTime() : oneDayAgo;
      const endDate = validatedArgs.endDate ? new Date(validatedArgs.endDate).getTime() : now;
      const limit = validatedArgs.limit || 1000;

      try {
        const username = sessionUser.username;
        logger.debug('[TOOL] Fetching Nightscout credentials from Cognito for user', { username });
        if (extra?.sessionId) {
          await server.sendLoggingMessage({ level: 'info', data: 'Fetching Nightscout credentials' }, extra.sessionId);
        }
        const { baseUrl, accessToken } = await getNightscoutAttrs(username);
        logger.debug('[TOOL] Nightscout credentials retrieved', { baseUrl, hasToken: !!accessToken });

        const nightscoutClient = new NightScoutClient(baseUrl, accessToken);
        logger.debug('[TOOL] Fetching entries from Nightscout', { startDate, endDate, limit });

        const entries = await nightscoutClient.getEntries(startDate, endDate, limit);
        logger.info('[TOOL] Successfully fetched entries', { count: entries.length });
        if (extra?.sessionId) {
          await server.sendLoggingMessage({ level: 'info', data: `Fetched ${entries.length} entries` }, extra.sessionId);
        }

        const output = formatEntriesToCompact(entries, 'mmol/l', startDate, endDate);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(output),
            },
          ],
          structuredContent: output,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error('[TOOL] Error fetching glucose entries', { error: errorMessage });
        if (extra?.sessionId) {
          try {
            await server.sendLoggingMessage({ level: 'error', data: `Failed to fetch entries: ${errorMessage}` }, extra.sessionId);
          } catch {}
        }
        throw new Error(`Failed to fetch glucose entries: ${errorMessage}`);
      }
    }
  );
}
