import { AsyncLocalStorage } from 'async_hooks';
import { Request } from 'express';

/**
 * REQUEST CONTEXT - AsyncLocalStorage Implementation
 * 
 * Why AsyncLocalStorage?
 * - Maintains context across asynchronous operations (promises, callbacks)
 * - Essential for correlating logs when using async/await
 * - Thread-safe (each request gets its own isolated storage)
 * 
 * Problem it solves:
 * Without AsyncLocalStorage, we'd need to manually pass correlationId
 * through every function call. This leads to:
 * - Parameter pollution (every function needs correlationId param)
 * - Missed correlations when developers forget to pass it
 * - Hard to maintain code
 * 
 * Solution:
 * Store correlationId in AsyncLocalStorage at the request level
 * Any code running during that request can access it via get()
 */
export class RequestContext {
  /**
   * AsyncLocalStorage instance that holds context for each request
   * 
   * Type: Map<string, any> allows storing multiple key-value pairs
   * Could store: userId, correlationId, tenantId, etc.
   */
  private static storage = new AsyncLocalStorage<Map<string, any>>();

  /**
   * Run a function with a new context
   * 
   * Usage in middleware:
   *   RequestContext.run(req, () => {
   *     next(); // All subsequent async operations have access to this context
   *   });
   * 
   * @param req - Express request object (used to extract initial context)
   * @param callback - Function to execute within the context
   */
  static run(req: Request, callback: () => void): void {
    // Create a new Map to store context for this request
    const contextMap = new Map<string, any>();
    
    // Store initial context from request
    contextMap.set('correlationId', req['correlationId']);
    
    // If user is authenticated, store user ID for context
    if ((req['user'] as any)?.id) {
      contextMap.set('userId', (req['user'] as any).id);
    }
    
    // Run the callback with this context
    // All async operations within will have access to this context
    RequestContext.storage.run(contextMap, callback);
  }

  /**
   * Get a value from the current context
   * 
   * @param key - The key to retrieve
   * @returns The value if it exists, undefined otherwise
   */
  static get<T = any>(key: string): T | undefined {
    const store = RequestContext.storage.getStore();
    return store?.get(key);
  }

  /**
   * Set a value in the current context
   * 
   * @param key - The key to set
   * @param value - The value to store
   */
  static set(key: string, value: any): void {
    const store = RequestContext.storage.getStore();
    if (store) {
      store.set(key, value);
    }
  }

  /**
   * Get the current correlation ID from context
   * 
   * This is the primary method used by services to get the current request ID
   * without needing to pass it through function parameters.
   */
  static getCorrelationId(): string | undefined {
    return RequestContext.get<string>('correlationId');
  }

  /**
   * Get the current user ID from context
   */
  static getUserId(): string | undefined {
    return RequestContext.get<string>('userId');
  }
}