import { createLogger, format, transports } from 'winston';

const level = (process.env.LOG_LEVEL || 'info').toLowerCase();

export const logger = createLogger({
  level,
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.splat(),
    format.json()
  ),
  defaultMeta: { service: 'nightscout-mcp-server' },
  transports: [
    new transports.Console({
      handleExceptions: true,
    }),
  ],
});

// Graceful shutdown helper for transports
export async function flushLogger(): Promise<void> {
  return new Promise((resolve) => {
    logger.on('finish', resolve);
    logger.end();
  });
}
