import type { RuleEditorialStatus } from "../iof/rule.js";

export type RuleDeploymentStatus =
  | "inactive"
  | "scheduled"
  | "active"
  | "superseded";

export class InvalidRuleTransitionError extends Error {
  constructor(
    from: RuleEditorialStatus,
    expected: RuleEditorialStatus,
    action: string,
  ) {
    super(`Cannot ${action} a ${from} rule; expected ${expected}.`);
    this.name = "InvalidRuleTransitionError";
  }
}

export class RuleVersionLifecycle {
  constructor(readonly status: RuleEditorialStatus) {}

  submitForReview(): RuleVersionLifecycle {
    if (this.status !== "draft")
      throw new InvalidRuleTransitionError(this.status, "draft", "submit");
    return new RuleVersionLifecycle("pending_review");
  }

  approve(): RuleVersionLifecycle {
    if (this.status !== "pending_review") {
      throw new InvalidRuleTransitionError(
        this.status,
        "pending_review",
        "approve",
      );
    }
    return new RuleVersionLifecycle("approved");
  }

  reject(): RuleVersionLifecycle {
    if (this.status !== "pending_review") {
      throw new InvalidRuleTransitionError(
        this.status,
        "pending_review",
        "reject",
      );
    }
    return new RuleVersionLifecycle("rejected");
  }

  revoke(): RuleVersionLifecycle {
    if (this.status !== "approved") {
      throw new InvalidRuleTransitionError(this.status, "approved", "revoke");
    }
    return new RuleVersionLifecycle("revoked");
  }

  deploymentStatus(
    period: { effectiveFrom: string; effectiveTo: string | null },
    today: string,
  ): RuleDeploymentStatus {
    if (this.status !== "approved") return "inactive";
    if (today < period.effectiveFrom) return "scheduled";
    if (period.effectiveTo !== null && today >= period.effectiveTo)
      return "superseded";
    return "active";
  }
}
