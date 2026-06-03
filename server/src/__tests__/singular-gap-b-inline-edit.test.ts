/**
 * server/src/__tests__/singular-gap-b-inline-edit.test.ts
 *
 * Gap B — PATCH /companies/:companyId/tasks/:taskId/inline-edit
 *
 *  1. 200 + recorded=true  when content differs → golden_datasets row created
 *  2. 200 + recorded=false when content identical → no training signal
 *  3. 409 when task is not in pending_approval / in_review
 *  4. 404 when task not found
 *  5. 403 when wrong company
 *  6. 400 when body missing operatorEdit
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { taskInlineEditRoutes } from "../routes/task-inline-edit.js";

const COMPANY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_ID   = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const TASK_ID    = "tttttttt-tttt-4ttt-8ttt-tttttttttttt";

const PENDING_TASK = {
  id:          TASK_ID,
  companyId:   COMPANY_ID,
  title:       "Qualifier les candidatures",
  status:      "pending_approval",
  skillType:   "qualification-cv",
  description: "Sophie a qualifié 3 candidatures sur 10.",
};

function makeDb(taskRow = PENDING_TASK, insertSpy = vi.fn().mockResolvedValue(undefined)) {
  return {
    select: vi.fn().mockImplementation(() => ({
      from:    vi.fn().mockReturnThis(),
      where:   vi.fn().mockReturnThis(),
      then:    (cb: (v: unknown[]) => unknown) =>
        Promise.resolve(taskRow ? [taskRow] : []).then(cb),
    })),
    insert: vi.fn().mockImplementation(() => ({
      values: vi.fn().mockImplementation(() => {
        insertSpy()
        return Promise.resolve()
      }),
    })),
  }
}

async function buildApp(db: ReturnType<typeof makeDb>, companyId = COMPANY_ID) {
  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => {
    (req as any).ctx   = { userId: "u1", companyId, role: "operator", plan: "growth" }
    ;(req as any).actor = {
      type: "board", userId: "u1", source: "session", companyIds: [COMPANY_ID],
    }
    next()
  })
  app.use(taskInlineEditRoutes(db as any))
  return app
}

describe("Gap B — task inline-edit endpoint", () => {
  beforeEach(() => vi.clearAllMocks())

  it("1. records edit and creates golden dataset when content differs", async () => {
    const insertSpy = vi.fn()
    const db  = makeDb(PENDING_TASK, insertSpy)
    const app = await buildApp(db)
    const res = await request(app)
      .patch(`/companies/${COMPANY_ID}/tasks/${TASK_ID}/inline-edit`)
      .send({
        operatorEdit:   "Sophie a qualifié 3 candidatures sur 10 — résultat corrigé.",
        originalOutput: PENDING_TASK.description,
      })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.recorded).toBe(true)
    expect(res.body.charCount).toBeGreaterThan(0)
    expect(insertSpy).toHaveBeenCalledOnce()  // golden dataset row created
  })

  it("2. no training signal when content identical (invariant)", async () => {
    const insertSpy = vi.fn()
    const db  = makeDb(PENDING_TASK, insertSpy)
    const app = await buildApp(db)
    const res = await request(app)
      .patch(`/companies/${COMPANY_ID}/tasks/${TASK_ID}/inline-edit`)
      .send({
        operatorEdit:   PENDING_TASK.description,  // same as original
        originalOutput: PENDING_TASK.description,
      })
    expect(res.status).toBe(200)
    expect(res.body.recorded).toBe(false)
    expect(insertSpy).not.toHaveBeenCalled()     // no golden dataset row
  })

  it("3. 409 when task is not in an editable state", async () => {
    const doneTask = { ...PENDING_TASK, status: "done" }
    const app = await buildApp(makeDb(doneTask))
    const res = await request(app)
      .patch(`/companies/${COMPANY_ID}/tasks/${TASK_ID}/inline-edit`)
      .send({ operatorEdit: "edited version", originalOutput: "original" })
    expect(res.status).toBe(409)
  })

  it("4. 404 when task not found", async () => {
    const app = await buildApp(makeDb(null as any))
    const res = await request(app)
      .patch(`/companies/${COMPANY_ID}/tasks/${TASK_ID}/inline-edit`)
      .send({ operatorEdit: "edited", originalOutput: "original" })
    expect(res.status).toBe(404)
  })

  it("5. 403 when caller accesses wrong company", async () => {
    const app = await buildApp(makeDb(), COMPANY_ID)  // actor has COMPANY_ID only
    const res = await request(app)
      .patch(`/companies/${OTHER_ID}/tasks/${TASK_ID}/inline-edit`)
      .send({ operatorEdit: "edited", originalOutput: "original" })
    expect(res.status).toBe(403)
  })

  it("6. 400 when operatorEdit is missing", async () => {
    const app = await buildApp(makeDb())
    const res = await request(app)
      .patch(`/companies/${COMPANY_ID}/tasks/${TASK_ID}/inline-edit`)
      .send({ originalOutput: "original" })
    expect(res.status).toBe(400)
  })
})
