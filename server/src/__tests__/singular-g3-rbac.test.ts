/**
 * G3 — RBAC: role→permission matrix
 *
 * Tests:
 *  1. owner has all permissions
 *  2. admin has operator permissions but not billing:manage or company:delete
 *  3. operator can approve tasks but not install packs
 *  4. viewer can only dismiss intelligence
 *  5. api role can approve tasks but not install packs or invite users
 *  6. normaliseRole: 'manager' (legacy) → 'operator'
 *  7. normaliseRole: unknown string → 'viewer'
 *  8. requireRole: owner passes admin check
 *  9. requireRole: viewer fails operator check
 * 10. requireRole: api passes operator check (same level)
 */

import { describe, expect, it } from "vitest";
import { ROLE_PERMISSIONS, COMPANY_ROLES } from "@paperclipai/shared";

describe("ROLE_PERMISSIONS matrix", () => {
  it("1. owner has all permissions", () => {
    const ownerPerms = ROLE_PERMISSIONS.owner as readonly string[];
    expect(ownerPerms).toContain("billing:manage");
    expect(ownerPerms).toContain("company:delete");
    expect(ownerPerms).toContain("tasks:approve");
    expect(ownerPerms).toContain("agents:create");
    expect(ownerPerms).toContain("users:invite");
    expect(ownerPerms).toContain("trust:manage");
  });

  it("2. admin has operator permissions but not billing:manage or company:delete", () => {
    const adminPerms = ROLE_PERMISSIONS.admin as readonly string[];
    expect(adminPerms).toContain("tasks:approve");
    expect(adminPerms).toContain("agents:create");
    expect(adminPerms).toContain("packs:install");
    expect(adminPerms).not.toContain("billing:manage");
    expect(adminPerms).not.toContain("company:delete");
  });

  it("3. operator can approve tasks but not install packs", () => {
    const opPerms = ROLE_PERMISSIONS.operator as readonly string[];
    expect(opPerms).toContain("tasks:approve");
    expect(opPerms).toContain("trust:manage");
    expect(opPerms).not.toContain("packs:install");
    expect(opPerms).not.toContain("agents:create");
    expect(opPerms).not.toContain("users:invite");
    expect(opPerms).not.toContain("billing:manage");
  });

  it("4. viewer can only dismiss intelligence", () => {
    const viewerPerms = ROLE_PERMISSIONS.viewer as readonly string[];
    expect(viewerPerms).toEqual(["intelligence:dismiss"]);
  });

  it("5. api role can approve tasks but not install packs or invite users", () => {
    const apiPerms = ROLE_PERMISSIONS.api as readonly string[];
    expect(apiPerms).toContain("tasks:approve");
    expect(apiPerms).toContain("tasks:assign");
    expect(apiPerms).not.toContain("packs:install");
    expect(apiPerms).not.toContain("users:invite");
    expect(apiPerms).not.toContain("billing:manage");
  });

  it("6. all COMPANY_ROLES are present in ROLE_PERMISSIONS", () => {
    for (const role of COMPANY_ROLES) {
      expect(ROLE_PERMISSIONS[role]).toBeDefined();
    }
  });
});

describe("normaliseRole", () => {
  it("7. 'manager' (legacy) normalises to 'operator'", async () => {
    const { normaliseRole } = await import("../middleware/company-context.js");
    expect(normaliseRole("manager")).toBe("operator");
  });

  it("8. unknown string normalises to 'viewer'", async () => {
    const { normaliseRole } = await import("../middleware/company-context.js");
    expect(normaliseRole("superadmin")).toBe("viewer");
    expect(normaliseRole(null)).toBe("viewer");
    expect(normaliseRole(undefined)).toBe("viewer");
  });
});

describe("roleHasPermission", () => {
  it("9. owner has billing:manage", async () => {
    const { roleHasPermission } = await import("../middleware/company-context.js");
    expect(roleHasPermission("owner", "billing:manage")).toBe(true);
  });

  it("10. operator does not have packs:install", async () => {
    const { roleHasPermission } = await import("../middleware/company-context.js");
    expect(roleHasPermission("operator", "packs:install")).toBe(false);
  });

  it("11. viewer does not have tasks:approve", async () => {
    const { roleHasPermission } = await import("../middleware/company-context.js");
    expect(roleHasPermission("viewer", "tasks:approve")).toBe(false);
  });

  it("12. api has tasks:approve", async () => {
    const { roleHasPermission } = await import("../middleware/company-context.js");
    expect(roleHasPermission("api", "tasks:approve")).toBe(true);
  });
});
