/**
 * A2 + A4 — Pack version compatibility + action type registry.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { validatePackManifest, PackIncompatibleError } from "../packs/installer.js";
import {
  registerActionType,
  getActionType,
  isKnownActionType,
  listActionTypes,
  ActionTypeUnknownError,
} from "../extensions/builtin-actions.js";

// ── A2: Pack version compatibility ────────────────────────────────────────────

const BASE_MANIFEST = {
  slug:        "test-pack",
  name:        "Test Pack",
  version:     "1.0.0",
  description: "Test",
  agents:      [{ slug: "agent-1", name: "Agent 1", description: "Test agent", modelTier: "T1_FR", skills: [] }],
  skills:      [{}],
  qualityGates: [],
  seedTasks:   [{}],
  activationSequence: [{}, {}, {}, {}, {}],
};

describe("A2 — pack version compatibility", () => {
  let savedVersion: string | undefined;

  beforeEach(() => {
    savedVersion = process.env.PLATFORM_VERSION;
  });

  afterEach(() => {
    if (savedVersion !== undefined) process.env.PLATFORM_VERSION = savedVersion;
    else delete process.env.PLATFORM_VERSION;
  });

  it("1. pack without minPlatformVersion always passes", () => {
    expect(() => validatePackManifest({ ...BASE_MANIFEST })).not.toThrow();
  });

  it("2. pack with minPlatformVersion = current version passes", () => {
    process.env.PLATFORM_VERSION = "2.0.0";
    expect(() => validatePackManifest({ ...BASE_MANIFEST, minPlatformVersion: "2.0.0" })).not.toThrow();
  });

  it("3. pack with minPlatformVersion below current passes", () => {
    process.env.PLATFORM_VERSION = "2.5.0";
    expect(() => validatePackManifest({ ...BASE_MANIFEST, minPlatformVersion: "1.0.0" })).not.toThrow();
  });

  it("4. pack with minPlatformVersion above current throws PackIncompatibleError", () => {
    process.env.PLATFORM_VERSION = "1.0.0";
    expect(() =>
      validatePackManifest({ ...BASE_MANIFEST, minPlatformVersion: "2.0.0" })
    ).toThrow(PackIncompatibleError);
  });

  it("5. PackIncompatibleError message contains pack slug and versions", () => {
    process.env.PLATFORM_VERSION = "1.0.0";
    try {
      validatePackManifest({ ...BASE_MANIFEST, minPlatformVersion: "1.5.0" });
    } catch (err) {
      expect(err).toBeInstanceOf(PackIncompatibleError);
      expect((err as Error).message).toContain("test-pack");
      expect((err as Error).message).toContain("1.5.0");
      expect((err as Error).message).toContain("1.0.0");
    }
  });

  it("6. minor version comparison: 1.5.0 > 1.4.9", () => {
    process.env.PLATFORM_VERSION = "1.5.0";
    expect(() =>
      validatePackManifest({ ...BASE_MANIFEST, minPlatformVersion: "1.4.9" })
    ).not.toThrow();
  });

  it("7. patch version comparison: 1.0.10 > 1.0.9", () => {
    process.env.PLATFORM_VERSION = "1.0.10";
    expect(() =>
      validatePackManifest({ ...BASE_MANIFEST, minPlatformVersion: "1.0.9" })
    ).not.toThrow();
  });

  it("8. minPlatformVersion defaults to 1.0.0 when PLATFORM_VERSION not set", () => {
    delete process.env.PLATFORM_VERSION;
    expect(() => validatePackManifest({ ...BASE_MANIFEST, minPlatformVersion: "0.9.0" })).not.toThrow();
    expect(() => validatePackManifest({ ...BASE_MANIFEST, minPlatformVersion: "2.0.0" })).toThrow();
  });
});

// ── A4: Action type registry ──────────────────────────────────────────────────

describe("A4 — action type registry", () => {
  it("9. built-in action types are registered at import time", () => {
    expect(isKnownActionType("send_email")).toBe(true);
    expect(isKnownActionType("create_document")).toBe(true);
    expect(isKnownActionType("web_search")).toBe(true);
    expect(isKnownActionType("handoff_to")).toBe(true);
    expect(isKnownActionType("clarify")).toBe(true);
    expect(isKnownActionType("batch")).toBe(true);
    expect(isKnownActionType("query_integration")).toBe(true);
  });

  it("10. unknown action type is not registered", () => {
    expect(isKnownActionType("send_fax_1990")).toBe(false);
  });

  it("11. getActionType returns definition for known type", () => {
    const def = getActionType("send_email");
    expect(def).toBeDefined();
    expect(def?.slug).toBe("send_email");
    expect(def?.isExternalCommunication).toBe(true);
  });

  it("12. clarify always requires approval", () => {
    const def = getActionType("clarify");
    expect(def?.alwaysRequiresApproval).toBe(true);
  });

  it("13. web_search does not require approval", () => {
    const def = getActionType("web_search");
    expect(def?.alwaysRequiresApproval).toBe(false);
    expect(def?.isExternalCommunication).toBe(false);
  });

  it("14. third-party connectors can register additional types", () => {
    registerActionType({
      slug:                   "send_whatsapp",
      name:                   "Envoyer WhatsApp",
      description:            "WhatsApp Business API",
      alwaysRequiresApproval: false,
      isExternalCommunication: true,
      handler: async () => "sent",
    });
    expect(isKnownActionType("send_whatsapp")).toBe(true);
    expect(getActionType("send_whatsapp")?.isExternalCommunication).toBe(true);
  });

  it("15. listActionTypes returns all registered types", () => {
    const types = listActionTypes();
    expect(types.length).toBeGreaterThanOrEqual(7);
    expect(types.map((t) => t.slug)).toContain("send_email");
  });

  it("16. ActionTypeUnknownError has correct name and message", () => {
    const err = new ActionTypeUnknownError("unknown_slug");
    expect(err.name).toBe("ActionTypeUnknownError");
    expect(err.message).toContain("unknown_slug");
  });
});
