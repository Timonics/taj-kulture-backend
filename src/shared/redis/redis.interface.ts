/**
 * REDIS INTERFACES
 *
 * Central location for all Redis-related type definitions
 *
 * WHY SEPARATE:
 * - Clean separation of types from implementation
 * - Easy to import types without circular dependencies
 * - Can be shared across multiple files
 */

import { RedisConfig as ConfigType } from './redis.config';

// Re-export config type
export type RedisConfig = ConfigType;

/**
 * Redis client interface (what the factory provides)
 */
export interface RedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ...args: any[]): Promise<string>;
  del(...keys: string[]): Promise<number>;
  incr(key: string): Promise<number>;
  incrby(key: string, increment: number): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  ttl(key: string): Promise<number>;
  exists(key: string): Promise<number>;
  sadd(key: string, ...members: string[]): Promise<number>;
  srem(key: string, ...members: string[]): Promise<number>;
  smembers(key: string): Promise<string[]>;
  scan(cursor: string, ...args: any[]): Promise<[string, string[]]>;
  flushall(): Promise<string>;
  ping(): Promise<string>;
  quit(): Promise<string>;
  status: string;
  pipeline(): any;
  on(event: string, handler: (...args: any[]) => void): void;
  connect(): Promise<void>;
}

/**
 * Health check result
 */
export interface RedisHealthCheck {
  status: 'up' | 'down';
  latency?: number;
  error?: string;
}

/**
 * Injection token for Redis client
 */
export const REDIS_CLIENT = 'REDIS_CLIENT';
