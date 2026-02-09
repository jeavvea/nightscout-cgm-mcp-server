import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { NightScoutClient } from '../services/nightscoutService.js';
import { getNightscoutAttrs } from '../services/cognitoUserService.js';
import { logger } from '../utils/logger.js';

export function registerAddCarbTreatmentTool(
  server: McpServer,
  sessionUser: { username: string }
) {
  const AddCarbTreatmentSchema = z.object({
    carbs: z.coerce.number().positive(),
    eventType: z.enum(['Carb Correction', 'Meal Bolus', 'Snack Bolus']).optional(),
    created_at: z.string().optional(),
    notes: z.string().optional(),
    enteredBy: z.string().optional(),
  });

  server.registerTool(
    'add_carb_treatment',
    {
      title: 'Add Carbohydrate Treatment',
      description: 'Adds a carbohydrate treatment entry to NightScout. This records carbohydrate intake without insulin.',
      inputSchema: {
        carbs: z.number()
          .positive()
          .describe('Amount of carbohydrates in grams (must be positive)'),
        eventType: z.enum(['Carb Correction', 'Meal Bolus', 'Snack Bolus'])
          .optional()
          .describe('Type of carbohydrate event (defaults to "Carb Correction")'),
        created_at: z.string()
          .optional()
          .describe('ISO 8601 date string for when the carbs were consumed (defaults to current time)'),
        notes: z.string()
          .optional()
          .describe('Optional notes about the carbohydrate intake'),
        enteredBy: z.string()
          .optional()
          .describe('Name of person entering the data (defaults to "MCP Server")'),
      },
      outputSchema: {
        success: z.boolean(),
        treatmentId: z.string(),
        eventType: z.string(),
        carbs: z.number(),
        created_at: z.string(),
        notes: z.string().optional(),
        enteredBy: z.string().optional(),
      },
    },
    async (args: any, extra?: { sessionId?: string }) => {
      logger.debug('[TOOL] add_carb_treatment called');

      const validatedArgs = AddCarbTreatmentSchema.parse(args);
      logger.debug('[TOOL] Arguments validated', validatedArgs);

      try {
        const username = sessionUser.username;
        logger.debug('[TOOL] Fetching Nightscout credentials from Cognito for user', { username });
        if (extra?.sessionId) {
          await server.sendLoggingMessage({ level: 'info', data: 'Fetching Nightscout credentials' }, extra.sessionId);
        }
        const { baseUrl, accessToken } = await getNightscoutAttrs(username);
        logger.debug('[TOOL] Nightscout credentials retrieved', { baseUrl, hasToken: !!accessToken });

        const nightscoutClient = new NightScoutClient(baseUrl, accessToken);
        
        const treatment = {
          eventType: validatedArgs.eventType || 'Carb Correction',
          carbs: validatedArgs.carbs,
          created_at: validatedArgs.created_at,
          notes: validatedArgs.notes,
          enteredBy: validatedArgs.enteredBy || 'MCP Server',
        };

        logger.debug('[TOOL] Adding treatment to Nightscout', treatment);
        if (extra?.sessionId) {
          await server.sendLoggingMessage({ 
            level: 'info', 
            data: `Adding ${treatment.carbs}g carbs to Nightscout` 
          }, extra.sessionId);
        }

        const result = await nightscoutClient.addTreatment(treatment);
        logger.info('[TOOL] Successfully added treatment', { result });
        if (extra?.sessionId) {
          await server.sendLoggingMessage({ 
            level: 'info', 
            data: `Successfully added treatment: ${JSON.stringify(result)}` 
          }, extra.sessionId);
        }

        // Handle response - Nightscout may return an array or single object
        const treatmentData = Array.isArray(result) ? result[0] : result;
        
        if (!treatmentData) {
          throw new Error('No treatment data returned from Nightscout');
        }

        logger.debug('[TOOL] Treatment data extracted', { treatmentData });

        const output: {
          success: boolean;
          treatmentId: string;
          eventType: string;
          carbs: number;
          created_at: string;
          notes?: string;
          enteredBy?: string;
        } = {
          success: true,
          treatmentId: treatmentData._id || 'unknown',
          eventType: treatmentData.eventType || treatment.eventType,
          carbs: Number(treatmentData.carbs) || treatment.carbs,
          created_at: treatmentData.created_at || treatment.created_at || new Date().toISOString(),
        };

        // Add optional fields only if they exist
        if (treatmentData.notes || treatment.notes) {
          output.notes = treatmentData.notes || treatment.notes;
        }
        if (treatmentData.enteredBy || treatment.enteredBy) {
          output.enteredBy = treatmentData.enteredBy || treatment.enteredBy;
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(output, null, 2),
            },
          ],
          structuredContent: output,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error('[TOOL] Error adding carb treatment', { error: errorMessage });
        if (extra?.sessionId) {
          try {
            await server.sendLoggingMessage({ 
              level: 'error', 
              data: `Failed to add treatment: ${errorMessage}` 
            }, extra.sessionId);
          } catch {}
        }
        throw new Error(`Failed to add carb treatment: ${errorMessage}`);
      }
    }
  );
}
