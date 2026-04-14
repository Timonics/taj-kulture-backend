import { Logger } from '@nestjs/common';
import { RedisClient } from './redis.interface';

/**
 * REDIS MOCK CLIENT
 * 
 * In-memory mock implementation of Redis client
 * 
 * WHY NEEDED:
 * - Allows development without running Redis
 * - Makes unit tests faster and deterministic
 * - No external dependencies for CI/CD
 * 
 * USAGE:
 * Automatically used when REDIS_ENABLED=false
 */
export class RedisMockClient implements RedisClient {
  private readonly logger = new Logger(RedisMockClient.name);
  private data: Map<string, any> = new Map();
  private sets: Map<string, Set<string>> = new Map();
  public status: string = 'ready';

  async get(key: string): Promise<string | null> {
    const value = this.data.get(key);
    return value !== undefined ? JSON.stringify(value) : null;
  }

  async set(key: string, value: string, ...args: any[]): Promise<string> {
    // Parse TTL if provided in format: 'EX', 300
    let ttl: number | undefined;
    for (let i = 0; i < args.length; i++) {
      if (args[i] === 'EX' && args[i + 1]) {
        ttl = parseInt(args[i + 1]);
        break;
      }
    }
    
    this.data.set(key, value);
    
    if (ttl) {
      setTimeout(() => {
        this.data.delete(key);
      }, ttl * 1000);
    }
    
    return 'OK';
  }

  async del(...keys: string[]): Promise<number> {
    let deleted = 0;
    for (const key of keys) {
      if (this.data.delete(key)) deleted++;
    }
    return deleted;
  }

  async incr(key: string): Promise<number> {
    const current = parseInt(this.data.get(key) || '0');
    const next = current + 1;
    this.data.set(key, next.toString());
    return next;
  }

  async incrby(key: string, increment: number): Promise<number> {
    const current = parseInt(this.data.get(key) || '0');
    const next = current + increment;
    this.data.set(key, next.toString());
    return next;
  }

  async expire(key: string, seconds: number): Promise<number> {
    if (!this.data.has(key)) return 0;
    
    setTimeout(() => {
      this.data.delete(key);
    }, seconds * 1000);
    
    return 1;
  }

  async ttl(key: string): Promise<number> {
    return this.data.has(key) ? -1 : -2;
  }

  async exists(key: string): Promise<number> {
    return this.data.has(key) ? 1 : 0;
  }

  async sadd(key: string, ...members: string[]): Promise<number> {
    if (!this.sets.has(key)) {
      this.sets.set(key, new Set());
    }
    
    const set = this.sets.get(key)!;
    let added = 0;
    for (const member of members) {
      if (!set.has(member)) {
        set.add(member);
        added++;
      }
    }
    return added;
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    const set = this.sets.get(key);
    if (!set) return 0;
    
    let removed = 0;
    for (const member of members) {
      if (set.delete(member)) removed++;
    }
    return removed;
  }

  async smembers(key: string): Promise<string[]> {
    const set = this.sets.get(key);
    return set ? Array.from(set) : [];
  }

  async scan(cursor: string, ...args: any[]): Promise<[string, string[]]> {
    // Find MATCH pattern if provided
    let pattern = '*';
    for (let i = 0; i < args.length; i++) {
      if (args[i] === 'MATCH' && args[i + 1]) {
        pattern = args[i + 1];
        break;
      }
    }
    
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    const keys = Array.from(this.data.keys()).filter(k => regex.test(k));
    
    return ['0', keys];
  }

  async flushall(): Promise<string> {
    this.data.clear();
    this.sets.clear();
    return 'OK';
  }

  async ping(): Promise<string> {
    return 'PONG';
  }

  async quit(): Promise<string> {
    this.data.clear();
    this.sets.clear();
    return 'OK';
  }

  pipeline(): any {
    const commands: Array<{ method: string; args: any[] }> = [];
    const self = this;
    
    const pipeline = {
      set: (key: string, value: string, ...args: any[]) => {
        commands.push({ method: 'set', args: [key, value, ...args] });
        return pipeline;
      },
      del: (...keys: string[]) => {
        commands.push({ method: 'del', args: keys });
        return pipeline;
      },
      incr: (key: string) => {
        commands.push({ method: 'incr', args: [key] });
        return pipeline;
      },
      exec: async () => {
        const results: any[] = [];
        for (const cmd of commands) {
          const result = await (self as any)[cmd.method](...cmd.args);
          results.push([null, result]);
        }
        return results;
      },
    };
    
    return pipeline;
  }

  on(event: string, handler: (...args: any[]) => void): void {
    // Mock - no actual events
    this.logger.debug(`Mock Redis event registered: ${event}`);
  }

  async connect(): Promise<void> {
    this.logger.log('Mock Redis connected');
  }
}