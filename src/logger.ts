import { createLogger, format, transports } from 'winston';

export default logger = createLogger({
  format: format.json(),
  defaultMeta: { service: 'bot' },
  transports: [
    new transports.Console(),
  ],
});
