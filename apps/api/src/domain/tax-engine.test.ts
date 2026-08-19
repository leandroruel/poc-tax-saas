import { describe, expect, it } from "vitest";
import { reais } from "./money.js";
import { evaluateTax } from "./tax-engine.js";
import type { TaxRule } from "./tax-rule.js";

const vgbl2025Rule: TaxRule = {
  id: "vgbl-2025",
  taxType: "IOF",
  operationType: "insurance_vgbl",
  effectiveFrom: "2025-06-11",
  effectiveTo: "2026-01-01",
  version: 1,
  rate: { percentage: "5", unit: "percent" },
  basePolicy: {
    kind: "aggregate_threshold",
    scope: "same_insurer",
    threshold: reais("300000.00"),
  },
  conditions: [
    { kind: "person_type_is", role: "insured", value: "PF" },
    { kind: "payer_is", value: "policyholder" },
  ],
  legalBasis: "Decreto 6.306/2007, art. 22, § 1º, i; § 5º, VI",
  status: "in_force",
};

const simplesCreditRule: TaxRule = {
  id: "credit-simples",
  taxType: "IOF",
  operationType: "credit_simples_mei",
  effectiveFrom: "2025-06-11",
  effectiveTo: null,
  version: 1,
  rate: { percentage: "0.00274", unit: "daily_percent" },
  additionalRate: { percentage: "0.38", unit: "percent" },
  basePolicy: { kind: "full_amount" },
  conditions: [{ kind: "maximum_amount", amount: reais("30000.00") }],
  legalBasis: "Decreto 6.306/2007, art. 7º, VI e § 15",
  status: "in_force",
};

const generalCreditRule: TaxRule = {
  ...simplesCreditRule,
  id: "credit-general",
  operationType: "credit_pj",
  rate: { percentage: "0.0082", unit: "daily_percent" },
  conditions: [],
};

const fidcRule: TaxRule = {
  id: "fidc-review",
  taxType: "IOF",
  operationType: "investment_fidc",
  effectiveFrom: "2025-06-14",
  effectiveTo: null,
  version: 1,
  rate: { percentage: "0.38", unit: "percent" },
  basePolicy: { kind: "full_amount" },
  conditions: [{ kind: "market_is", value: "primary" }],
  legalBasis: "Decreto 6.306/2007, art. 32-D",
  status: "needs_review",
};

describe("evaluateTax", () => {
  it("taxa somente a parte do aporte VGBL que cruza o acumulado de 2025", () => {
    const outcome = evaluateTax({
      taxType: "IOF",
      asOf: "2025-07-01",
      operation: {
        kind: "insurance",
        occurredOn: "2025-07-01",
        amount: reais("100000.00"),
        product: "vgbl",
        insured: { personType: "PF" },
        payer: "policyholder",
        priorContributions: { sameInsurer: reais("250000.00") },
      },
      rules: [vgbl2025Rule],
    });

    expect(outcome).toMatchObject({
      kind: "calculated",
      result: {
        taxableBase: reais("50000.00"),
        amount: reais("2500.00"),
        ruleId: "vgbl-2025",
      },
    });
  });

  it("não tributa VGBL pago pelo empregador em favor do empregado", () => {
    const outcome = evaluateTax({
      taxType: "IOF",
      asOf: "2025-07-01",
      operation: {
        kind: "insurance",
        occurredOn: "2025-07-01",
        amount: reais("500000.00"),
        product: "vgbl",
        insured: { personType: "PF" },
        payer: "employer",
        priorContributions: { sameInsurer: reais("0.00") },
      },
      rules: [vgbl2025Rule],
    });

    expect(outcome).toEqual({
      kind: "not_applicable",
      reasons: ["condition_failed:payer_is:policyholder"],
    });
  });

  it("não aplica a regra de VGBL para segurado pessoa jurídica", () => {
    const outcome = evaluateTax({
      taxType: "IOF",
      asOf: "2025-07-01",
      operation: {
        kind: "insurance",
        occurredOn: "2025-07-01",
        amount: reais("500000.00"),
        product: "vgbl",
        insured: { personType: "PJ" },
        payer: "policyholder",
        priorContributions: { sameInsurer: reais("0.00") },
      },
      rules: [vgbl2025Rule],
    });

    expect(outcome).toEqual({
      kind: "not_applicable",
      reasons: ["condition_failed:person_type_is:insured:PF"],
    });
  });

  it("aplica a regra do Simples/MEI ao crédito de até R$ 30 mil", () => {
    const outcome = evaluateTax({
      taxType: "IOF",
      asOf: "2025-07-01",
      operation: {
        kind: "credit",
        occurredOn: "2025-07-01",
        amount: reais("10000.00"),
        borrower: { personType: "PJ", category: "simples_mei" },
        optedIntoSimples: true,
        termInDays: 30,
      },
      rules: [simplesCreditRule],
    });

    expect(outcome).toMatchObject({
      kind: "calculated",
      result: {
        amount: reais("46.22"),
        taxableBase: reais("10000.00"),
        operationType: "credit_simples_mei",
      },
    });
  });

  it("limita a incidência diária do crédito a 365 dias e explica o limite", () => {
    const outcome = evaluateTax({
      taxType: "IOF",
      asOf: "2025-07-01",
      operation: {
        kind: "credit",
        occurredOn: "2025-07-01",
        amount: reais("10000.00"),
        borrower: { personType: "PJ" },
        optedIntoSimples: false,
        termInDays: 400,
      },
      rules: [generalCreditRule],
    });

    expect(outcome).toMatchObject({
      kind: "calculated",
      result: {
        amount: reais("337.30"),
        evidence: expect.arrayContaining(["taxable_days:365", "term_days_capped_from:400"]),
      },
    });
  });

  it("usa a regra geral de PJ quando o crédito do Simples ultrapassa R$ 30 mil", () => {
    const outcome = evaluateTax({
      taxType: "IOF",
      asOf: "2025-07-01",
      operation: {
        kind: "credit",
        occurredOn: "2025-07-01",
        amount: reais("40000.00"),
        borrower: { personType: "PJ", category: "simples_mei" },
        optedIntoSimples: true,
        termInDays: 30,
      },
      rules: [simplesCreditRule, generalCreditRule],
    });

    expect(outcome).toMatchObject({
      kind: "calculated",
      result: { ruleId: "credit-general", amount: reais("250.40") },
    });
  });

  it("exige o acumulado correspondente ao escopo da regra de VGBL", () => {
    const rule2026: TaxRule = {
      ...vgbl2025Rule,
      id: "vgbl-2026",
      effectiveFrom: "2026-01-01",
      effectiveTo: null,
      version: 2,
      basePolicy: {
        kind: "aggregate_threshold",
        scope: "all_insurers",
        threshold: reais("600000.00"),
      },
    };
    const outcome = evaluateTax({
      taxType: "IOF",
      asOf: "2026-03-01",
      operation: {
        kind: "insurance",
        occurredOn: "2026-03-01",
        amount: reais("100000.00"),
        product: "vgbl",
        insured: { personType: "PF" },
        payer: "policyholder",
        priorContributions: { sameInsurer: reais("550000.00") },
      },
      rules: [rule2026],
    });

    expect(outcome).toEqual({
      kind: "requires_context",
      missing: ["prior_contributions:all_insurers"],
    });
  });

  it("trata aquisição de FIDC no mercado secundário como não aplicável", () => {
    const outcome = evaluateTax({
      taxType: "IOF",
      asOf: "2025-07-01",
      operation: {
        kind: "investment",
        occurredOn: "2025-07-01",
        amount: reais("10000.00"),
        instrument: "fidc",
        market: "secondary",
      },
      rules: [{ ...fidcRule, status: "in_force" }],
    });

    expect(outcome).toEqual({
      kind: "not_applicable",
      reasons: ["condition_failed:market_is:primary"],
    });
  });

  it("não publica cálculo definitivo para regra que precisa de revisão", () => {
    const outcome = evaluateTax({
      taxType: "IOF",
      asOf: "2025-07-01",
      operation: {
        kind: "investment",
        occurredOn: "2025-07-01",
        amount: reais("10000.00"),
        instrument: "fidc",
        market: "primary",
      },
      rules: [fidcRule],
    });

    expect(outcome).toEqual({
      kind: "requires_review",
      ruleId: "fidc-review",
      status: "needs_review",
    });
  });

  it("recusa períodos sobrepostos em vez de escolher uma regra silenciosamente", () => {
    const first: TaxRule = {
      ...simplesCreditRule,
      id: "general-v1",
      operationType: "credit_pj",
      version: 1,
      conditions: [],
    };
    const second: TaxRule = { ...first, id: "general-v2", version: 2 };

    const outcome = evaluateTax({
      taxType: "IOF",
      asOf: "2025-07-01",
      operation: {
        kind: "credit",
        occurredOn: "2025-07-01",
        amount: reais("10000.00"),
        borrower: { personType: "PJ" },
        optedIntoSimples: false,
        termInDays: 30,
      },
      rules: [first, second],
    });

    expect(outcome).toEqual({
      kind: "ambiguous_rule",
      ruleIds: ["general-v2", "general-v1"],
    });
  });
});
