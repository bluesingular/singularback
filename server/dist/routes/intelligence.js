/**
 * server/src/routes/intelligence.ts
 *
 * Morning intelligence cards API — M11.
 *
 * GET   /companies/:companyId/intelligence-cards          → unread + recent cards
 * PATCH /companies/:companyId/intelligence-cards/:id/read → mark a card read
 */
import { Router } from "express";
import { eq, and, desc } from "drizzle-orm";
import { intelligenceCards } from "@paperclipai/db";
import { assertCompanyAccess } from "./authz.js";
export function intelligenceRoutes(db) {
    const router = Router();
    // GET /companies/:companyId/intelligence-cards
    // Returns unread cards (urgency-sorted) + up to 10 recently read ones.
    router.get("/companies/:companyId/intelligence-cards", async (req, res) => {
        const { companyId } = req.params;
        assertCompanyAccess(req, companyId);
        const cards = await db
            .select()
            .from(intelligenceCards)
            .where(eq(intelligenceCards.companyId, companyId))
            .orderBy(desc(intelligenceCards.urgency), desc(intelligenceCards.createdAt))
            .limit(50);
        res.json(cards);
    });
    // PATCH /companies/:companyId/intelligence-cards/:cardId/read
    router.patch("/companies/:companyId/intelligence-cards/:cardId/read", async (req, res) => {
        const { companyId, cardId } = req.params;
        assertCompanyAccess(req, companyId);
        const updated = await db
            .update(intelligenceCards)
            .set({ status: "read" })
            .where(and(eq(intelligenceCards.id, cardId), eq(intelligenceCards.companyId, companyId)))
            .returning({ id: intelligenceCards.id });
        if (!updated?.length) {
            res.status(404).json({ error: "Card not found" });
            return;
        }
        res.json({ ok: true });
    });
    return router;
}
//# sourceMappingURL=intelligence.js.map