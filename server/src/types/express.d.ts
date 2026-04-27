export {};

import type { RequestContext } from "../middleware/company-context.js";

declare global {
  namespace Express {
    interface Request {
      actor: {
        type: "board" | "agent" | "none";
        userId?: string;
        agentId?: string;
        companyId?: string;
        companyIds?: string[];
        isInstanceAdmin?: boolean;
        keyId?: string;
        runId?: string;
        source?: "local_implicit" | "session" | "board_key" | "agent_key" | "agent_jwt" | "none";
        memberships?: Array<{ companyId: string; status: string; membershipRole: string }>;
      };
      /**
       * Resolved company context — set by companyContextMiddleware.
       * Undefined if the user is unauthenticated or belongs to no company.
       * Use requireCtx(req, res) to guard routes that need this.
       */
      ctx?: RequestContext;
    }
  }
}
