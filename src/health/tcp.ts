import net, { Server, Socket } from 'net';

export class Tcp {
  private server: Server

  constructor() {
    const server = net.createServer((conn: Socket) => {
      conn.end();
    });
    this.server = server;
  }

  async listen(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.once('error', () => {
        reject();
      });
      this.server.listen(port, () => {
        resolve();
      });
    });
  }

  async shutdown(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.close((err?: Error | undefined) => {
        if (err != null) {
          reject(err);
        }
        resolve();
      });
    });
  }
}
