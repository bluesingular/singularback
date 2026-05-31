/**
 * Gap D — Model upgrade resilience tests.
 */

import { describe, it, expect } from "vitest";
import { applyModelPin } from "../llm/model-pins.js";

describe("Gap D — applyModelPin", () => {
  it("1. non-GDPR skill: applies pin regardless of EU status", () => {
    const result = applyModelPin({
      originalModel: "mistralai/mistral-small-3.2",
      pinnedModel:   "google/gemini-flash-1.5",
      gdprRequired:  false,
    });
    expect(result).toBe("google/gemini-flash-1.5");
  });

  it("2. GDPR skill + EU-hosted pin → applies pin", () => {
    const result = applyModelPin({
      originalModel: "mistralai/mistral-small-3.2",
      pinnedModel:   "mistralai/mistral-medium-3.1",
      gdprRequired:  true,
    });
    expect(result).toBe("mistralai/mistral-medium-3.1");
  });

  it("3. GDPR skill + non-EU pin → falls back to original (GDPR invariant)", () => {
    const result = applyModelPin({
      originalModel: "mistralai/mistral-small-3.2",
      pinnedModel:   "deepseek/deepseek-chat-v3-5",
      gdprRequired:  true,
    });
    expect(result).toBe("mistralai/mistral-small-3.2");
  });

  it("4. GDPR skill + Gemini pin → falls back (Gemini not EU-hosted)", () => {
    const result = applyModelPin({
      originalModel: "mistralai/mistral-small-3.2",
      pinnedModel:   "google/gemini-flash-1.5",
      gdprRequired:  true,
    });
    expect(result).toBe("mistralai/mistral-small-3.2");
  });

  it("5. same model as pin → no change", () => {
    const result = applyModelPin({
      originalModel: "mistralai/mistral-small-3.2",
      pinnedModel:   "mistralai/mistral-small-3.2",
      gdprRequired:  false,
    });
    expect(result).toBe("mistralai/mistral-small-3.2");
  });

  it("6. EU models list includes all 4 Mistral models", () => {
    const euModels = [
      "mistralai/ministral-3b",
      "mistralai/mistral-small-3.2",
      "mistralai/mistral-medium-3.1",
      "mistralai/mistral-large-2411",
    ];
    for (const model of euModels) {
      const result = applyModelPin({
        originalModel: "mistralai/mistral-small-3.2",
        pinnedModel:   model,
        gdprRequired:  true,
      });
      expect(result).toBe(model);
    }
  });
});
