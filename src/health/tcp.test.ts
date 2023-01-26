import net from 'net';
import { Tcp } from './tcp.js';

describe('Tcp', () => {
  test('connect', async () => {
    const healthCheck = new Tcp();
    await healthCheck.listen(8080);

    await new Promise<void>((resolve) => {
      net.createConnection({ port: 8080 }, () => {
        resolve();
      })
    });
    await healthCheck.shutdown();
  })
});
