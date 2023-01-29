import { createLogger, format, transports } from 'winston';

export default createLogger({
  format: format.json(),
  defaultMeta: { service: 'bot' },
  transports: [
    new transports.Console(),
  ],
});
