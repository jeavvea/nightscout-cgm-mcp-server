import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { logger } from '../utils/logger.js';

/**
 * Registers the estimate-carbs prompt with the MCP server
 * This prompt helps users estimate carbohydrate content in food descriptions
 */
export function registerEstimateCarbsPrompt(server: McpServer) {
  logger.debug('[PROMPT] Registering estimate-carbs prompt');

  server.registerPrompt(
    'estimate-carbs',
    {
      title: 'Estimate Carbohydrates',
      description: 'Estimate the carbohydrate content of a food item or meal based on a description',
      argsSchema: {
        foodDescription: z.string()
          .min(1)
          .describe('Description of the food or meal (e.g., "a medium apple", "bowl of pasta with tomato sauce", "2 slices of whole wheat bread with peanut butter")'),
        units: z.enum(['grams', 'exchanges', 'both'])
          .optional()
          .describe('Preferred unit for carbohydrate estimation (grams, exchanges, or both)'),
        confidence: z.string()
          .optional()
          .describe('Include confidence level in the estimate (true/false)'),
      }
    },
    ({ foodDescription, units, confidence }) => {
      logger.debug('[PROMPT] estimate-carbs invoked', { foodDescription, units, confidence });

      const unitsPreference = units || 'grams';
      const includeConfidence = confidence !== 'false';

      // Build the prompt message
      let promptText = `You are a nutrition expert specializing in carbohydrate estimation for diabetes management. `;
      promptText += `Please analyze the following food description and provide an accurate carbohydrate estimate.\n\n`;
      promptText += `Food Description: ${foodDescription}\n\n`;
      promptText += `Please provide:\n`;
      promptText += `1. Total carbohydrate estimate`;
      
      if (unitsPreference === 'grams' || unitsPreference === 'both') {
        promptText += ` in grams`;
      }
      if (unitsPreference === 'both') {
        promptText += ` AND`;
      }
      if (unitsPreference === 'exchanges' || unitsPreference === 'both') {
        promptText += ` in carbohydrate exchanges (15g = 1 exchange)`;
      }
      
      promptText += `\n2. Breakdown of individual components if multiple items are mentioned\n`;
      promptText += `3. Key assumptions made (e.g., serving sizes, preparation methods)\n`;
      
      if (includeConfidence) {
        promptText += `4. Confidence level (high/medium/low) based on specificity of the description\n`;
      }
      
      promptText += `\nFormat your response clearly with the total at the top, followed by the detailed breakdown.\n`;
      promptText += `Be conservative in your estimates when dealing with ambiguous descriptions to help avoid hyperglycemia.`;

      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: promptText,
            },
          },
        ],
      };
    }
  );

  logger.info('[PROMPT] estimate-carbs prompt registered successfully');
}
