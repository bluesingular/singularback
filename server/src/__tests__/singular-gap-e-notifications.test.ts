/**
 * Gap E — Notification system
 *
 * Tests:
 *  1. createNotification — persists a row with channelsDelivered "inapp"
 *  2. createNotification — userId null is a broadcast notification
 *  3. createNotification — returns { id }
 *  4. getUnreadNotifications — returns rows from DB
 *  5. getUnreadNotifications — passes companyId and userId to query
 *  6. getAllNotifications — returns rows from DB
 *  7. markNotificationRead — calls update with status=read
 *  8. dismissNotification — calls update with status=dismissed
 *  9. markAllRead — calls update with status=read
 * 10. getNotificationPreferences — returns defaults when no row exists
 * 11. getNotificationPreferences — returns DB row when it exists
 * 12. upsertNotificationPreferences — calls insert with onConflictDoUpdate
 * 13. sendNotificationEmail — skips when RESEND_API_KEY missing
 * 14. sendNotificationEmail — calls Resend with correct payload
 * 15. sendNotificationEmail — throws on Resend non-200
 * 16. notificationHtml — includes CTA link when actionUrl provided
 * 17. notificationHtml — omits CTA when actionUrl absent
 * 18. GET /companies/:id/notifications — 200 with unreadCount
 * 19. GET /companies/:id/notifications/all — 200 with notifications array
 * 20. PATCH /notifications/:id/read — 200 with id
 * 21. PATCH /notifications/:id/dismiss — 200 with id
 * 22. POST /notifications/mark-all-read — 200 with ok:true
 * 23. GET /notification-preferences — 200 with preference fields
 * 24. PUT /notification-preferences — 200 on valid body
 * 25. PUT /notification-preferences — 400 on invalid body (non-boolean)
 */

import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import { errorHandler } from "../middleware/error-handler.js";

// ── Fixture UUIDs ─────────────────────────────────────────────────────────────

const COMPANY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USER_ID    = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const NOTIF_ID   = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

// ── Chainable mock builder ────────────────────────────────────────────────────

function makeChainDb(resolvedRows: unknown[] = []) {
  const chain: Record<string, unknown> = {};
  const terminal = vi.fn().mockResolvedValue(resolvedRows);

  // Every chainable method returns the same chain object so calls compose.
  for (const m of ["select", "from", "where", "orderBy", "leftJoin", "innerJoin"]) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  // Terminal: limit resolves to the rows.
  chain["limit"] = terminal;

  chain["insert"] = vi.fn().mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ id: NOTIF_ID }]),
      onConflictDoUpdate: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ approvalEmail: true }]),
      }),
    }),
  });

  chain["update"] = vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  });

  return chain;
}

// ── Service unit tests ────────────────────────────────────────────────────────

describe("Gap E — notification service", () => {
  it("1. createNotification — channelsDelivered defaults to inapp", async () => {
    const db = makeChainDb();
    let capturedValues: Record<string, unknown> | null = null;
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({
      values: vi.fn().mockImplementation((v: Record<string, unknown>) => {
        capturedValues = v;
        return { returning: () => Promise.resolve([{ id: NOTIF_ID }]) };
      }),
    });

    const { createNotification } = await import("../notifications/service.js");
    await createNotification(db as any, {
      companyId: COMPANY_ID,
      type: "intelligence",
      title: "Marché du travail",
      body:  "Les offres tech ont augmenté de 12%.",
    });

    expect(capturedValues).toMatchObject({ channelsDelivered: "inapp" });
  });

  it("2. createNotification — userId null is broadcast", async () => {
    const db = makeChainDb();
    let capturedValues: Record<string, unknown> | null = null;
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({
      values: vi.fn().mockImplementation((v: Record<string, unknown>) => {
        capturedValues = v;
        return { returning: () => Promise.resolve([{ id: NOTIF_ID }]) };
      }),
    });

    const { createNotification } = await import("../notifications/service.js");
    await createNotification(db as any, {
      companyId: COMPANY_ID,
      userId:    null,
      type:      "budget_alert",
      title:     "Budget presque atteint",
      body:      "80% du budget mensuel consommé.",
    });

    expect(capturedValues).toMatchObject({ userId: null });
  });

  it("3. createNotification — returns { id }", async () => {
    const db = makeChainDb();
    const { createNotification } = await import("../notifications/service.js");
    const result = await createNotification(db as any, {
      companyId: COMPANY_ID,
      type: "approval_pending",
      title: "Action en attente",
      body:  "Validation requise.",
    });

    expect(result).toEqual({ id: NOTIF_ID });
  });

  it("4. getUnreadNotifications — returns rows from DB", async () => {
    const notifRow = { id: NOTIF_ID, status: "unread" };
    const db = makeChainDb([notifRow]);

    const { getUnreadNotifications } = await import("../notifications/service.js");
    const rows = await getUnreadNotifications(db as any, COMPANY_ID, USER_ID);

    expect(rows).toHaveLength(1);
    expect((rows[0] as any).id).toBe(NOTIF_ID);
  });

  it("5. getUnreadNotifications — calls select chain", async () => {
    const db = makeChainDb([]);
    const { getUnreadNotifications } = await import("../notifications/service.js");
    await getUnreadNotifications(db as any, COMPANY_ID, USER_ID);

    expect(db.select).toHaveBeenCalled();
    expect(db.limit).toHaveBeenCalledWith(50);
  });

  it("6. getAllNotifications — returns rows", async () => {
    const notifRow = { id: NOTIF_ID, status: "read" };
    const db = makeChainDb([notifRow]);

    const { getAllNotifications } = await import("../notifications/service.js");
    const rows = await getAllNotifications(db as any, COMPANY_ID, USER_ID);

    expect(Array.isArray(rows)).toBe(true);
  });

  it("7. markNotificationRead — update called with status=read", async () => {
    const whereMock = vi.fn().mockResolvedValue(undefined);
    const setMock   = vi.fn().mockReturnValue({ where: whereMock });
    const db = makeChainDb();
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: setMock });

    const { markNotificationRead } = await import("../notifications/service.js");
    await markNotificationRead(db as any, COMPANY_ID, NOTIF_ID);

    expect(setMock).toHaveBeenCalledWith({ status: "read" });
  });

  it("8. dismissNotification — update called with status=dismissed", async () => {
    const whereMock = vi.fn().mockResolvedValue(undefined);
    const setMock   = vi.fn().mockReturnValue({ where: whereMock });
    const db = makeChainDb();
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: setMock });

    const { dismissNotification } = await import("../notifications/service.js");
    await dismissNotification(db as any, COMPANY_ID, NOTIF_ID);

    expect(setMock).toHaveBeenCalledWith({ status: "dismissed" });
  });

  it("9. markAllRead — update called with status=read", async () => {
    const whereMock = vi.fn().mockResolvedValue(undefined);
    const setMock   = vi.fn().mockReturnValue({ where: whereMock });
    const db = makeChainDb();
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: setMock });

    const { markAllRead } = await import("../notifications/service.js");
    await markAllRead(db as any, COMPANY_ID, USER_ID);

    expect(setMock).toHaveBeenCalledWith({ status: "read" });
  });

  it("10. getNotificationPreferences — returns defaults when no row", async () => {
    const db = makeChainDb([]);  // empty result → no prefs row

    const { getNotificationPreferences } = await import("../notifications/service.js");
    const prefs = await getNotificationPreferences(db as any, COMPANY_ID, USER_ID) as any;

    expect(prefs.approvalEmail).toBe(true);
    expect(prefs.intelligenceEmail).toBe(false);
    expect(prefs.budgetEmail).toBe(true);
  });

  it("11. getNotificationPreferences — returns DB row when it exists", async () => {
    const prefRow = {
      approvalInapp: true, approvalEmail: false,
      trustInapp: true,    trustEmail: false,
      intelligenceInapp: true, intelligenceEmail: true,
      errorInapp: true,    errorEmail: false,
      budgetInapp: true,   budgetEmail: false,
    };
    const db = makeChainDb([prefRow]);

    const { getNotificationPreferences } = await import("../notifications/service.js");
    const prefs = await getNotificationPreferences(db as any, COMPANY_ID, USER_ID) as any;

    expect(prefs.approvalEmail).toBe(false);
    expect(prefs.intelligenceEmail).toBe(true);
  });

  it("12. upsertNotificationPreferences — calls insert.onConflictDoUpdate", async () => {
    const onConflictMock = vi.fn().mockReturnValue({
      returning: () => Promise.resolve([{ approvalEmail: false }]),
    });
    const db = makeChainDb();
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({
      values: vi.fn().mockReturnValue({ onConflictDoUpdate: onConflictMock }),
    });

    const { upsertNotificationPreferences } = await import("../notifications/service.js");
    await upsertNotificationPreferences(db as any, COMPANY_ID, USER_ID, {
      approvalEmail: false,
    });

    expect(onConflictMock).toHaveBeenCalled();
  });
});

// ── Email channel tests ───────────────────────────────────────────────────────

describe("Gap E — email delivery", () => {
  const originalKey = process.env.RESEND_API_KEY;

  afterEach(() => {
    if (originalKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = originalKey;
    vi.unstubAllGlobals();
  });

  it("13. sendNotificationEmail — skips when RESEND_API_KEY missing", async () => {
    delete process.env.RESEND_API_KEY;
    const { sendNotificationEmail } = await import("../notifications/email.js");
    await expect(
      sendNotificationEmail({ to: "test@example.com", title: "Test", body: "Hello" }),
    ).resolves.toBeUndefined();
  });

  it("14. sendNotificationEmail — calls Resend with correct payload", async () => {
    process.env.RESEND_API_KEY = "re_test_key_123";
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    const { sendNotificationEmail } = await import("../notifications/email.js");
    await sendNotificationEmail({
      to: "directeur@cabinetmartin.fr",
      title: "Action requise",
      body: "Veuillez approuver la publication.",
      actionUrl: "/taches/abc-123",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer re_test_key_123",
        }),
      }),
    );

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.to).toBe("directeur@cabinetmartin.fr");
    expect(body.subject).toBe("Action requise");
  });

  it("15. sendNotificationEmail — throws on Resend non-200", async () => {
    process.env.RESEND_API_KEY = "re_test_key_456";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      text: () => Promise.resolve("Invalid email address"),
    }));

    const { sendNotificationEmail } = await import("../notifications/email.js");
    await expect(
      sendNotificationEmail({ to: "bad", title: "T", body: "B" }),
    ).rejects.toThrow("Resend API error 422");
  });

  it("16. notificationHtml — includes CTA link when actionUrl provided", async () => {
    process.env.RESEND_API_KEY = "re_test_cta";
    let capturedHtml = "";
    vi.stubGlobal("fetch", vi.fn().mockImplementation((_url: string, opts: RequestInit) => {
      capturedHtml = JSON.parse(opts.body as string).html as string;
      return Promise.resolve({ ok: true });
    }));

    const { sendNotificationEmail } = await import("../notifications/email.js");
    await sendNotificationEmail({
      to: "u@e.com",
      title: "Titre test",
      body: "Corps du message",
      actionUrl: "https://app.swwarm.com/confiance",
    });

    expect(capturedHtml).toContain("Voir →");
    expect(capturedHtml).toContain("https://app.swwarm.com/confiance");
  });

  it("17. notificationHtml — omits CTA when no actionUrl", async () => {
    process.env.RESEND_API_KEY = "re_test_nocta";
    let capturedHtml = "";
    vi.stubGlobal("fetch", vi.fn().mockImplementation((_url: string, opts: RequestInit) => {
      capturedHtml = JSON.parse(opts.body as string).html as string;
      return Promise.resolve({ ok: true });
    }));

    const { sendNotificationEmail } = await import("../notifications/email.js");
    await sendNotificationEmail({
      to: "u@e.com",
      title: "Titre sans action",
      body: "Message informatif.",
    });

    expect(capturedHtml).not.toContain("Voir →");
  });
});

// ── API route tests ───────────────────────────────────────────────────────────

describe("Gap E — notification API routes", () => {
  async function buildApp(dbOverrides: Record<string, unknown> = {}) {
    const notifRow = {
      id: NOTIF_ID,
      companyId: COMPANY_ID,
      userId: USER_ID,
      type: "approval_pending",
      title: "Test",
      body: "Test body",
      actionUrl: null,
      status: "unread",
      metadata: null,
      channelsDelivered: "inapp",
      createdAt: new Date().toISOString(),
      expiresAt: null,
    };

    const mockDb: Record<string, unknown> = {
      ...makeChainDb([notifRow]),
      ...dbOverrides,
    };

    const app = express();
    app.use(express.json());

    // Auth middleware stub — local_implicit bypasses company access check
    app.use((req, _res, next) => {
      (req as any).actor = {
        type: "board",
        userId: USER_ID,
        companyIds: [COMPANY_ID],
        source: "local_implicit",
        isInstanceAdmin: false,
      };
      next();
    });

    const { notificationRoutes } = await import("../routes/notifications.js");
    app.use("/api/v1", notificationRoutes(mockDb as any));
    app.use(errorHandler);
    return app;
  }

  it("18. GET /companies/:id/notifications — 200 with unreadCount", async () => {
    const app = await buildApp();
    const res = await request(app)
      .get(`/api/v1/companies/${COMPANY_ID}/notifications`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("unreadCount");
    expect(typeof res.body.unreadCount).toBe("number");
  });

  it("19. GET /notifications/all — 200 with notifications array", async () => {
    const app = await buildApp();
    const res = await request(app)
      .get(`/api/v1/companies/${COMPANY_ID}/notifications/all`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.notifications)).toBe(true);
  });

  it("20. PATCH .../notifications/:id/read — 200 with id", async () => {
    const app = await buildApp();
    const res = await request(app)
      .patch(`/api/v1/companies/${COMPANY_ID}/notifications/${NOTIF_ID}/read`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(NOTIF_ID);
  });

  it("21. PATCH .../notifications/:id/dismiss — 200 with id", async () => {
    const app = await buildApp();
    const res = await request(app)
      .patch(`/api/v1/companies/${COMPANY_ID}/notifications/${NOTIF_ID}/dismiss`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(NOTIF_ID);
  });

  it("22. POST .../mark-all-read — 200 with ok:true", async () => {
    const app = await buildApp();
    const res = await request(app)
      .post(`/api/v1/companies/${COMPANY_ID}/notifications/mark-all-read`);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("23. GET .../notification-preferences — returns preference fields", async () => {
    const app = await buildApp({
      ...makeChainDb([]),  // no prefs row → defaults returned
    });
    const res = await request(app)
      .get(`/api/v1/companies/${COMPANY_ID}/notification-preferences`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("approvalEmail");
    expect(res.body).toHaveProperty("intelligenceEmail");
  });

  it("24. PUT .../notification-preferences — 200 on valid body", async () => {
    const app = await buildApp();
    const res = await request(app)
      .put(`/api/v1/companies/${COMPANY_ID}/notification-preferences`)
      .send({ intelligenceEmail: true, approvalEmail: false });

    expect(res.status).toBe(200);
  });

  it("25. PUT .../notification-preferences — 400 on invalid body", async () => {
    const app = await buildApp();
    const res = await request(app)
      .put(`/api/v1/companies/${COMPANY_ID}/notification-preferences`)
      .send({ approvalEmail: "yes" });  // string instead of boolean

    expect(res.status).toBe(400);
  });
});
