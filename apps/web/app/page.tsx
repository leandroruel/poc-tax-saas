"use client";

import * as React from "react";
import {
  Building2,
  Calculator,
  ChevronRight,
  FileClock,
  LayoutDashboard,
  LogOut,
  Menu,
  Scale,
  Settings2,
  ShieldCheck,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Section =
  | "overview"
  | "calculate"
  | "history"
  | "company"
  | "rules"
  | "audit";
type Me = {
  id: string;
  name: string;
  email: string;
  platformRole: "user" | "super_admin";
  onboardingRequired: boolean;
  membership: null | {
    role: string;
    organization: {
      id: string;
      name: string;
      slug: string;
      segment: "credit_provider" | "insurance_pension";
    };
  };
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "include",
    headers: { "content-type": "application/json", ...init?.headers },
  });
  const text = response.status === 204 ? "" : await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }
  const errorPayload =
    payload && typeof payload === "object"
      ? (payload as { message?: string; error?: string })
      : null;
  if (!response.ok)
    throw new Error(
      errorPayload?.message ??
        errorPayload?.error ??
        `Não foi possível concluir a operação. (HTTP ${response.status})`,
    );
  return payload as T;
}

function useApiQuery<T>(path: string) {
  const [data, setData] = React.useState<T | null>(null);
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const mounted = React.useRef(true);

  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const reload = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const next = await api<T>(path);
      if (mounted.current) setData(next);
    } catch (reason) {
      if (mounted.current) {
        setError(
          reason instanceof Error
            ? reason.message
            : "Não foi possível carregar os dados.",
        );
      }
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [path]);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  return { data, error, loading, reload };
}

function AuthScreen() {
  const [creating, setCreating] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const credentials = {
      email: String(form.get("email")),
      password: String(form.get("password")),
    };
    try {
      const result = creating
        ? await authClient.signUp.email({
            ...credentials,
            name: String(form.get("name")),
          })
        : await authClient.signIn.email(credentials);
      if (result.error) {
        setError(result.error.message ?? "Credenciais inválidas.");
        return;
      }
      window.location.reload();
    } catch {
      setError("Serviço de autenticação indisponível. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-story">
        <div className="brand">
          <span className="brand-mark">
            <Scale size={22} />
          </span>{" "}
          TaxMan
        </div>
        <div className="auth-copy">
          <span className="eyebrow">Motor tributário B2B</span>
          <h1>Decisões fiscais rastreáveis, não planilhas frágeis.</h1>
          <p>
            Calcule IOF com regras versionadas, vigência histórica e evidências
            prontas para auditoria.
          </p>
        </div>
        <div className="trust-row">
          <ShieldCheck size={18} /> Ambiente local do MVP · dados pessoais
          protegidos
        </div>
      </section>
      <section className="auth-form-wrap">
        <form className="auth-form" onSubmit={submit}>
          <div>
            <span className="step-caption">
              {creating ? "Etapa 1 de 4" : "Acesso seguro"}
            </span>
            <h2>{creating ? "Crie sua conta" : "Bem-vindo de volta"}</h2>
            <p>
              {creating
                ? "Depois, cadastraremos sua empresa."
                : "Entre para acessar o workspace da sua empresa."}
            </p>
          </div>
          {creating && (
            <Field label="Seu nome">
              <Input name="name" autoComplete="name" required />
            </Field>
          )}
          <Field label="E-mail profissional">
            <Input name="email" type="email" autoComplete="email" required />
          </Field>
          <Field label="Senha">
            <Input
              name="password"
              type="password"
              minLength={8}
              autoComplete={creating ? "new-password" : "current-password"}
              required
            />
          </Field>
          {error && <p className="form-error">{error}</p>}
          <Button className="w-full" disabled={busy}>
            {busy ? "Aguarde..." : creating ? "Continuar cadastro" : "Entrar"}
          </Button>
          <button
            type="button"
            className="text-link"
            onClick={() => {
              setCreating(!creating);
              setError("");
            }}
          >
            {creating ? "Já tenho uma conta" : "Criar conta empresarial"}
          </button>
        </form>
      </section>
    </main>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="field">
      <Label>{label}</Label>
      {children}
      {hint && <small>{hint}</small>}
    </div>
  );
}

function Onboarding({ me }: { me: Me }) {
  const [step, setStep] = React.useState(2);
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [data, setData] = React.useState({
    cpf: "",
    name: "",
    slug: "",
    cnpj: "",
    segment: "credit_provider",
  });
  const set =
    (key: keyof typeof data) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setData({ ...data, [key]: event.target.value });

  async function finish() {
    setBusy(true);
    setError("");
    try {
      await api("/api/onboarding", {
        method: "POST",
        body: JSON.stringify({
          cpf: data.cpf,
          company: {
            name: data.name,
            slug: data.slug,
            cnpj: data.cnpj,
            segment: data.segment,
          },
        }),
      });
      window.location.reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha no cadastro.");
      setBusy(false);
    }
  }

  return (
    <main className="onboarding-shell">
      <div className="brand dark">
        <span className="brand-mark">
          <Scale size={22} />
        </span>{" "}
        TaxMan
      </div>
      <section className="onboarding-card">
        <div className="progress">
          <span style={{ width: `${step * 25}%` }} />
        </div>
        <div className="step-caption">Etapa {step} de 4</div>
        {step === 2 && (
          <>
            <h1>Dados do responsável</h1>
            <p>
              Seu CPF será usado futuramente para cobrança e emissão fiscal. Ele
              é criptografado antes de ser salvo.
            </p>
            <Field label="CPF">
              <Input
                value={data.cpf}
                onChange={set("cpf")}
                placeholder="000.000.000-00"
                autoFocus
              />
            </Field>
          </>
        )}
        {step === 3 && (
          <>
            <h1>Identifique sua empresa</h1>
            <p>O acesso ao TaxMan é exclusivo para pessoas jurídicas.</p>
            <Field label="Razão social">
              <Input value={data.name} onChange={set("name")} autoFocus />
            </Field>
            <Field
              label="Identificador do workspace"
              hint="Somente letras minúsculas, números e hífen."
            >
              <Input
                value={data.slug}
                onChange={set("slug")}
                placeholder="minha-empresa"
              />
            </Field>
            <Field label="CNPJ">
              <Input
                value={data.cnpj}
                onChange={set("cnpj")}
                placeholder="Numérico ou alfanumérico"
              />
            </Field>
          </>
        )}
        {step === 4 && (
          <>
            <h1>Qual é o seu segmento?</h1>
            <p>
              O segmento define quais modalidades o workspace pode calcular. Ele
              não altera fórmulas tributárias.
            </p>
            <div className="segment-grid">
              {[
                {
                  id: "credit_provider",
                  icon: Building2,
                  title: "Crédito e fintech",
                  text: "Bancos, fintechs e instituições de crédito.",
                },
                {
                  id: "insurance_pension",
                  icon: ShieldCheck,
                  title: "Seguros e previdência",
                  text: "Seguradoras e operadores de previdência.",
                },
              ].map(({ id, icon: Icon, title, text }) => (
                <button
                  type="button"
                  key={id}
                  className={`segment-option ${data.segment === id ? "selected" : ""}`}
                  onClick={() => setData({ ...data, segment: id })}
                >
                  <Icon />
                  <strong>{title}</strong>
                  <span>{text}</span>
                </button>
              ))}
            </div>
          </>
        )}
        {error && <p className="form-error">{error}</p>}
        <div className="onboarding-actions">
          {step > 2 && (
            <Button variant="outline" onClick={() => setStep(step - 1)}>
              Voltar
            </Button>
          )}
          <Button
            onClick={() => (step < 4 ? setStep(step + 1) : finish())}
            disabled={
              busy ||
              (step === 2 && !data.cpf) ||
              (step === 3 && (!data.name || !data.slug || !data.cnpj))
            }
          >
            {busy
              ? "Criando workspace..."
              : step === 4
                ? "Concluir cadastro"
                : "Continuar"}
            <ChevronRight size={16} />
          </Button>
        </div>
      </section>
      <p className="signed-as">Conectado como {me.email}</p>
    </main>
  );
}

function Panel({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="panel">
      <header className="panel-header">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action}
      </header>
      <div className="panel-body">{children}</div>
    </section>
  );
}

function Overview({ setSection }: { setSection: (section: Section) => void }) {
  const { data, error, loading } = useApiQuery<any>("/api/dashboard");
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Visão geral</span>
          <h1>Operação tributária</h1>
          <p>Acompanhe os cálculos e a cobertura do seu workspace.</p>
        </div>
        <Button onClick={() => setSection("calculate")}>
          <Calculator size={16} /> Novo cálculo
        </Button>
      </div>
      <div className="metric-grid">
        <div className="metric">
          <span>Cálculos registrados</span>
          <strong>{data?.totalCalculations ?? "—"}</strong>
          <small>Histórico imutável</small>
        </div>
        <div className="metric">
          <span>Tributo disponível</span>
          <strong>IOF</strong>
          <small>Crédito PJ e VGBL</small>
        </div>
        <div className="metric">
          <span>Catálogo</span>
          <strong>{data ? `${data.ruleVersionCount} versões` : "—"}</strong>
          <small>Vigência 2025 → atual</small>
        </div>
      </div>
      <Panel
        title="Atividade recente"
        subtitle="Últimos cálculos realizados neste workspace."
      >
        {error ? (
          <Empty text={error} />
        ) : loading || !data ? (
          <Empty text="Carregando atividade..." />
        ) : data.recentCalculations.length === 0 ? (
          <Empty text="Nenhum cálculo registrado. Crie o primeiro para iniciar o histórico." />
        ) : (
          <CalculationRows rows={data.recentCalculations} />
        )}
      </Panel>
    </>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="empty-state">
      <FileClock />
      <p>{text}</p>
    </div>
  );
}
function money(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}
function CalculationRows({ rows }: { rows: any[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Operação</th>
            <th>Data</th>
            <th>Status</th>
            <th>IOF</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <strong>
                  {row.operationType === "insurance_vgbl"
                    ? "VGBL"
                    : "Crédito PJ"}
                </strong>
                <small>{row.id.slice(0, 13)}</small>
              </td>
              <td>
                {new Date(`${row.occurredOn}T12:00:00`).toLocaleDateString(
                  "pt-BR",
                )}
              </td>
              <td>
                <span className={`badge ${row.outcome.kind}`}>
                  {row.outcome.kind}
                </span>
              </td>
              <td>
                {row.outcome.result
                  ? money(Number(row.outcome.result.amount))
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Calculate({
  segment,
}: {
  segment: "credit_provider" | "insurance_pension";
}) {
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<any>(null);
  const [error, setError] = React.useState("");
  const isCredit = segment === "credit_provider";
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const common = {
      occurredOn: String(form.get("date")),
      amount: Number(form.get("amount")),
    };
    const operation = isCredit
      ? {
          ...common,
          kind: "credit",
          modality: "principal_defined",
          borrower: { personType: "PJ" },
          termInDays: Number(form.get("days")),
        }
      : {
          ...common,
          kind: "vgbl",
          insured: { personType: "PF" },
          payer: form.get("payer"),
          priorContributions: {
            sameInsurer: Number(form.get("sameInsurer") || 0),
            allInsurers: Number(form.get("allInsurers") || 0),
          },
        };
    try {
      setResult(
        await api("/tax/calculate", {
          method: "POST",
          body: JSON.stringify({ operation }),
        }),
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha no cálculo.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Novo cálculo</span>
          <h1>
            {isCredit ? "IOF sobre crédito PJ" : "IOF sobre aportes VGBL"}
          </h1>
          <p>
            {isCredit
              ? "Recorte suportado: principal e prazo definidos, mutuário pessoa jurídica."
              : "Informe os aportes anteriores antes deste aporte no ano-calendário."}
          </p>
        </div>
      </div>
      <div className="calculate-grid">
        <Panel
          title="Dados da operação"
          subtitle="A data da operação determina automaticamente a versão da regra."
        >
          <form className="form-grid" onSubmit={submit}>
            <Field label="Data da operação">
              <Input
                name="date"
                type="date"
                defaultValue="2026-08-20"
                required
              />
            </Field>
            <Field label="Valor da operação">
              <Input
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                defaultValue="10000"
                required
              />
            </Field>
            {isCredit ? (
              <Field label="Prazo em dias">
                <Input
                  name="days"
                  type="number"
                  min="1"
                  defaultValue="30"
                  required
                />
              </Field>
            ) : (
              <>
                <Field label="Responsável pelo aporte">
                  <Select name="payer">
                    <option value="policyholder">Segurado / titular</option>
                    <option value="employer">Empregador</option>
                  </Select>
                </Field>
                <Field label="Aportes anteriores na mesma seguradora">
                  <Input
                    name="sameInsurer"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue="0"
                  />
                </Field>
                <Field label="Aportes anteriores em todas as seguradoras">
                  <Input
                    name="allInsurers"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue="0"
                  />
                </Field>
              </>
            )}
            <div className="form-submit">
              {error && <p className="form-error">{error}</p>}
              <Button disabled={busy}>
                {busy ? "Calculando..." : "Calcular e registrar"}
              </Button>
            </div>
          </form>
        </Panel>
        <Panel
          title="Resultado auditável"
          subtitle="A memória de cálculo e o snapshot da regra ficam no histórico."
        >
          {!result ? (
            <Empty text="Preencha a operação para visualizar o resultado." />
          ) : (
            <div className="result">
              <span className={`badge ${result.status}`}>{result.status}</span>
              <strong>
                {result.result
                  ? money(result.result.amount)
                  : "Sem recolhimento"}
              </strong>
              <p>{result.explanation}</p>
              {result.result && (
                <dl>
                  <div>
                    <dt>Base tributável</dt>
                    <dd>{money(result.result.taxableBase)}</dd>
                  </div>
                  <div>
                    <dt>Regra</dt>
                    <dd>v{result.result.ruleVersion}</dd>
                  </div>
                  <div>
                    <dt>Fundamento</dt>
                    <dd>{result.result.legalBasis}</dd>
                  </div>
                </dl>
              )}
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}

function History() {
  const { data: rows, error, loading } =
    useApiQuery<any[]>("/api/calculations");
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Auditoria operacional</span>
          <h1>Histórico de cálculos</h1>
          <p>
            Cada registro conserva os dados de entrada, resultado e regra
            aplicada.
          </p>
        </div>
      </div>
      <Panel title="Cálculos" subtitle="Até 100 registros mais recentes.">
        {error ? (
          <Empty text={error} />
        ) : loading || rows === null ? (
          <Empty text="Carregando histórico..." />
        ) : rows.length ? (
          <CalculationRows rows={rows} />
        ) : (
          <Empty text="Nenhum cálculo encontrado." />
        )}
      </Panel>
    </>
  );
}

function Company() {
  const { data: company, error, loading } =
    useApiQuery<any>("/api/company");
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Workspace</span>
          <h1>Empresa e equipe</h1>
          <p>Membership e permissões da organização ativa.</p>
        </div>
      </div>
      <Panel
        title={company?.name ?? (loading ? "Carregando empresa..." : "Empresa")}
        subtitle={company ? `${company.slug} · ${company.segment}` : undefined}
      >
        {error ? (
          <Empty text={error} />
        ) : company ? (
          <div className="member-list">
            {company.members.map((member: any) => (
              <div className="member" key={member.id}>
                <span className="avatar">
                  {member.user.name.slice(0, 2).toUpperCase()}
                </span>
                <div>
                  <strong>{member.user.name}</strong>
                  <small>{member.user.email}</small>
                </div>
                <span className="badge neutral">{member.role}</span>
              </div>
            ))}
          </div>
        ) : (
          <Empty text="Carregando empresa..." />
        )}
      </Panel>
    </>
  );
}

function Rules({ audit = false }: { audit?: boolean }) {
  const endpoint = audit ? "/api/admin/audit" : "/api/admin/rules";
  const {
    data,
    error: loadError,
    loading,
    reload,
  } = useApiQuery<any[]>(endpoint);
  const [creating, setCreating] = React.useState(false);
  const [error, setError] = React.useState("");
  const [draftOperationType, setDraftOperationType] = React.useState<
    "credit_pj_principal_defined" | "insurance_vgbl"
  >("credit_pj_principal_defined");

  async function transition(id: string, action: string) {
    setError("");
    try {
      await api(`/api/admin/rules/versions/${id}/transition`, {
        method: "POST",
        body: JSON.stringify({ action }),
      });
      await reload();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Transição inválida.",
      );
    }
  }

  async function createDraft(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const operationType = String(form.get("operationType"));
    const isCredit = operationType === "credit_pj_principal_defined";
    const body = {
      ruleCode: String(form.get("ruleCode")),
      operationType,
      effectiveFrom: String(form.get("effectiveFrom")),
      effectiveTo: form.get("effectiveTo")
        ? String(form.get("effectiveTo"))
        : null,
      treatment: isCredit
        ? {
            kind: "rate",
            rate: {
              percentage: String(form.get("rate")),
              unit: "daily_percent",
            },
            additionalRate: {
              percentage: String(form.get("additionalRate")),
              unit: "percent",
            },
            basePolicy: { kind: "full_amount" },
          }
        : {
            kind: "rate",
            rate: { percentage: String(form.get("rate")), unit: "percent" },
            basePolicy: {
              kind: "aggregate_threshold",
              scope: String(form.get("scope")),
              threshold: String(form.get("threshold")),
            },
          },
      legalBasis: String(form.get("legalBasis")),
      sourceUrl: String(form.get("sourceUrl")),
      changeReason: String(form.get("changeReason")),
    };
    setError("");
    try {
      await api("/api/admin/rules/versions", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setCreating(false);
      await reload();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível criar o rascunho.",
      );
    }
  }

  if (audit) {
    return (
      <>
        <div className="page-heading">
          <div>
            <span className="eyebrow">Plataforma</span>
            <h1>Trilha de auditoria</h1>
            <p>Ações sensíveis registradas de forma append-only.</p>
          </div>
        </div>
        <Panel title="Eventos recentes">
          {loadError ? (
            <Empty text={loadError} />
          ) : loading || !data ? (
            <Empty text="Carregando auditoria..." />
          ) : (
            <div className="audit-list">
              {data.map((event: any) => (
                <div key={event.id}>
                  <span className="audit-dot" />
                  <div>
                    <strong>{event.action}</strong>
                    <small>
                      {event.entityType} · {event.entityId}
                    </small>
                  </div>
                  <time>
                    {new Date(event.occurredAt).toLocaleString("pt-BR")}
                  </time>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </>
    );
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Administração global</span>
          <h1>Catálogo de regras</h1>
          <p>Somente o super-admin cadastra, revisa e aprova fórmulas.</p>
        </div>
        <Button onClick={() => setCreating(!creating)}>
          {creating ? "Cancelar" : "Nova versão"}
        </Button>
      </div>
      {creating && (
        <Panel
          title="Cadastrar versão"
          subtitle="A versão nasce como rascunho e precisa passar por revisão."
        >
          <form className="form-grid admin-form" onSubmit={createDraft}>
            <Field label="Código da regra">
              <Input
                key={draftOperationType}
                name="ruleCode"
                defaultValue={
                  draftOperationType === "credit_pj_principal_defined"
                    ? "IOF_CREDIT_PJ_PRINCIPAL_DEFINED"
                    : "IOF_INSURANCE_VGBL"
                }
                required
              />
            </Field>
            <Field label="Modalidade">
              <Select
                name="operationType"
                value={draftOperationType}
                onChange={(event) =>
                  setDraftOperationType(
                    event.target.value as typeof draftOperationType,
                  )
                }
              >
                <option value="credit_pj_principal_defined">
                  Crédito PJ · principal definido
                </option>
                <option value="insurance_vgbl">VGBL</option>
              </Select>
            </Field>
            <Field label="Vigência inicial">
              <Input name="effectiveFrom" type="date" required />
            </Field>
            <Field label="Vigência final (exclusiva)">
              <Input name="effectiveTo" type="date" />
            </Field>
            {draftOperationType === "credit_pj_principal_defined" ? (
              <>
                <Field label="Alíquota diária (%)">
                  <Input
                    key="credit-rate"
                    name="rate"
                    defaultValue="0.0082"
                    required
                  />
                </Field>
                <Field label="Adicional (%)">
                  <Input name="additionalRate" defaultValue="0.38" required />
                </Field>
              </>
            ) : (
              <>
                <Field label="Alíquota sobre o excedente (%)">
                  <Input
                    key="vgbl-rate"
                    name="rate"
                    defaultValue="5"
                    required
                  />
                </Field>
                <Field label="Escopo VGBL">
                  <Select name="scope">
                    <option value="same_insurer">Mesma seguradora</option>
                    <option value="all_insurers">Todas as seguradoras</option>
                  </Select>
                </Field>
                <Field label="Limite VGBL">
                  <Input name="threshold" defaultValue="600000.00" required />
                </Field>
              </>
            )}
            <Field label="Fundamento legal">
              <Input name="legalBasis" required />
            </Field>
            <Field label="URL da fonte oficial">
              <Input name="sourceUrl" type="url" required />
            </Field>
            <div className="form-wide">
              <Field label="Motivo da alteração">
                <Input name="changeReason" required />
              </Field>
            </div>
            <div className="form-submit">
              <Button type="submit">Salvar rascunho</Button>
            </div>
          </form>
        </Panel>
      )}
      {error && <p className="form-error admin-error">{error}</p>}
      <Panel
        title="Regras versionadas"
        subtitle="Scheduled e active são derivados da vigência; nenhum cron decide o cálculo."
      >
        {loadError ? (
          <Empty text={loadError} />
        ) : loading || !data ? (
          <Empty text="Carregando regras..." />
        ) : (
          <div className="rule-list">
            {data.map((rule: any) => (
              <article key={rule.id}>
                <header>
                  <div>
                    <strong>{rule.code}</strong>
                    <small>{rule.operationType}</small>
                  </div>
                  <span>{rule.versions.length} versões</span>
                </header>
                {rule.versions.map((version: any) => (
                  <div className="rule-version" key={version.id}>
                    <span>v{version.version}</span>
                    <span className={`badge ${version.deploymentStatus}`}>
                      {version.deploymentStatus}
                    </span>
                    <span className="badge neutral">
                      {version.editorialStatus}
                    </span>
                    <span>
                      {version.effectiveFrom} →{" "}
                      {version.effectiveTo ?? "aberta"}
                    </span>
                    <div className="rule-actions">
                      {version.editorialStatus === "draft" && (
                        <button
                          onClick={() => transition(version.id, "submit")}
                        >
                          Enviar para revisão
                        </button>
                      )}
                      {version.editorialStatus === "pending_review" && (
                        <>
                          <button
                            onClick={() => transition(version.id, "approve")}
                          >
                            Aprovar
                          </button>
                          <button
                            onClick={() => transition(version.id, "reject")}
                          >
                            Rejeitar
                          </button>
                        </>
                      )}
                      {version.editorialStatus === "approved" && (
                        <button
                          onClick={() => transition(version.id, "revoke")}
                        >
                          Revogar
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </article>
            ))}
          </div>
        )}
      </Panel>
    </>
  );
}

function Dashboard({ me }: { me: Me }) {
  const [section, setSection] = React.useState<Section>("overview");
  const [mobile, setMobile] = React.useState(false);
  const organization = me.membership!.organization;
  const nav: { id: Section; label: string; icon: LucideIcon }[] = [
    { id: "overview", label: "Visão geral", icon: LayoutDashboard },
    { id: "calculate", label: "Novo cálculo", icon: Calculator },
    { id: "history", label: "Histórico", icon: FileClock },
    { id: "company", label: "Empresa e equipe", icon: Users },
  ];
  if (me.platformRole === "super_admin")
    nav.push(
      { id: "rules", label: "Regras globais", icon: Settings2 },
      { id: "audit", label: "Auditoria", icon: ShieldCheck },
    );
  return (
    <div className="dashboard-shell">
      <aside className={mobile ? "open" : ""}>
        <div className="brand dark">
          <span className="brand-mark">
            <Scale size={22} />
          </span>{" "}
          TaxMan
          <button
            className="close-nav"
            aria-label="Fechar menu"
            onClick={() => setMobile(false)}
          >
            <X />
          </button>
        </div>
        <div className="org-switch">
          <span className="avatar company">
            {organization.name.slice(0, 2).toUpperCase()}
          </span>
          <div>
            <strong>{organization.name}</strong>
            <small>
              {organization.segment === "credit_provider"
                ? "Crédito e fintech"
                : "Seguros e previdência"}
            </small>
          </div>
        </div>
        <nav>
          {nav.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={section === id ? "active" : ""}
              onClick={() => {
                setSection(id);
                setMobile(false);
              }}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>
        <div className="sidebar-user">
          <span className="avatar">{me.name.slice(0, 2).toUpperCase()}</span>
          <div>
            <strong>{me.name}</strong>
            <small>
              {me.membership!.role}
              {me.platformRole === "super_admin" ? " · super-admin" : ""}
            </small>
          </div>
          <button
            title="Sair"
            aria-label="Sair"
            onClick={() =>
              authClient.signOut().then(() => window.location.reload())
            }
          >
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      <main className="workspace">
        <header className="mobile-header">
          <button aria-label="Abrir menu" onClick={() => setMobile(true)}>
            <Menu />
          </button>
          <div className="brand dark">TaxMan</div>
        </header>
        <div className="workspace-content">
          {section === "overview" && <Overview setSection={setSection} />}
          {section === "calculate" && (
            <Calculate segment={organization.segment} />
          )}
          {section === "history" && <History />}
          {section === "company" && <Company />}
          {section === "rules" && <Rules />}
          {section === "audit" && <Rules audit />}
        </div>
      </main>
    </div>
  );
}

export default function Page() {
  const session = authClient.useSession();
  const [me, setMe] = React.useState<Me | null>(null);
  const [loadingMe, setLoadingMe] = React.useState(true);
  const [meError, setMeError] = React.useState("");
  React.useEffect(() => {
    if (!session.data) {
      setLoadingMe(false);
      return;
    }
    setLoadingMe(true);
    setMeError("");
    api<Me>("/api/me")
      .then(setMe)
      .catch((reason) =>
        setMeError(
          reason instanceof Error
            ? reason.message
            : "Não foi possível carregar seu perfil.",
        ),
      )
      .finally(() => setLoadingMe(false));
  }, [session.data]);
  if (session.isPending || loadingMe)
    return (
      <div className="loading-screen">
        <span className="brand-mark">
          <Scale />
        </span>
        <strong>TaxMan</strong>
      </div>
    );
  if (!session.data) return <AuthScreen />;
  if (meError || !me)
    return (
      <div className="loading-screen">
        {meError || "Não foi possível carregar seu perfil."}
      </div>
    );
  if (me.onboardingRequired) return <Onboarding me={me} />;
  return <Dashboard me={me} />;
}
