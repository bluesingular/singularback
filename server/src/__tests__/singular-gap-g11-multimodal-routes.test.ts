/**
 * G11 — Multi-modal route tests (tests 12–14)
 *
 * Service unit tests (1–11) are in singular-gap-g11-multimodal.test.ts
 *
 * Tests:
 * 12.  POST /tasks/:id/attachments — 201 returns ExtractionResult for CSV
 * 13.  POST /tasks/:id/attachments — 400 when no file uploaded
 * 14.  POST /tasks/:id/attachments — 400 for unsupported MIME type
 */

import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { errorHandler } from "../middleware/error-handler.js";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("../tools/extractInput.js", () => ({
  extractInput:       vi.fn(),
  UnsupportedTypeError: class UnsupportedTypeError extends Error {
    constructor(public mimeType: string) {
      super(`Unsupported MIME type for extraction: ${mimeType}`);
      this.name = "UnsupportedTypeError";
    }
  },
  ExtractionError: class ExtractionError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "ExtractionError";
    }
  },
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const COMPANY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TASK_ID    = "11111111-1111-4111-8111-111111111111";
const USER_ID    = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const CSV_EXTRACTION = {
  text:     "Headers: Name | Age\nRows: 2\n\nName: Alice, Age: 30\nName: Bob, Age: 25",
  mimeType: "text/csv",
  byteSize: 120,
  gdprFlag: false,
};

// ── App builder ───────────────────────────────────────────────────────────────

async function buildApp(role: "operator" | "viewer" = "operator") {
  const { multimodalRoutes } = await import("../routes/multimodal.js");
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).actor = {
      type: "board", userId: USER_ID, companyIds: [COMPANY_ID],
      source: "jwt", isInstanceAdmin: false,
      memberships: [{ companyId: COMPANY_ID, status: "active", membershipRole: role }],
    };
    (req as any).ctx = { userId: USER_ID, companyId: COMPANY_ID, role, plan: "growth" };
    next();
  });
  app.use("/", multimodalRoutes({} as any));
  app.use(errorHandler);
  return app;
}

// ── Route tests ───────────────────────────────────────────────────────────────

describe("G11 — Multi-modal routes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("12. POST /tasks/:id/attachments — 201 returns extraction result for CSV", async () => {
    const { extractInput } = await import("../tools/extractInput.js");
    vi.mocked(extractInput).mockResolvedValueOnce(CSV_EXTRACTION);

    const app = await buildApp();
    const res = await request(app)
      .post(`/companies/${COMPANY_ID}/tasks/${TASK_ID}/attachments`)
      .attach("file", Buffer.from("Name,Age\nAlice,30"), { filename: "data.csv", contentType: "text/csv" });

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.taskId).toBe(TASK_ID);
    expect(res.body.mimeType).toBe("text/csv");
    expect(res.body.gdprFlag).toBe(false);
    expect(res.body.text).toContain("Headers:");
  });

  it("13. POST /tasks/:id/attachments — 400 when no file uploaded", async () => {
    const app = await buildApp();
    const res = await request(app)
      .post(`/companies/${COMPANY_ID}/tasks/${TASK_ID}/attachments`)
      .send({});
    expect(res.status).toBe(400);
  });

  it("14. POST /tasks/:id/attachments — 400 for unsupported MIME type", async () => {
    const { extractInput, UnsupportedTypeError } = await import("../tools/extractInput.js");
    vi.mocked(extractInput).mockRejectedValueOnce(
      new UnsupportedTypeError("video/mp4"),
    );

    const app = await buildApp();
    const res = await request(app)
      .post(`/companies/${COMPANY_ID}/tasks/${TASK_ID}/attachments`)
      .attach("file", Buffer.from("video data"), { filename: "video.mp4", contentType: "video/mp4" });

    expect(res.status).toBe(400);
    expect(res.body.message ?? res.body.error).toMatch(/Unsupported/i);
  });
});
