import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<any> {
    // You can customize how you track requests (by IP, user ID, etc.)
    const trackProps = {
      ip: req.ips.length ? req.ips[0] : req.ip,
      user_id: req.userId ?? undefined
    }
    return trackProps
  }
}