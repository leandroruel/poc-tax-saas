import { describe, expect, it } from "vitest";
import { reais } from "../shared/money.js";
import { IofEngine } from "./iof-engine.js";
import type { IofRuleVersion } from "./rule.js";

const legacyCreditRule: IofRuleVersion = {
  id: "credit-pj-legacy",
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

const vgbl2026Rule: IofRuleVersion = {
  id: "vgbl-2026",
  version: 1,
  status: "approved",
  operationType: "insurance_vgbl",
  effectiveFrom: "2026-01-01",
  effectiveTo: null,
  treatment: {
    kind: "rate",
    rate: { percentage: "5", unit: "percent" },
    basePolicy: {
      kind: "aggregate_threshold",
      scope: "all_insurers",
      threshold: reais("600000.00"),
    },
  },
  legalBasis: "Decreto 6.306/2007, art. 22, § 1º, e, e § 5º, V",
};

describe("IofEngine", () => {
  it("uses the legal version effective on the credit taxable-event date", () => {
    const outcome = new IofEngine([legacyCreditRule]).evaluate({
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

    expect(outcome).toMatchObject({
      kind: "calculated",
      result: {
        amount: reais("50.30"),
        ruleId: "credit-pj-legacy",
        operationType: "credit_pj_principal_defined",
      },
    });
  });

  it("taxes only the part of a 2026 VGBL contribution above the annual threshold", () => {
    const outcome = new IofEngine([vgbl2026Rule]).evaluate({
      tenant: { id: "tenant-2", segment: "insurance_pension" },
      operation: {
        kind: "vgbl",
        occurredOn: "2026-08-20",
        amount: reais("100000.00"),
        insured: { personType: "PF" },
        payer: "policyholder",
        priorContributions: { allInsurers: reais("550000.00") },
      },
    });

    expect(outcome).toMatchObject({
      kind: "calculated",
      result: {
        taxableBase: reais("50000.00"),
        amount: reais("2500.00"),
        ruleId: "vgbl-2026",
      },
    });
  });

  it("does not apply IOF when an employer pays the VGBL contribution", () => {
    const outcome = new IofEngine([vgbl2026Rule]).evaluate({
      tenant: { id: "tenant-2", segment: "insurance_pension" },
      operation: {
        kind: "vgbl",
        occurredOn: "2026-08-20",
        amount: reais("100000.00"),
        insured: { personType: "PF" },
        payer: "employer",
        priorContributions: { allInsurers: reais("700000.00") },
      },
    });

    expect(outcome).toEqual({
      kind: "not_applicable",
      ruleId: "vgbl-2026",
      reason: "employer_paid_vgbl",
    });
  });

  it("rejects an operation outside the tenant segment capability", () => {
    const outcome = new IofEngine([legacyCreditRule]).evaluate({
      tenant: { id: "tenant-2", segment: "insurance_pension" },
      operation: {
        kind: "credit",
        modality: "principal_defined",
        occurredOn: "2025-06-10",
        amount: reais("10000.00"),
        borrower: { personType: "PJ" },
        termInDays: 30,
      },
    });

    expect(outcome).toEqual({
      kind: "unsupported",
      reason: "segment_capability_mismatch",
    });
  });

  it("rejects invalid credit terms before applying a rate", () => {
    expect(() =>
      new IofEngine([legacyCreditRule]).evaluate({
        tenant: { id: "tenant-1", segment: "credit_provider" },
        operation: {
          kind: "credit",
          modality: "principal_defined",
          occurredOn: "2025-06-10",
          amount: reais("10000.00"),
          borrower: { personType: "PJ" },
          termInDays: -5,
        },
      }),
    ).toThrow("Credit term must be a positive safe integer.");
  });
});
