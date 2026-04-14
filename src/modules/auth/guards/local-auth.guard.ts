import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * LOCAL AUTH GUARD
 * 
 * Handles email/password authentication.
 * 
 * SEPARATE FROM JWT:
 * - Different validation logic (password check vs token check)
 * - Used only on /login endpoint
 * - Returns user object instead of just validating token
 */
@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {}