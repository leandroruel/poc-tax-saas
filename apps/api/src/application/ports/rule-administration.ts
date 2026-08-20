import type {
  RuleEditorialStatus,
  TaxTreatment,
} from "../../domain/iof/rule.js";
import type { RuleDeploymentStatus } from "../../domain/rule-governance/rule-version-lifecycle.js";

export interface RuleVersionView {
  id: string;
  version: number;
  editorialStatus: RuleEditorialStatus;
  deploymentStatus: RuleDeploymentStatus;
  effectiveFrom: string;
  effectiveTo: string | null;
  treatment: unknown;
  legalBasis: string;
  sourceUrl: string;
  changeReason: string;
  createdAt: string;
}

export interface RuleView {
  id: string;
  code: string;
  operationType: string;
  versions: RuleVersionView[];
}

export interface CreateRuleVersionInput {
  actorUserId: string;
  ruleCode: string;
  operationType: "credit_pj_principal_defined" | "insurance_vgbl";
  effectiveFrom: string;
  effectiveTo: string | null;
  treatment: TaxTreatment;
  legalBasis: string;
  sourceUrl: string;
  changeReason: string;
}

export interface RuleAdministration {
  list(today: string): Promise<RuleView[]>;
  createDraft(input: CreateRuleVersionInput): Promise<{ versionId: string }>;
  transition(input: {
    actorUserId: string;
    versionId: string;
    action: "submit" | "approve" | "reject" | "revoke";
  }): Promise<void>;
  audit(): Promise<unknown[]>;
}
