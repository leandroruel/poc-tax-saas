import { describe, expect, it } from "vitest";
import { reais } from "../domain/shared/money.js";
import type { IofRuleVersion } from "../domain/iof/rule.js";
import { createCalculateTax } from "./calculate-tax.js";

const rule: IofRuleVersion = {
  id: "credit-legacy-v1",
  version: 1,
  status: "approved",
  operationType: "credit_pj_principal_defined",
  effectiveFrom: "2025-01-01",
  effectiveTo: "2025-06-11",
  treatment: {
    kind: "rate",
    rate: { percentage: "0.0041", unit: "daily_percent" },
    additionalRate: { percentage: "0.38", unit: "percent" },
    basePolicy: { kind: "full_amount" },
  },
  legalBasis: "Decreto 6.306/2007, art. 7º",
};

describe("calculateTax", () => {
  it("records the immutable rule snapshot selected by the operation date", async () => {
    let recordedRule: IofRuleVersion | undefined;
    const calculateTax = createCalculateTax({
      ruleCatalog: { findApprovedEffective: async () => [rule] },
      calculationJournal: {
        record: async ({ selectedRule }) => {
          recordedRule = selectedRule;
          return { calculationId: "calculation-1" };
        },
      },
    });

    const response = await calculateTax({
      actorUserId: "user-1",
      tenant: { id: "tenant-1", segment: "credit_provider" },
      operation: {
        kind: "credit",
        modality: "principal_defined",
        occurredOn: "2025-06-10",
        amount: reais("10000.00"),
        borrower: { personType: "PJ" },
        termInDays: 30,
      },
    });

    expect(response).toMatchObject({
      calculationId: "calculation-1",
      outcome: { kind: "calculated", result: { amount: reais("50.30") } },
    });
    expect(recordedRule).toEqual(rule);
  });

  it("does not record a selected rule when approved periods are ambiguous", async () => {
    let recordedRule: IofRuleVersion | undefined;
    const calculateTax = createCalculateTax({
      ruleCatalog: {
        findApprovedEffective: async () => [
          rule,
          { ...rule, id: "credit-legacy-v2", version: 2 },
        ],
      },
      calculationJournal: {
        record: async ({ selectedRule }) => {
          recordedRule = selectedRule;
          return { calculationId: "calculation-ambiguous" };
        },
      },
    });

    const response = await calculateTax({
      actorUserId: "user-1",
      tenant: { id: "tenant-1", segment: "credit_provider" },
      operation: {
        kind: "credit",
        modality: "principal_defined",
        occurredOn: "2025-06-10",
        amount: reais("10000.00"),
        borrower: { personType: "PJ" },
        termInDays: 30,
      },
    });

    expect(response.outcome.kind).toBe("ambiguous_rule");
    expect(recordedRule).toBeUndefined();
  });

  it("records the rule that establishes a non-applicable outcome", async () => {
    const nonApplicableRule: IofRuleVersion = {
      ...rule,
      id: "credit-suspended-v1",
      treatment: {
        kind: "not_applicable",
        reason: "decree_12499_suspended",
      },
    };
    let recordedRule: IofRuleVersion | undefined;
    const calculateTax = createCalculateTax({
      ruleCatalog: {
        findApprovedEffective: async () => [nonApplicableRule],
      },
      calculationJournal: {
        record: async ({ selectedRule }) => {
          recordedRule = selectedRule;
          return { calculationId: "calculation-not-applicable" };
        },
      },
    });

    await calculateTax({
      actorUserId: "user-1",
      tenant: { id: "tenant-1", segment: "credit_provider" },
      operation: {
        kind: "credit",
        modality: "principal_defined",
        occurredOn: "2025-06-10",
        amount: reais("10000.00"),
        borrower: { personType: "PJ" },
        termInDays: 30,
      },
    });

    expect(recordedRule).toEqual(nonApplicableRule);
  });
});
