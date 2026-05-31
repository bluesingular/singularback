/**
 * server/src/middleware/session-activity.ts
 *
 * Gap K — Session gap awareness.
 *
 * Updates auth_users.last_active_at on every authenticated request.
 * Fires on app open after ≥6h absence: returns SessionGapBriefing.
 * One screen max — never a pop-up over ongoing work.
 * NOT the same as morning intelligence (daily/8am). Fires any time of day.
 */

import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { authUsers } from "@paperclipai/db";
import type { Db } from "@paperclipai/db";

const SESSION_GAP_THRESHOLD_MS = 6 * 60 * 60 * 1000; // 6 hours

export function createSessionActivityMiddleware(db: Db) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).actor?.userId;
      if (userId && typeof userId === "string") {
        // Non-blocking fire-and-forget
        void db
          .update(authUsers)
          .set({ lastActiveAt: new Date() } as any)
          .where(eq(authUsers.id, userId))
          .catch(() => {}); // swallow — never block the request
      }
    } catch {
      // Never let tracking break the request
    }
    next();
  };
}

export function wasSessionGap(lastActiveAt: Date | null | undefined): boolean {
  if (!lastActiveAt) return false;
  return Date.now() - lastActiveAt.getTime() > SESSION_GAP_THRESHOLD_MS;
}
