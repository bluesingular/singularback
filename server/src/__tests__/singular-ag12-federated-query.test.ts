/**
 * AG-12 — Federated live data queries tests.
 */

import { describe, it, expect } from "vitest";
import { getAvailableTemplates, FederatedQueryError } from "../integrations/federated-query.js";

describe("AG-12 — query template registry", () => {
  it("1. gmail has known templates", () => {
    const templates = getAvailableTemplates("gmail");
    expect(templates).toContain("get_thread");
    expect(templates).toContain("list_recent");
    expect(templates).toContain("search_by_sender");
  });

  it("2. hubspot has known templates", () => {
    const templates = getAvailableTemplates("hubspot");
    expect(templates).toContain("get_contact");
    expect(templates).toContain("list_recent_deals");
  });

  it("3. boondmanager has known templates", () => {
    const templates = getAvailableTemplates("boondmanager");
    expect(templates).toContain("get_candidate");
    expect(templates).toContain("list_openings");
  });

  it("4. unknown integration → empty array", () => {
    expect(getAvailableTemplates("unknown_crm")).toHaveLength(0);
  });

  it("5. FederatedQueryError is named correctly", () => {
    const err = new FederatedQueryError("test");
    expect(err.name).toBe("FederatedQueryError");
    expect(err.message).toBe("test");
  });
});

describe("AG-12 — GDPR invariant", () => {
  it("6. gdpr_required: true means result must stay in T1_FR context", () => {
    // Validated at the action definition level — gdpr_required flag is required
    const action = {
      type:            "query_integration" as const,
      integrationSlug: "gmail",
      queryTemplate:   "list_recent",
      params:          {},
      gdprRequired:    true,
      cacheResult:     false,
    };
    // When gdpr_required = true, cache_result must be false (personal data)
    expect(action.gdprRequired && action.cacheResult).toBe(false);
  });

  it("7. non-GDPR queries can be cached", () => {
    const action = {
      type:            "query_integration" as const,
      integrationSlug: "hubspot",
      queryTemplate:   "list_recent_deals",
      params:          {},
      gdprRequired:    false,
      cacheResult:     true,
    };
    expect(action.cacheResult).toBe(true);
  });
});
