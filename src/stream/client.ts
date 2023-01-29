import type { createClient } from 'redis';
import { ErrorReply } from 'redis';
import { v4 as uuidv4 } from 'uuid';

/**
  * Client provides an API for interacting with the stream. The current
  * implemenation utilizes Redis Streams. 
  * https://redis.io/docs/data-types/streams/
  */
export class Client {
  protected redisClient: ReturnType<typeof createClient>;
  protected group: string;
  protected consumer: string = uuidv4();
  protected claimStart = '0-0';

  private constructor(redisClient: ReturnType<typeof createClient>, group: string) {
    this.redisClient = redisClient;
    this.group = group;
  }

  /**
    * initialize creates and intializes a new stream Client listening to the
    * specified group.
    */
  static async initialize(
    redisClient: ReturnType<typeof createClient>,
    group: string,
  ): Promise<Client> {
    // NOTE: The start constant below is 0, meaning the newly created group will
    // start at the very beginning of the stream. This is not an issue because
    // we later read the stream utilizing the ">" special ID. This ID results
    // messages being read that have "never been delivered to any other
    // "consumer". https://redis.io/commands/xreadgroup/
    createGroup:
    try {
      await redisClient.xGroupCreate(stream, group, start, { MKSTREAM: true });
    } catch (err) {
      if (err instanceof ErrorReply) {
        // Group with the specified name already exists, no issue, simply 
        // proceed.
        if (err.message === 'BUSYGROUP Consumer Group name already exists') {
          break createGroup;
        }
      }
      throw err;
    }
    return new Client(redisClient, group);
  }

  /**
    * write Writes the passed message to the Client's stream group.
    */
  async write(message: string) {
    await this.redisClient.xAdd(
      stream,
      '*',
      { payload: message },
      {
        TRIM: {
          strategy: 'MAXLEN',
          strategyModifier: '~',
          threshold: maxLen,
        }
      }
    );
  }

  /**
    * read Reads from the Client's stream group. This loops infinitely until a
    * read is performed.
    */
  async read() {
    const second = 1000;
    const minute = 60 * second;
    const hour = 60 * minute;

    let resp: StreamsMessagesReply;
    for (;;) {
      resp = await this.redisClient.xReadGroup(
        this.group,
        this.consumer,
        { key: stream, id: '>' },
        { COUNT: 1, BLOCK: 24 * hour },
      )

      // If no response is received, re-attempt read. The read operation should 
      // be blocking for an extended period of time based on XREADGROUP's BLOCK
      // arguement.
      if (!resp) continue;

      break;
    }

    if (resp?.length !== 1) {
      throw new Error('Stream read group did not return a single stream');
    }

    const messages = resp[0]?.messages;
    if (!messages) {
      throw new Error('Stream read group did not return a stream message');
    }

    return this.extractMessage(messages);
  }

  /**
    * claim reads a message from the Client's stream that has been read by 
    * another consumer, but has not been acknowledged for the number of
    * milliseconds passed as idle. 
    * @param idle - The duration of time (in milliseconds) that has passed 
    *               since a message was initially read that has since not been
    *               acknowledged.
    * @return The claimed stream message if one exists to be claimed. If a 
    *         message does not exist to be claimed, return null.
    */
  async claim(idle: number = 1000 * 60): Promise<StreamMessage | null> {
    const resp = await this.redisClient.xAutoClaim(
      stream,
      this.group,
      this.consumer,
      idle,
      this.claimStart,
      { COUNT: 1 },
    );

    if (resp.messages.length === 0) {
      return null;
    }

    this.claimStart = resp.nextId;
    return this.extractMessage(resp.messages);
  }

  /**
    * claimRead is a helper that calls claim, followed by read ensuring no
    * idle messages are available for pending before processing other messages.
    */
  async claimRead(idle: number = 1000 * 60): Promise<StreamMessage> {
    const claimed = await this.claim(idle)
    if (claimed !== null) {
      return claimed;
    }

    return await this.read();
  }

  /**
    * ack acknowledges the messaged passed. Any given message should only be 
    * acknowledged once.
    */
  async ack(message: StreamMessage) {
    await this.redisClient.xAck(stream, this.group, message.id)
  }

  private extractMessage(streamMessages: StreamMessagesReply): StreamMessage {
    if (streamMessages?.length !== 1) {
      throw new Error('Stream did not return a single message');
    }
    const streamMessage = streamMessages[0];

    const payload = streamMessage?.message['payload'];
    if (!payload) {
      throw new Error('Stream did not return a message payload');
    }

    const id = streamMessage?.id;
    if (!id) {
      throw new Error('Stream did not return a message id');
    }

    return {
      id: id as string,
      payload: payload as string,
    }
  }
}

// StreamMessage is a message read from the event stream.
export interface StreamMessage {
  id: string;
  payload: string;
}

// stream is the stream group utilized within the Rustpm system to communicate inter-service events.
const stream = 'interserviceEventStream';

// start is the first entry of the stream.
const start = '0';

// maxLen is the threshold of a Redis Stream. If the number of items within the
// stream are beyond this, old enteries will be evicted.
const maxLen = 20000;

// StreamsMessagesReply has been copied & pasted here from a @redis/client
// sub-module since it is not accessible via the standard exports.
type StreamsMessagesReply = Array<{
  name: RedisCommandArgument;
  messages: StreamMessagesReply;
}> | null;

// StreamMessagesReply has been copied & pasted here from a @redis/client
// sub-module since it is not accessible via the standard exports.
type StreamMessagesReply = Array<StreamMessageReply>;

// StreamMessageReply has been copied & pasted here from a @redis/client
// sub-module since it is not accessible via the standard exports.
interface StreamMessageReply {
  id: RedisCommandArgument;
  message: Record<string, RedisCommandArgument>;
}

// RedisCommandArgument has been copied & pasted here from a @redis/client
// sub-module since it is not accessible via the standard exports.
type RedisCommandArgument = string | Buffer;
