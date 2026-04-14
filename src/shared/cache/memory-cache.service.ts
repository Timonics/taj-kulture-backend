import { Injectable, Logger } from '@nestjs/common';
import { ICacheService, CacheOptions } from './cache.interface';

interface CacheEntry<T = any> {
  value: T;
  expiresAt: number;
  tags?: string[];
}

@Injectable()
export class MemoryCacheService implements ICacheService {
  private cache: Map<string, CacheEntry> = new Map();
  private tagIndex: Map<string, Set<string>> = new Map();
  private readonly DEFAULT_TTL = 60 * 15; // 15 seconds

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    const ttl = options?.ttl || this.DEFAULT_TTL;
    const expiresAt = Date.now() + ttl * 1000;

    this.cache.set(key, {
      value,
      expiresAt,
      tags: options?.tags,
    });

    // Update tag index
    if (options?.tags?.length) {
      for (const tag of options.tags) {
        if (!this.tagIndex.has(tag)) {
          this.tagIndex.set(tag, new Set());
        }
        const tagSet = this.tagIndex.get(tag);
        if (tagSet) {
          tagSet.add(key);
        }
      }
    }
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async deleteByTag(tag: string): Promise<void> {
    const keys = this.tagIndex.get(tag);

    if (keys) {
      for (const key of keys) {
        this.cache.delete(key);
      }
      this.tagIndex.delete(tag);
    }
  }

  async deletePattern(pattern: string): Promise<void> {
    const regex = new RegExp(pattern.replace('*', '.*'));
    const keys = Array.from(this.cache.keys()).filter((key) => regex.test(key));

    for (const key of keys) {
      this.cache.delete(key);
    }
  }

  async exists(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  async expire(key: string, ttl: number): Promise<void> {
    const entry = this.cache.get(key);
    if (entry) {
      entry.expiresAt = Date.now() + ttl * 1000;
    }
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.tagIndex.clear();
  }

  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options?: CacheOptions,
  ): Promise<T> {
    const cached = await this.get<T>(key);

    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    await this.set(key, value, options);
    return value;
  }

  async getTTL(key: string): Promise<number> {
    const entry = this.cache.get(key);
    if (!entry) return -2; // -2 means key doesn't exist

    const remaining = Math.max(
      0,
      Math.ceil((entry.expiresAt - Date.now()) / 1000),
    );
    return remaining || -1; // -1 means no TTL (though we always have one)
  }

  async increment(key: string, amount: number = 1): Promise<number> {
    const current = (await this.get<number>(key)) || 0;
    const newValue = current + amount;
    await this.set(key, newValue, { ttl: 60 }); // Default 60s TTL for counters
    return newValue;
  }
}
