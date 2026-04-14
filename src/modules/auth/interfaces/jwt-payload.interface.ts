/**
 * JWT PAYLOAD INTERFACE
 * 
 * Structure of data stored in JWT tokens.
 * 
 * WHY SUB (Subject) INSTEAD OF USER_ID:
 * - JWT standard field name
 * - Supported by JWT libraries
 * - Consistent with OAuth2 standards
 * 
 * WHY SEPARATE REFRESH TOKEN PAYLOAD:
 * - Refresh tokens can have different claims
 * - Can include device ID for session management
 */
export interface JwtPayload {
  /** User ID (JWT standard subject field) */
  sub: string;
  
  /** User email for quick access without DB lookup */
  email: string;
  
  /** User role for authorization checks */
  role: string;
  
  /** Token purpose (email-verification, password-reset, auth) */
  purpose?: 'auth' | 'email-verification' | 'password-reset';
  
  /** When token was issued (Unix timestamp) */
  iat?: number;
  
  /** When token expires (Unix timestamp) */
  exp?: number;
}

export interface RefreshTokenPayload extends JwtPayload {
  /** Device ID for session tracking (optional) */
  deviceId?: string;
  
  /** Refresh token version (for rotation) */
  version?: number;
}