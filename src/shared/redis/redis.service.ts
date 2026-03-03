import { Inject, Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name);

  constructor(@Inject('REDIS_CLIENT') private readonly redisClient: Redis) {}

  // ============ STRING OPERATIONS ============

  async set(key: string, value: any, ttl?: number): Promise<void> {
    const stringValue =
      typeof value === 'string' ? value : JSON.stringify(value);

    if (ttl) {
      await this.redisClient.setex(key, ttl, stringValue);
    } else {
      await this.redisClient.set(key, stringValue);
    }
  }

  async get<T = any>(key: string): Promise<T | null> {
    const value = await this.redisClient.get(key);

    if (!value) return null;

    try {
      return JSON.parse(value) as T;
    } catch {
      return value as T;
    }
  }

  async delete(key: string): Promise<void> {
    await this.redisClient.del(key);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.redisClient.exists(key);
    return result === 1;
  }

  async expire(key: string, ttl: number): Promise<void> {
    await this.redisClient.expire(key, ttl);
  }

  async ttl(key: string): Promise<number> {
    return this.redisClient.ttl(key);
  }

  // ============ HASH OPERATIONS ============

  async hset(key: string, field: string, value: any): Promise<void> {
    const stringValue =
      typeof value === 'string' ? value : JSON.stringify(value);
    await this.redisClient.hset(key, field, stringValue);
  }

  async hget<T = any>(key: string, field: string): Promise<T | null> {
    const value = await this.redisClient.hget(key, field);

    if (!value) return null;

    try {
      return JSON.parse(value) as T;
    } catch {
      return value as T;
    }
  }

  async hgetall<T = any>(key: string): Promise<Record<string, T>> {
    const result = await this.redisClient.hgetall(key);
    const parsed: Record<string, T> = {};

    for (const [field, value] of Object.entries(result)) {
      try {
        parsed[field] = JSON.parse(value) as T;
      } catch {
        parsed[field] = value as T;
      }
    }

    return parsed;
  }

  async hdel(key: string, field: string): Promise<void> {
    await this.redisClient.hdel(key, field);
  }

  // ============ LIST OPERATIONS ============

  async lpush(key: string, value: any): Promise<void> {
    const stringValue =
      typeof value === 'string' ? value : JSON.stringify(value);
    await this.redisClient.lpush(key, stringValue);
  }

  async rpush(key: string, value: any): Promise<void> {
    const stringValue =
      typeof value === 'string' ? value : JSON.stringify(value);
    await this.redisClient.rpush(key, stringValue);
  }

  async lpop<T = any>(key: string): Promise<T | null> {
    const value = await this.redisClient.lpop(key);

    if (!value) return null;

    try {
      return JSON.parse(value) as T;
    } catch {
      return value as T;
    }
  }

  async rpop<T = any>(key: string): Promise<T | null> {
    const value = await this.redisClient.rpop(key);

    if (!value) return null;

    try {
      return JSON.parse(value) as T;
    } catch {
      return value as T;
    }
  }

  async lrange<T = any>(
    key: string,
    start: number,
    stop: number,
  ): Promise<T[]> {
    const values = await this.redisClient.lrange(key, start, stop);

    return values.map((value) => {
      try {
        return JSON.parse(value) as T;
      } catch {
        return value as T;
      }
    });
  }

  // ============ SET OPERATIONS ============

  async sadd(key: string, value: any): Promise<void> {
    const stringValue =
      typeof value === 'string' ? value : JSON.stringify(value);
    await this.redisClient.sadd(key, stringValue);
  }

  async srem(key: string, value: any): Promise<void> {
    const stringValue =
      typeof value === 'string' ? value : JSON.stringify(value);
    await this.redisClient.srem(key, stringValue);
  }

  async smembers<T = any>(key: string): Promise<T[]> {
    const values = await this.redisClient.smembers(key);

    return values.map((value) => {
      try {
        return JSON.parse(value) as T;
      } catch {
        return value as T;
      }
    });
  }

  async sismember(key: string, value: any): Promise<boolean> {
    const stringValue =
      typeof value === 'string' ? value : JSON.stringify(value);
    const result = await this.redisClient.sismember(key, stringValue);
    return result === 1;
  }

  // ============ SORTED SET OPERATIONS ============

  async zadd(key: string, score: number, value: any): Promise<void> {
    const stringValue =
      typeof value === 'string' ? value : JSON.stringify(value);
    await this.redisClient.zadd(key, score, stringValue);
  }

  async zrem(key: string, value: any): Promise<void> {
    const stringValue =
      typeof value === 'string' ? value : JSON.stringify(value);
    await this.redisClient.zrem(key, stringValue);
  }

  async zrange<T = any>(
    key: string,
    start: number,
    stop: number,
    withScores = false,
  ): Promise<T[]> {
    let values: string[];

    if (withScores) {
      values = await this.redisClient.zrange(key, start, stop, 'WITHSCORES');
    } else {
      values = await this.redisClient.zrange(key, start, stop);
    }

    return values.map((value) => {
      try {
        return JSON.parse(value) as T;
      } catch {
        return value as T;
      }
    });
  }

  async zscore(key: string, value: any): Promise<number | null> {
    const stringValue =
      typeof value === 'string' ? value : JSON.stringify(value);
    const score = await this.redisClient.zscore(key, stringValue);
    return score ? parseFloat(score) : null;
  }

  // ============ PUB/SUB ============

  async publish(channel: string, message: any): Promise<void> {
    const stringMessage =
      typeof message === 'string' ? message : JSON.stringify(message);
    await this.redisClient.publish(channel, stringMessage);
  }

  subscribe(channel: string, callback: (message: any) => void): void {
    const subscriber = this.redisClient.duplicate();

    subscriber.subscribe(channel, (err) => {
      if (err) {
        this.logger.error(
          `Failed to subscribe to channel ${channel}: ${err.message}`,
        );
      }
    });

    subscriber.on('message', (ch, message) => {
      if (ch === channel) {
        try {
          callback(JSON.parse(message));
        } catch {
          callback(message);
        }
      }
    });
  }

  // ============ LOCKING ============

  async acquireLock(lockKey: string, ttl: number = 10): Promise<boolean> {
    const result = await this.redisClient.set(lockKey, 'locked', 'EX', ttl);
    return result === 'OK';
  }

  async releaseLock(lockKey: string): Promise<void> {
    await this.redisClient.del(lockKey);
  }

  // ============ UTILITY ============

  async flushAll(): Promise<void> {
    await this.redisClient.flushall();
  }

  async keys(pattern: string): Promise<string[]> {
    return this.redisClient.keys(pattern);
  }

  async ping(): Promise<string> {
    return this.redisClient.ping();
  }

  // Get raw Redis client (use carefully)
  getClient(): Redis {
    return this.redisClient;
  }

  // ============ BATCH OPERATIONS ============

  async pipeline(
    commands: Array<{ command: string; args: any[] }>,
  ): Promise<any[] | null> {
    const pipeline = this.redisClient.pipeline();

    for (const cmd of commands) {
      (pipeline as any)[cmd.command](...cmd.args);
    }

    return pipeline.exec();
  }

  async multi(
    commands: Array<{ command: string; args: any[] }>,
  ): Promise<any[] | null> {
    const multi = this.redisClient.multi();

    for (const cmd of commands) {
      (multi as any)[cmd.command](...cmd.args);
    }

    return multi.exec();
  }
}
