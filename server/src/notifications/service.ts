/**
 * server/src/notifications/service.ts
 *
 * Gap E — Notification service.
 *
 * createNotification() — persists a notification row, then delivers via
 *   enabled channels (inapp always + email if user prefs allow).
 *
 * Delivery rules (from spec):
 *   approval_pending  → inapp + email
 *   trust_proposal    → inapp + email
 *   trust_downgrade   → inapp + email
 *   agent_error       → inapp + email
 *   budget_alert      → inapp + email
 *   intelligence      → inapp only (email opt-in, default off)
 */

import { eq, and, desc, sql } from "drizzle-orm";
import { notifications, notificationPreferences, authUsers, pushSubscriptions } from "@paperclipai/db";
import type { Db } from "@paperclipai/db";
import pino from "pino";
import { sendNotificationEmail } from "./email.js";
import { sendWebPush } from "./push.js";

const log = pino({ name: "notifications:service" });

export type NotificationType =
  | "approval_pending"
  | "trust_proposal"
  | "trust_downgrade"
  | "intelligence"
  | "agent_error"
  | "budget_alert";

export interface CreateNotificationInput {
  companyId: string;
  userId?: string | null;       // null → all company members
  type: NotificationType;
  title: string;
  body: string;
  actionUrl?: string | null;
  metadata?: Record<string, unknown> | null;
  expiresAt?: Date | null;
}

// ── helpers ───────────────────────────────────────────────────────────────────

function emailEnabledByDefault(type: NotificationType): boolean {
  // intelligence cards: email off by default per spec
  return type !== "intelligence";
}

function prefColumnForType(type: NotificationType): {
  inapp: keyof typeof notificationPreferences._.columns;
  email: keyof typeof notificationPreferences._.columns;
} {
  const map: Record<NotificationType, { inapp: string; email: string }> = {
    approval_pending: { inapp: "approvalInapp", email: "approvalEmail" },
    trust_proposal:   { inapp: "trustInapp",    email: "trustEmail" },
    trust_downgrade:  { inapp: "trustInapp",    email: "trustEmail" },
    intelligence:     { inapp: "intelligenceInapp", email: "intelligenceEmail" },
    agent_error:      { inapp: "errorInapp",    email: "errorEmail" },
    budget_alert:     { inapp: "budgetInapp",   email: "budgetEmail" },
  };
  return map[type] as any;
}

// ── core service ──────────────────────────────────────────────────────────────

export async function createNotification(
  db: Db,
  input: CreateNotificationInput,
): Promise<{ id: string }> {
  const [row] = await (db as any)
    .insert(notifications)
    .values({
      companyId:  input.companyId,
      userId:     input.userId ?? null,
      type:       input.type,
      title:      input.title,
      body:       input.body,
      actionUrl:  input.actionUrl ?? null,
      metadata:   input.metadata ?? null,
      expiresAt:  input.expiresAt ?? null,
      channelsDelivered: "inapp",
    })
    .returning({ id: notifications.id });

  log.info({ id: row.id, type: input.type, companyId: input.companyId }, "notification created");

  // Fire email + push delivery in background
  void deliverEmail(db, row.id, input).catch((err) =>
    log.error({ err, notificationId: row.id }, "email delivery failed"),
  );
  void deliverPush(db, input).catch((err) =>
    log.error({ err, notificationId: row.id }, "push delivery failed"),
  );

  return { id: row.id };
}

async function deliverEmail(
  db: Db,
  notificationId: string,
  input: CreateNotificationInput,
): Promise<void> {
  const cols = prefColumnForType(input.type);

  // Collect target user IDs
  let targetUserIds: string[] = [];

  if (input.userId) {
    targetUserIds = [input.userId];
  } else {
    // Broadcast: all members of the company
    const members = await (db as any)
      .select({ userId: authUsers.id, email: authUsers.email })
      .from(authUsers)
      // authUsers don't have a direct companyId — prefs table is authoritative
      // fall back: anyone with a prefs row for this company
      .innerJoin(
        notificationPreferences,
        and(
          eq(notificationPreferences.userId, authUsers.id),
          eq(notificationPreferences.companyId, input.companyId),
        ),
      );
    targetUserIds = members.map((m: { userId: string }) => m.userId);
  }

  for (const uid of targetUserIds) {
    await deliverEmailToUser(db, notificationId, input, uid, cols.email as string);
  }
}

async function deliverEmailToUser(
  db: Db,
  notificationId: string,
  input: CreateNotificationInput,
  userId: string,
  emailCol: string,
): Promise<void> {
  // Fetch user email + prefs in one query
  const [row] = await (db as any)
    .select({
      email:   authUsers.email,
      prefRow: notificationPreferences,
    })
    .from(authUsers)
    .leftJoin(
      notificationPreferences,
      and(
        eq(notificationPreferences.userId, authUsers.id),
        eq(notificationPreferences.companyId, input.companyId),
      ),
    )
    .where(eq(authUsers.id, userId));

  if (!row?.email) return;

  const emailEnabled: boolean =
    row.prefRow != null
      ? Boolean((row.prefRow as any)[emailCol])
      : emailEnabledByDefault(input.type);

  if (!emailEnabled) {
    log.debug({ userId, type: input.type }, "email suppressed by user preference");
    return;
  }

  await sendNotificationEmail({
    to:        row.email,
    title:     input.title,
    body:      input.body,
    actionUrl: input.actionUrl,
  });

  // Update channelsDelivered to include email
  await (db as any)
    .update(notifications)
    .set({ channelsDelivered: sql`${notifications.channelsDelivered} || ',email'` })
    .where(eq(notifications.id, notificationId));
}

async function deliverPush(db: Db, input: CreateNotificationInput): Promise<void> {
  const subs = await (db as any)
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.companyId, input.companyId));

  if (!subs.length) return;

  const payload = JSON.stringify({
    title:     input.title,
    body:      input.body,
    actionUrl: input.actionUrl,
    type:      input.type,
  });

  await Promise.allSettled(
    subs.map((sub: { endpoint: string; p256dh: string; auth: string }) =>
      sendWebPush(sub, payload),
    ),
  );
}

// ── read / mutate ─────────────────────────────────────────────────────────────

export async function getUnreadNotifications(
  db: Db,
  companyId: string,
  userId: string,
  limit = 50,
): Promise<unknown[]> {
  return (db as any)
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.companyId, companyId),
        eq(notifications.status, "unread"),
        // rows with userId=null are broadcast; rows with this userId are personal
        sql`(${notifications.userId} IS NULL OR ${notifications.userId} = ${userId})`,
      ),
    )
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function getAllNotifications(
  db: Db,
  companyId: string,
  userId: string,
  limit = 100,
): Promise<unknown[]> {
  return (db as any)
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.companyId, companyId),
        sql`(${notifications.userId} IS NULL OR ${notifications.userId} = ${userId})`,
      ),
    )
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function markNotificationRead(
  db: Db,
  companyId: string,
  notificationId: string,
): Promise<void> {
  await (db as any)
    .update(notifications)
    .set({ status: "read" })
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.companyId, companyId),
      ),
    );
}

export async function dismissNotification(
  db: Db,
  companyId: string,
  notificationId: string,
): Promise<void> {
  await (db as any)
    .update(notifications)
    .set({ status: "dismissed" })
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.companyId, companyId),
      ),
    );
}

export async function markAllRead(db: Db, companyId: string, userId: string): Promise<void> {
  await (db as any)
    .update(notifications)
    .set({ status: "read" })
    .where(
      and(
        eq(notifications.companyId, companyId),
        eq(notifications.status, "unread"),
        sql`(${notifications.userId} IS NULL OR ${notifications.userId} = ${userId})`,
      ),
    );
}

// ── preferences ───────────────────────────────────────────────────────────────

export async function getNotificationPreferences(
  db: Db,
  companyId: string,
  userId: string,
): Promise<unknown> {
  const [prefs] = await (db as any)
    .select()
    .from(notificationPreferences)
    .where(
      and(
        eq(notificationPreferences.companyId, companyId),
        eq(notificationPreferences.userId, userId),
      ),
    )
    .limit(1);

  if (prefs) return prefs;

  // Return default values if no row exists yet
  return {
    approvalInapp: true,  approvalEmail: true,
    trustInapp:    true,  trustEmail:    true,
    intelligenceInapp: true, intelligenceEmail: false,
    errorInapp:    true,  errorEmail:    true,
    budgetInapp:   true,  budgetEmail:   true,
  };
}

export async function upsertNotificationPreferences(
  db: Db,
  companyId: string,
  userId: string,
  patch: Partial<{
    approvalInapp: boolean; approvalEmail: boolean;
    trustInapp: boolean;    trustEmail: boolean;
    intelligenceInapp: boolean; intelligenceEmail: boolean;
    errorInapp: boolean;    errorEmail: boolean;
    budgetInapp: boolean;   budgetEmail: boolean;
  }>,
): Promise<unknown> {
  const [row] = await (db as any)
    .insert(notificationPreferences)
    .values({ companyId, userId, ...patch })
    .onConflictDoUpdate({
      target: [notificationPreferences.companyId, notificationPreferences.userId],
      set: { ...patch, updatedAt: new Date() },
    })
    .returning();
  return row;
}
