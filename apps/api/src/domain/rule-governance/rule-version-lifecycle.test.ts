import { describe, expect, it } from "vitest";
import { RuleVersionLifecycle } from "./rule-version-lifecycle.js";

describe("RuleVersionLifecycle", () => {
  it("only approves a version that is pending review", () => {
    const draft = new RuleVersionLifecycle("draft");

    expect(() => draft.approve()).toThrowError("pending_review");
    expect(draft.submitForReview().approve().status).toBe("approved");
  });
});
