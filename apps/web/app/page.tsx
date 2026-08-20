"use client";

import * as React from "react";
import {
  Building2,
  Bell,
  Calculator,
  ChevronRight,
  FileClock,
  LayoutDashboard,
  LogOut,
  Menu,
  Scale,
  Settings2,
  ShieldCheck,
  UploadCloud,
  RotateCcw,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CalculationExports,
  type CalculationExportFilters,
} from "@/components/calculation-exports";
import type {
  CalculationPage,
  CalculationRecord,
  CalculationStatus,
  Company as CompanyDto,
  DashboardOverview,
  BackgroundJob,
  BackgroundJobDetail,
  ImportBatch,
  ImportBatchDetail,
  ImportMappingProfile,
  ImportBatchReviewPage,
  ImportBatchReviewRow,
  Me,
  NotificationFeed,
  AuditCategory,
  AuditEventPage,
  OrganizationRole,
} from "@/lib/api-types";

type Section =
  | "overview"
  | "calculate"
  | "history"
  | "imports"
  | "company"
  | "activity"
  | "rules"
  | "audit";
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const isForm = init?.body instanceof FormData;
  const response = await fetch(path, {
    ...init,
    credentials: "include",
    headers: isForm
      ? init?.headers
      : { "content-type": "application/json", ...init?.headers },
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

function NotificationBell() {
  const [open, setOpen] = React.useState(false);
  const { data, error, reload } =
    useApiQuery<NotificationFeed>("/api/notifications?limit=20");

  React.useEffect(() => {
    const timer = window.setInterval(() => void reload(), 15_000);
    return () => window.clearInterval(timer);
  }, [reload]);

  async function markRead(notificationId: string) {
    await api(`/api/notifications/${notificationId}/read`, { method: "POST" });
    await reload();
  }

  return (
    <div className="notification-center">
      <button
        className="notification-trigger"
        type="button"
        aria-label="Notificações"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <Bell size={19} />
        {!!data?.unreadCount && (
          <span className="notification-count">
            {Math.min(data.unreadCount, 99)}
          </span>
        )}
      </button>
      {open && (
        <section className="notification-popover" aria-label="Notificações">
          <header>
            <div>
              <strong>Notificações</strong>
              <small>
                {data?.unreadCount
                  ? `${data.unreadCount} não lida${data.unreadCount === 1 ? "" : "s"}`
                  : "Tudo em dia"}
              </small>
            </div>
          </header>
          {error ? (
            <p className="notification-empty">{error}</p>
          ) : data?.items.length ? (
            <div className="notification-list">
              {data.items.map((notification) => (
                <button
                  type="button"
                  key={notification.id}
                  className={notification.readAt ? "read" : "unread"}
                  onClick={() => void markRead(notification.id)}
                >
                  <span className="notification-dot" />
                  <span>
                    <strong>{notification.title}</strong>
                    <small>{notification.message}</small>
                    <time>
                      {new Date(notification.createdAt).toLocaleString("pt-BR")}
                    </time>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="notification-empty">
              Conclusões, falhas e revisões de lotes aparecerão aqui.
            </p>
          )}
        </section>
      )}
    </div>
  );
}

function Overview({
  setSection,
  canCreateCalculation,
}: {
  setSection: (section: Section) => void;
  canCreateCalculation: boolean;
}) {
  const { data, error, loading } =
    useApiQuery<DashboardOverview>("/api/dashboard");
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Visão geral</span>
          <h1>Operação tributária</h1>
          <p>Acompanhe os cálculos e a cobertura do seu workspace.</p>
        </div>
        {canCreateCalculation && (
          <Button onClick={() => setSection("calculate")}>
            <Calculator size={16} /> Novo cálculo
          </Button>
        )}
      </div>
      <div className="metric-grid">
        <div className="metric">
          <span>Cálculos registrados</span>
          <strong>{data?.totalCalculations ?? "—"}</strong>
          <small>Histórico imutável</small>
        </div>
        <div className="metric">
          <span>IOF apurado · 30 dias</span>
          <strong>
            {data ? moneyDecimal(data.calculatedTaxAmount30Days) : "—"}
          </strong>
          <small>Somente resultados calculados</small>
        </div>
        <div className={`metric ${data?.attentionRequired ? "attention" : ""}`}>
          <span>Requer atenção</span>
          <strong>{data?.attentionRequired ?? "—"}</strong>
          <small>Sem regra, contexto ou suporte</small>
        </div>
        <div className="metric">
          <span>Regras aprovadas</span>
          <strong>{data?.ruleVersionCount ?? "—"}</strong>
          <small>Versões no catálogo global</small>
        </div>
      </div>
      <Panel
        title="Volume e IOF processado"
        subtitle="Atividade registrada nos últimos 14 dias; use o histórico para investigar cada valor."
      >
        {error ? (
          <Empty text={error} />
        ) : loading || !data ? (
          <Empty text="Carregando indicadores..." />
        ) : (
          <ActivityChart activity={data.activity} />
        )}
      </Panel>
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

function ActivityChart({
  activity,
}: {
  activity: DashboardOverview["activity"];
}) {
  const hasActivity = activity.some(({ calculations }) => calculations > 0);
  if (!hasActivity) {
    return <Empty text="Ainda não há atividade suficiente para exibir a evolução." />;
  }
  const amounts = activity.map(({ taxAmount }) => Number(taxAmount));
  const maxAmount = Math.max(...amounts);
  const maxCalculations = Math.max(
    ...activity.map(({ calculations }) => calculations),
  );
  const usesAmount = maxAmount > 0;
  return (
    <div className="activity-chart-wrap">
      <div className="activity-chart-summary">
        <span>
          <i className="chart-key tax" /> IOF apurado
        </span>
        <span>
          <i className="chart-key volume" /> Cálculos no dia
        </span>
      </div>
      <div
        className="activity-chart"
        role="img"
        aria-label="IOF apurado e quantidade de cálculos por dia nos últimos 14 dias"
      >
        {activity.map((point, index) => {
          const amount = amounts[index];
          const scale = usesAmount
            ? amount / maxAmount
            : point.calculations / maxCalculations;
          return (
            <div
              className="activity-day"
              key={point.date}
              title={`${new Date(`${point.date}T12:00:00`).toLocaleDateString("pt-BR")}: ${point.calculations} cálculo(s), ${moneyDecimal(point.taxAmount)} de IOF`}
            >
              <div className="activity-bar-track">
                <span
                  className="activity-bar"
                  style={{ transform: `scaleY(${Math.max(scale, 0.025)})` }}
                />
                <span
                  className="activity-volume-bar"
                  style={{
                    transform: `scaleY(${Math.max(point.calculations / maxCalculations, 0.025)})`,
                  }}
                />
              </div>
              <small>
                {index === 0 || index === activity.length - 1 || index === 6
                  ? new Date(`${point.date}T12:00:00`).toLocaleDateString(
                      "pt-BR",
                      { day: "2-digit", month: "2-digit" },
                    )
                  : ""}
              </small>
            </div>
          );
        })}
      </div>
    </div>
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

function moneyDecimal(value: string): string {
  const [whole, fraction = "00"] = value.split(".");
  return `R$ ${BigInt(whole).toLocaleString("pt-BR")},${fraction.padEnd(2, "0")}`;
}

function organizationRoleLabel(role: OrganizationRole): string {
  const labels: Record<OrganizationRole, string> = {
    owner: "Proprietário",
    admin: "Administrador",
    operator: "Operador",
    reviewer: "Revisor",
  };
  return labels[role];
}

function operationForRequest(input: CalculationRecord["input"]) {
  if (input.kind === "credit") {
    return { ...input, amount: Number(input.amount) };
  }
  return {
    ...input,
    amount: Number(input.amount),
    priorContributions: {
      sameInsurer:
        input.priorContributions.sameInsurer === undefined
          ? undefined
          : Number(input.priorContributions.sameInsurer),
      allInsurers:
        input.priorContributions.allInsurers === undefined
          ? undefined
          : Number(input.priorContributions.allInsurers),
    },
  };
}

function CalculationRows({
  rows,
  onSelect,
  selectedId,
}: {
  rows: readonly CalculationRecord[];
  onSelect?: (calculationId: string) => void;
  selectedId?: string;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Operação</th>
            <th>Data</th>
            <th>Status</th>
            <th>IOF</th>
            {onSelect && <th><span className="sr-only">Ações</span></th>}
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
                  {calculationStatusLabels[row.outcome.kind]}
                </span>
              </td>
              <td>
                {row.outcome.kind === "calculated"
                  ? money(Number(row.outcome.result.amount))
                  : "—"}
              </td>
              {onSelect && (
                <td>
                  <button
                    type="button"
                    className="calculation-detail-trigger"
                    aria-pressed={selectedId === row.id}
                    onClick={() => onSelect(row.id)}
                  >
                    {selectedId === row.id ? "Ocultar" : "Ver memória"}
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CalculationDetail({
  calculation,
  canRecalculate,
  busy,
  onRecalculate,
}: {
  calculation: CalculationRecord;
  canRecalculate: boolean;
  busy: boolean;
  onRecalculate: () => void;
}) {
  const input = calculation.input;
  const result =
    calculation.outcome.kind === "calculated"
      ? calculation.outcome.result
      : null;
  return (
    <section className="calculation-detail" aria-labelledby="calculation-detail-title">
      <header>
        <div>
          <span className="eyebrow">Memória imutável</span>
          <h3 id="calculation-detail-title">Cálculo {calculation.id}</h3>
          <p>
            Registrado por {calculation.createdBy.name} em {new Date(calculation.createdAt).toLocaleString("pt-BR")}.
          </p>
        </div>
        <span className={`badge ${calculation.outcome.kind}`}>
          {calculationStatusLabels[calculation.outcome.kind]}
        </span>
      </header>
      <div className="calculation-detail-grid">
        <div>
          <span>Operação</span>
          <strong>{input.kind === "credit" ? "Crédito PJ" : "VGBL"}</strong>
        </div>
        <div>
          <span>Data da operação</span>
          <strong>{new Date(`${input.occurredOn}T12:00:00`).toLocaleDateString("pt-BR")}</strong>
        </div>
        <div>
          <span>Valor informado</span>
          <strong>{money(Number(input.amount))}</strong>
        </div>
        {input.kind === "credit" ? (
          <div>
            <span>Prazo</span>
            <strong>{input.termInDays} dias</strong>
          </div>
        ) : (
          <>
            <div>
              <span>Pagador</span>
              <strong>{input.payer === "employer" ? "Empregador" : "Titular"}</strong>
            </div>
            <div>
              <span>Aportes · mesma seguradora</span>
              <strong>{money(Number(input.priorContributions.sameInsurer ?? 0))}</strong>
            </div>
            <div>
              <span>Aportes · todas</span>
              <strong>{money(Number(input.priorContributions.allInsurers ?? 0))}</strong>
            </div>
          </>
        )}
      </div>
      {result && (
        <div className="calculation-result-detail">
          <div><span>IOF apurado</span><strong>{money(Number(result.amount))}</strong></div>
          <div><span>Base tributável</span><strong>{money(Number(result.taxableBase))}</strong></div>
          <div><span>Base bruta</span><strong>{money(Number(result.grossBase))}</strong></div>
          <div><span>Versão aplicada</span><strong>v{result.ruleVersion}</strong></div>
        </div>
      )}
      {calculation.ruleSnapshot && (
        <div className="rule-evidence">
          <div>
            <strong>Regra preservada no cálculo</strong>
            <small>
              Vigência {calculation.ruleSnapshot.effectiveFrom} → {calculation.ruleSnapshot.effectiveTo ?? "aberta"}
            </small>
          </div>
          <p>{calculation.ruleSnapshot.legalBasis}</p>
          {calculation.ruleSnapshot.sourceUrl && (
            <a href={calculation.ruleSnapshot.sourceUrl} target="_blank" rel="noreferrer">
              Consultar fonte oficial
            </a>
          )}
          {!!result?.evidence.length && (
            <ul>{result.evidence.map((item) => <li key={item}>{item}</li>)}</ul>
          )}
        </div>
      )}
      {calculation.recalculatesId && (
        <p className="calculation-lineage">
          Este registro recalcula <code>{calculation.recalculatesId}</code> sem substituir o original.
        </p>
      )}
      {canRecalculate && (
        <div className="calculation-detail-actions">
          <Button type="button" variant="outline" disabled={busy} onClick={onRecalculate}>
            <RotateCcw size={15} /> {busy ? "Recalculando..." : "Recalcular e vincular"}
          </Button>
          <small>Cria um novo registro usando a regra aprovada para a data original.</small>
        </div>
      )}
    </section>
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

const calculationStatusLabels: Record<CalculationStatus, string> = {
  calculated: "Calculado",
  unsupported: "Não suportado",
  not_applicable: "Não aplicável",
  requires_context: "Requer dados",
  no_rule: "Sem regra",
  ambiguous_rule: "Regra ambígua",
};

function History({
  canExport,
  canRecalculate,
}: {
  canExport: boolean;
  canRecalculate: boolean;
}) {
  const [path, setPath] = React.useState("/api/calculations?limit=25");
  const { data, error, loading, reload } = useApiQuery<CalculationPage>(path);
  const [rows, setRows] = React.useState<CalculationRecord[]>([]);
  const [nextCursor, setNextCursor] = React.useState<string | null>(null);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [pageError, setPageError] = React.useState("");
  const [activeFilters, setActiveFilters] =
    React.useState<CalculationExportFilters>({});
  const [selectedCalculation, setSelectedCalculation] =
    React.useState<CalculationRecord | null>(null);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [recalculating, setRecalculating] = React.useState(false);

  React.useEffect(() => {
    if (!data) return;
    setRows(data.items);
    setNextCursor(data.nextCursor);
  }, [data]);

  function applyFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const params = new URLSearchParams({ limit: "25" });
    const calculationId = String(form.get("calculationId") ?? "").trim();
    const operationType = String(form.get("operationType") ?? "").trim();
    const status = String(form.get("status") ?? "").trim();
    const occurredFrom = String(form.get("occurredFrom") ?? "").trim();
    const occurredTo = String(form.get("occurredTo") ?? "").trim();
    const nextFilters: CalculationExportFilters = {
      ...(calculationId ? { calculationId } : {}),
      ...(operationType
        ? { operationType: operationType as CalculationExportFilters["operationType"] }
        : {}),
      ...(status ? { status: status as CalculationExportFilters["status"] } : {}),
      ...(occurredFrom ? { occurredFrom } : {}),
      ...(occurredTo ? { occurredTo } : {}),
    };
    for (const [key, value] of Object.entries(nextFilters)) params.set(key, value);
    setRows([]);
    setNextCursor(null);
    setPageError("");
    setActiveFilters(nextFilters);
    setPath(`/api/calculations?${params.toString()}`);
  }

  async function loadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    setPageError("");
    try {
      const separator = path.includes("?") ? "&" : "?";
      const page = await api<CalculationPage>(
        `${path}${separator}cursor=${encodeURIComponent(nextCursor)}`,
      );
      setRows((current) => [...current, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch (reason) {
      setPageError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível carregar mais cálculos.",
      );
    } finally {
      setLoadingMore(false);
    }
  }

  async function inspectCalculation(calculationId: string) {
    if (selectedCalculation?.id === calculationId) {
      setSelectedCalculation(null);
      return;
    }
    setDetailLoading(true);
    setPageError("");
    try {
      setSelectedCalculation(
        await api<CalculationRecord>(`/api/calculations/${calculationId}`),
      );
    } catch (reason) {
      setPageError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível carregar a memória do cálculo.",
      );
    } finally {
      setDetailLoading(false);
    }
  }

  async function recalculateSelected() {
    if (!selectedCalculation) return;
    setRecalculating(true);
    setPageError("");
    try {
      const created = await api<{ calculationId: string }>("/tax/calculate", {
        method: "POST",
        body: JSON.stringify({
          operation: operationForRequest(selectedCalculation.input),
          recalculatesId: selectedCalculation.id,
        }),
      });
      const next = await api<CalculationRecord>(
        `/api/calculations/${created.calculationId}`,
      );
      setSelectedCalculation(next);
      await reload();
    } catch (reason) {
      setPageError(
        reason instanceof Error ? reason.message : "Falha ao recalcular a operação.",
      );
    } finally {
      setRecalculating(false);
    }
  }

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
      <Panel
        title="Cálculos"
        subtitle="Livro imutável, filtrado e ordenado do registro mais recente para o mais antigo."
      >
        <form className="ledger-filters" onSubmit={applyFilters}>
          <Field label="ID do cálculo">
            <Input name="calculationId" placeholder="UUID do registro" />
          </Field>
          <Field label="Modalidade">
            <Select name="operationType" defaultValue="">
              <option value="">Todas</option>
              <option value="credit_pj_principal_defined">Crédito PJ</option>
              <option value="insurance_vgbl">VGBL</option>
            </Select>
          </Field>
          <Field label="Status">
            <Select name="status" defaultValue="">
              <option value="">Todos</option>
              {Object.entries(calculationStatusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Operação desde">
            <Input name="occurredFrom" type="date" />
          </Field>
          <Field label="Operação até">
            <Input name="occurredTo" type="date" />
          </Field>
          <div className="ledger-filter-action">
            <Button type="submit">Aplicar filtros</Button>
          </div>
        </form>
        {error || pageError ? (
          <Empty text={error || pageError} />
        ) : loading && rows.length === 0 ? (
          <Empty text="Carregando histórico..." />
        ) : rows.length ? (
          <>
            <CalculationRows
              rows={rows}
              selectedId={selectedCalculation?.id}
              onSelect={(calculationId) => void inspectCalculation(calculationId)}
            />
            {nextCursor && (
              <div className="ledger-pagination">
                <Button
                  type="button"
                  variant="outline"
                  disabled={loadingMore}
                  onClick={loadMore}
                >
                  {loadingMore ? "Carregando..." : "Carregar mais"}
                </Button>
              </div>
            )}
            {detailLoading && <Empty text="Carregando memória do cálculo..." />}
            {selectedCalculation && !detailLoading && (
              <CalculationDetail
                calculation={selectedCalculation}
                canRecalculate={
                  canRecalculate &&
                  (selectedCalculation.outcome.kind === "calculated" ||
                    selectedCalculation.outcome.kind === "not_applicable")
                }
                busy={recalculating}
                onRecalculate={() => void recalculateSelected()}
              />
            )}
          </>
        ) : (
          <Empty text="Nenhum cálculo encontrado." />
        )}
      </Panel>
      <CalculationExports filters={activeFilters} canCreate={canExport} />
    </>
  );
}

const importStatusLabels: Record<ImportBatch["status"], string> = {
  draft: "Mapeamento pendente",
  validating: "Validando",
  ready: "Pronto para processar",
  processing: "Calculando",
  requires_review: "Requer revisão",
  closed: "Fechado",
  failed: "Falhou",
  cancelled: "Cancelado",
};

function Imports({
  segment,
  canCreate,
  canReview,
  canRetry,
}: {
  segment: "credit_provider" | "insurance_pension";
  canCreate: boolean;
  canReview: boolean;
  canRetry: boolean;
}) {
  const importOperationType =
    segment === "credit_provider"
      ? "credit_pj_principal_defined"
      : "insurance_vgbl";
  const batches = useApiQuery<ImportBatch[]>("/api/import-batches?limit=25");
  const jobs = useApiQuery<BackgroundJob[]>("/api/jobs?limit=25");
  const profiles = useApiQuery<ImportMappingProfile[]>(
    `/api/import-mapping-profiles?operationType=${importOperationType}`,
  );
  const [selected, setSelected] = React.useState<ImportBatchDetail | null>(null);
  const [step, setStep] = React.useState(1);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [reviewRows, setReviewRows] = React.useState<ImportBatchReviewRow[]>([]);
  const [reviewNextRow, setReviewNextRow] = React.useState<number | null>(null);
  const [reviewLoading, setReviewLoading] = React.useState(false);
  const [reviewNote, setReviewNote] = React.useState("");
  const [acknowledgedInvalidRows, setAcknowledgedInvalidRows] = React.useState(false);
  const [acknowledgedFailedRows, setAcknowledgedFailedRows] = React.useState(false);
  const [selectedProfileId, setSelectedProfileId] = React.useState("");
  const [jobDetail, setJobDetail] = React.useState<BackgroundJobDetail | null>(null);
  const [loadingJobId, setLoadingJobId] = React.useState<string | null>(null);

  const loadReviewRows = React.useCallback(
    async (batchId: string, afterRowNumber?: number) => {
      setReviewLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({ status: "all", limit: "50" });
        if (afterRowNumber) params.set("afterRowNumber", String(afterRowNumber));
        const page = await api<ImportBatchReviewPage>(
          `/api/import-batches/${batchId}/review-rows?${params.toString()}`,
        );
        setReviewRows((current) =>
          afterRowNumber ? [...current, ...page.items] : page.items,
        );
        setReviewNextRow(page.nextRowNumber);
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : "Falha ao carregar as linhas para revisão.",
        );
      } finally {
        setReviewLoading(false);
      }
    },
    [],
  );

  const refreshSelected = React.useCallback(async () => {
    if (!selected) return;
    const next = await api<ImportBatchDetail>(`/api/import-batches/${selected.id}`);
    setSelected(next);
    if (next.status === "ready") setStep(3);
    if (next.status === "processing") setStep(4);
    if (next.status === "requires_review") setStep(4);
  }, [selected?.id]);

  React.useEffect(() => {
    const active =
      selected?.status === "validating" || selected?.status === "processing";
    if (!active) return;
    const timer = window.setInterval(() => {
      void refreshSelected();
      void jobs.reload();
      void batches.reload();
    }, 2_000);
    return () => window.clearInterval(timer);
  }, [selected?.status, refreshSelected, jobs.reload, batches.reload]);

  React.useEffect(() => {
    setReviewRows([]);
    setReviewNextRow(null);
    setReviewNote("");
    setAcknowledgedInvalidRows(false);
    setAcknowledgedFailedRows(false);
    if (selected?.status === "requires_review" && canReview) {
      void loadReviewRows(selected.id);
    }
  }, [selected?.id, selected?.status, canReview, loadReviewRows]);

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const form = new FormData(event.currentTarget);
      const created = await api<ImportBatch>("/api/import-batches", {
        method: "POST",
        body: form,
      });
      setSelected({ ...created, mapping: null, rowErrors: [] });
      setSelectedProfileId("");
      setStep(2);
      await batches.reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha no upload.");
    } finally {
      setBusy(false);
    }
  }

  async function validate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const columns =
      segment === "credit_provider"
        ? {
            occurredOn: String(form.get("occurredOn")),
            amount: String(form.get("amount")),
            termInDays: String(form.get("termInDays")),
          }
        : {
            occurredOn: String(form.get("occurredOn")),
            amount: String(form.get("amount")),
            payer: String(form.get("payer")),
            priorSameInsurer: String(form.get("priorSameInsurer") || "") || undefined,
            priorAllInsurers: String(form.get("priorAllInsurers") || "") || undefined,
          };
    try {
      await api(`/api/import-batches/${selected.id}/validate`, {
        method: "POST",
        body: JSON.stringify({
          mapping: {
            operationType:
              segment === "credit_provider"
                ? "credit_pj_principal_defined"
                : "insurance_vgbl",
            dateFormat: form.get("dateFormat"),
            numberFormat: form.get("numberFormat"),
            columns,
          },
          profileName: String(form.get("profileName") || "") || undefined,
        }),
      });
      setSelected({ ...selected, status: "validating" });
      setStep(3);
      await Promise.all([jobs.reload(), batches.reload(), profiles.reload()]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha na validação.");
    } finally {
      setBusy(false);
    }
  }

  async function processBatch() {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      await api(`/api/import-batches/${selected.id}/process`, { method: "POST" });
      setSelected({ ...selected, status: "processing" });
      setStep(4);
      await Promise.all([jobs.reload(), batches.reload()]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao iniciar o lote.");
    } finally {
      setBusy(false);
    }
  }

  async function retry(jobId: string) {
    setError("");
    try {
      await api(`/api/jobs/${jobId}/retry`, { method: "POST" });
      setJobDetail(null);
      await Promise.all([jobs.reload(), batches.reload(), refreshSelected()]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao tentar novamente.");
    }
  }

  async function toggleJobDetail(jobId: string) {
    if (jobDetail?.id === jobId) {
      setJobDetail(null);
      return;
    }
    setLoadingJobId(jobId);
    setError("");
    try {
      setJobDetail(await api<BackgroundJobDetail>(`/api/jobs/${jobId}`));
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Falha ao carregar as tentativas do job.",
      );
    } finally {
      setLoadingJobId(null);
    }
  }

  async function closeReview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      const closed = await api<ImportBatch>(
        `/api/import-batches/${selected.id}/close-review`,
        {
          method: "POST",
          body: JSON.stringify({
            note: reviewNote,
            acknowledgedInvalidRows,
            acknowledgedFailedRows,
          }),
        },
      );
      setSelected({ ...selected, ...closed });
      await batches.reload();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Falha ao encerrar a revisão.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function cancelBatch() {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      const cancelled = await api<ImportBatch>(
        `/api/import-batches/${selected.id}/cancel`,
        {
          method: "POST",
          body: JSON.stringify({ reason: reviewNote }),
        },
      );
      setSelected({ ...selected, ...cancelled });
      await batches.reload();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Falha ao cancelar o lote.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function deleteSelectedProfile() {
    if (!selectedProfileId) return;
    setBusy(true);
    setError("");
    try {
      await api(
        `/api/import-mapping-profiles/${encodeURIComponent(selectedProfileId)}`,
        { method: "DELETE" },
      );
      setSelectedProfileId("");
      await profiles.reload();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Falha ao excluir o perfil de mapeamento.",
      );
    } finally {
      setBusy(false);
    }
  }

  const relatedJobs = jobs.data?.filter(
    (job) => !selected || job.batchId === selected.id,
  );
  const currentJob = relatedJobs?.[0];
  const progress = currentJob?.progress.total
    ? Math.round((currentJob.progress.current / currentJob.progress.total) * 100)
    : currentJob?.status === "completed"
      ? 100
      : 0;
  const canCancelSelected =
    selected !== null &&
    ["draft", "ready", "requires_review", "failed"].includes(selected.status);
  const selectedProfile = profiles.data?.find(
    (profile) => profile.id === selectedProfileId,
  );
  const profileColumns = selectedProfile?.mapping.columns as
    | Readonly<Record<string, string | undefined>>
    | undefined;
  const missingProfileColumns = selectedProfile && selected
    ? Object.values(profileColumns ?? {}).filter(
        (column): column is string =>
          typeof column === "string" &&
          column.length > 0 &&
          !selected.headers.includes(column),
      )
    : [];
  const columnOptions = (optional = false) => (
    <>
      {optional && <option value="">Não importar</option>}
      {selected?.headers.map((header) => (
        <option key={header} value={header}>{header}</option>
      ))}
    </>
  );

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Operação em lote</span>
          <h1>Importações</h1>
          <p>Valide, calcule e revise operações sem depender de planilhas manuais.</p>
        </div>
        {canCreate && selected && (
          <Button variant="outline" onClick={() => { setSelected(null); setSelectedProfileId(""); setStep(1); }}>
            <UploadCloud size={16} /> Nova importação
          </Button>
        )}
      </div>
      {canCreate && (
        <Panel title="Assistente de importação" subtitle={`Etapa ${step} de 4`}>
          <div className="import-stepper" aria-label={`Etapa ${step} de 4`}>
            {["Arquivo", "Colunas", "Validação", "Processamento"].map((label, index) => (
              <div className={index + 1 <= step ? "active" : ""} key={label}>
                <span>{index + 1}</span><small>{label}</small>
              </div>
            ))}
          </div>
          {error && <p className="form-error">{error}</p>}
          {step === 1 && (
            <form className="import-upload" onSubmit={upload}>
              <UploadCloud size={30} />
              <strong>Selecione um arquivo CSV</strong>
              <span>Até 10 MB. A primeira linha deve conter os nomes das colunas.</span>
              <Input name="file" type="file" accept=".csv,text/csv" required />
              <Button disabled={busy}>{busy ? "Enviando..." : "Enviar e detectar colunas"}</Button>
            </form>
          )}
          {step === 2 && selected && (
            <form
              key={selectedProfileId || "manual-mapping"}
              className="mapping-grid"
              onSubmit={validate}
            >
              <div className="mapping-summary">
                <strong>{selected.originalFileName}</strong>
                <span>{selected.totalRows} linhas · {selected.headers.length} colunas detectadas</span>
              </div>
              <div className="mapping-profile-picker">
                <Field
                  label="Perfil de mapeamento"
                  hint="Reaplique um layout salvo ou mantenha o preenchimento manual."
                >
                  <Select
                    value={selectedProfileId}
                    onChange={(event) => setSelectedProfileId(event.target.value)}
                  >
                    <option value="">Mapeamento manual</option>
                    {profiles.data?.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                {selectedProfile && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void deleteSelectedProfile()}
                  >
                    Excluir perfil
                  </Button>
                )}
              </div>
              {profiles.error && <p className="form-error mapping-profile-error">{profiles.error}</p>}
              {!!missingProfileColumns.length && (
                <p className="mapping-profile-warning">
                  Este arquivo não contém: {missingProfileColumns.join(", ")}. Ajuste as colunas antes de validar.
                </p>
              )}
              <Field label="Data da operação"><Select name="occurredOn" defaultValue={profileColumns?.occurredOn} required>{columnOptions()}</Select></Field>
              <Field label="Valor"><Select name="amount" defaultValue={profileColumns?.amount} required>{columnOptions()}</Select></Field>
              {segment === "credit_provider" ? (
                <Field label="Prazo em dias"><Select name="termInDays" defaultValue={profileColumns?.termInDays} required>{columnOptions()}</Select></Field>
              ) : (
                <>
                  <Field label="Responsável pelo aporte"><Select name="payer" defaultValue={profileColumns?.payer} required>{columnOptions()}</Select></Field>
                  <Field label="Aportes na mesma seguradora"><Select name="priorSameInsurer" defaultValue={profileColumns?.priorSameInsurer}>{columnOptions(true)}</Select></Field>
                  <Field label="Aportes em todas as seguradoras"><Select name="priorAllInsurers" defaultValue={profileColumns?.priorAllInsurers}>{columnOptions(true)}</Select></Field>
                </>
              )}
              <Field label="Formato da data"><Select name="dateFormat" defaultValue={selectedProfile?.mapping.dateFormat ?? "dd/mm/yyyy"}><option value="dd/mm/yyyy">DD/MM/AAAA</option><option value="yyyy-mm-dd">AAAA-MM-DD</option></Select></Field>
              <Field label="Formato dos valores"><Select name="numberFormat" defaultValue={selectedProfile?.mapping.numberFormat ?? "decimal_comma"}><option value="decimal_comma">10.000,50</option><option value="decimal_dot">10,000.50</option></Select></Field>
              <Field label={selectedProfile ? "Atualizar perfil" : "Salvar perfil (opcional)"}><Input name="profileName" maxLength={80} defaultValue={selectedProfile?.name} placeholder="Ex.: Exportação do core bancário" /></Field>
              <div className="form-submit"><Button disabled={busy}>{busy ? "Agendando..." : "Validar arquivo"}</Button></div>
            </form>
          )}
          {step >= 3 && selected && (
            <div className="import-progress-view">
              <div className="job-progress"><span style={{ transform: `scaleX(${progress / 100})` }} /></div>
              <div className="import-progress-heading">
                <div><strong>{importStatusLabels[selected.status]}</strong><small>{progress}% concluído</small></div>
                {selected.status === "ready" && (
                  <Button disabled={busy || selected.validRows === 0} onClick={processBatch}>Processar {selected.validRows} linhas válidas</Button>
                )}
                {selected.status === "requires_review" && selected.failedRows > 0 && canCreate && (
                  <Button variant="outline" disabled={busy} onClick={processBatch}>
                    <RotateCcw size={15} /> Reprocessar {selected.failedRows} falha(s)
                  </Button>
                )}
              </div>
              <div className="import-counts">
                <span><strong>{selected.validRows}</strong> válidas</span>
                <span><strong>{selected.invalidRows}</strong> inválidas</span>
                <span><strong>{selected.processedRows}</strong> calculadas</span>
                <span><strong>{selected.failedRows}</strong> falhas</span>
              </div>
              {selected.status !== "requires_review" && !!selected.rowErrors.length && (
                <div className="row-errors">
                  <strong>Amostra de inconsistências</strong>
                  {selected.rowErrors.map((row) => (
                    <div key={row.rowNumber}><span>Linha {row.rowNumber}</span><small>{row.errors.map((item) => item.message).join(" · ")}</small></div>
                  ))}
                </div>
              )}
            </div>
          )}
          {selected?.status === "requires_review" && canReview && (
            <section className="batch-review" aria-labelledby="batch-review-title">
              <div className="batch-review-heading">
                <div>
                  <span className="eyebrow">Decisão do revisor</span>
                  <h3 id="batch-review-title">Conferir inconsistências</h3>
                  <p>
                    Revise as linhas abaixo. Encerrar preserva os cálculos válidos e registra
                    formalmente as inconsistências reconhecidas.
                  </p>
                </div>
                <span className="review-total">
                  {selected.invalidRows + selected.failedRows} pendência(s)
                </span>
              </div>
              {reviewLoading && reviewRows.length === 0 ? (
                <Empty text="Carregando linhas para revisão..." />
              ) : reviewRows.length ? (
                <div className="review-row-list">
                  {reviewRows.map((row) => (
                    <article key={row.rowNumber}>
                      <header>
                        <strong>Linha {row.rowNumber}</strong>
                        <span className={`badge ${row.status}`}>
                          {row.status === "invalid" ? "Inválida" : "Falha no cálculo"}
                        </span>
                      </header>
                      <div className="review-row-data">
                        {Object.entries(row.rawData).map(([field, value]) => (
                          <span key={field}>
                            <small>{field}</small>
                            <code>{value}</code>
                          </span>
                        ))}
                      </div>
                      <ul>
                        {row.errors.map((item, index) => (
                          <li key={`${item.field}-${item.code}-${index}`}>{item.message}</li>
                        ))}
                      </ul>
                    </article>
                  ))}
                  {reviewNextRow && (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={reviewLoading}
                      onClick={() => void loadReviewRows(selected.id, reviewNextRow)}
                    >
                      {reviewLoading ? "Carregando..." : "Carregar mais inconsistências"}
                    </Button>
                  )}
                </div>
              ) : (
                <Empty text="Nenhuma inconsistência permanece neste lote." />
              )}
              <form className="review-decision" onSubmit={closeReview}>
                <Field
                  label="Nota da decisão"
                  hint="Explique brevemente a conferência realizada; esta nota irá para a auditoria."
                >
                  <textarea
                    value={reviewNote}
                    onChange={(event) => setReviewNote(event.target.value)}
                    minLength={5}
                    maxLength={1_000}
                    required
                  />
                </Field>
                {selected.invalidRows > 0 && (
                  <label className="review-acknowledgement">
                    <input
                      type="checkbox"
                      checked={acknowledgedInvalidRows}
                      onChange={(event) => setAcknowledgedInvalidRows(event.target.checked)}
                    />
                    <span>
                      Reconheço que {selected.invalidRows} linha(s) inválida(s) não geraram cálculo.
                    </span>
                  </label>
                )}
                {selected.failedRows > 0 && (
                  <label className="review-acknowledgement">
                    <input
                      type="checkbox"
                      checked={acknowledgedFailedRows}
                      onChange={(event) => setAcknowledgedFailedRows(event.target.checked)}
                    />
                    <span>
                      Reconheço que {selected.failedRows} linha(s) falharam durante o cálculo.
                    </span>
                  </label>
                )}
                <div className="review-actions">
                  <Button
                    type="submit"
                    disabled={
                      busy ||
                      reviewNote.trim().length < 5 ||
                      (selected.invalidRows > 0 && !acknowledgedInvalidRows) ||
                      (selected.failedRows > 0 && !acknowledgedFailedRows)
                    }
                  >
                    {busy ? "Registrando..." : "Encerrar lote revisado"}
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={busy || reviewNote.trim().length < 5}
                    onClick={() => void cancelBatch()}
                  >
                    Cancelar lote
                  </Button>
                </div>
              </form>
            </section>
          )}
          {selected && canReview && canCancelSelected && selected.status !== "requires_review" && (
            <section className="batch-cancel">
              <Field
                label="Motivo do cancelamento"
                hint="O lote será preservado para auditoria e não poderá ser reaberto."
              >
                <textarea
                  value={reviewNote}
                  onChange={(event) => setReviewNote(event.target.value)}
                  minLength={5}
                  maxLength={1_000}
                />
              </Field>
              <Button
                type="button"
                variant="destructive"
                disabled={busy || reviewNote.trim().length < 5}
                onClick={() => void cancelBatch()}
              >
                {busy ? "Cancelando..." : "Cancelar lote"}
              </Button>
            </section>
          )}
        </Panel>
      )}
      <div className="imports-grid">
        <Panel title="Lotes recentes" subtitle="Arquivos pertencentes somente a este workspace.">
          {batches.loading ? <Empty text="Carregando lotes..." /> : batches.data?.length ? (
            <div className="batch-list">{batches.data.map((batch) => (
              <button key={batch.id} onClick={() => void api<ImportBatchDetail>(`/api/import-batches/${batch.id}`).then((detail) => { setSelected(detail); setStep(detail.status === "draft" ? 2 : detail.status === "validating" || detail.status === "ready" ? 3 : 4); })}>
                <span><strong>{batch.originalFileName}</strong><small>{batch.totalRows} linhas · {new Date(batch.createdAt).toLocaleString("pt-BR")}</small></span>
                <span className={`badge ${batch.status}`}>{importStatusLabels[batch.status]}</span>
              </button>
            ))}</div>
          ) : <Empty text="Nenhum lote importado." />}
        </Panel>
        <Panel title="Jobs" subtitle="Tentativas, progresso e falhas técnicas.">
          {jobs.loading ? <Empty text="Carregando jobs..." /> : relatedJobs?.length ? (
            <div className="job-list">{relatedJobs.map((job) => (
              <article key={job.id}>
                <div className="job-summary">
                  <span><strong>{job.type === "imports.validate" ? "Validação" : job.type === "imports.process" ? "Cálculo em lote" : "Exportação"}</strong><small>{job.attemptsMade}/{job.maxAttempts} tentativas</small></span>
                  <span className={`badge ${job.status}`}>{job.status}</span>
                  <button type="button" onClick={() => void toggleJobDetail(job.id)}>
                    {loadingJobId === job.id ? "Carregando..." : jobDetail?.id === job.id ? "Ocultar" : "Detalhes"}
                  </button>
                  {job.status === "failed" && canRetry && <button type="button" onClick={() => void retry(job.id)}><RotateCcw size={13} /> Tentar novamente</button>}
                </div>
                {jobDetail?.id === job.id && (
                  <div className="job-attempts">
                    <div className="job-correlation">
                      <span>Correlação do job</span>
                      <code>{jobDetail.correlationId}</code>
                    </div>
                    {jobDetail.attempts.length ? jobDetail.attempts.map((attempt) => (
                      <div className="job-attempt" key={attempt.id}>
                        <span className={`attempt-dot ${attempt.status}`} />
                        <div>
                          <strong>Tentativa {attempt.number}</strong>
                          <small>{new Date(attempt.startedAt).toLocaleString("pt-BR")}</small>
                          <code>{attempt.correlationId}</code>
                          {attempt.errorMessage && <p>{attempt.errorMessage}</p>}
                        </div>
                        <span className={`badge ${attempt.status}`}>{attempt.status}</span>
                      </div>
                    )) : <Empty text="Este job ainda não iniciou nenhuma tentativa." />}
                  </div>
                )}
              </article>
            ))}</div>
          ) : <Empty text="Nenhum job para exibir." />}
        </Panel>
      </div>
    </>
  );
}

function Company() {
  const { data: company, error, loading } =
    useApiQuery<CompanyDto>("/api/company");
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
            {company.members.map((member) => (
              <div className="member" key={member.id}>
                <span className="avatar">
                  {member.user.name.slice(0, 2).toUpperCase()}
                </span>
                <div>
                  <strong>{member.user.name}</strong>
                  <small>{member.user.email}</small>
                </div>
                <span className="badge neutral">
                  {organizationRoleLabel(member.role)}
                </span>
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

const auditCategoryLabels: Record<AuditCategory, string> = {
  calculations: "Cálculos",
  imports: "Importações",
  exports: "Exportações",
  jobs: "Jobs",
  organization: "Organização",
};

const auditActionLabels: Record<string, string> = {
  "organization.onboarded": "Empresa cadastrada",
  "calculation.created": "Cálculo registrado",
  "import.batch_uploaded": "Arquivo importado",
  "import.validation_requested": "Validação solicitada",
  "import.processing_requested": "Processamento solicitado",
  "import.review_closed": "Revisão do lote encerrada",
  "import.batch_cancelled": "Lote cancelado",
  "import.mapping_profile_deleted": "Perfil de mapeamento excluído",
  "calculation_export.requested": "Exportação solicitada",
  "calculation_export.generated": "Exportação gerada",
  "background_job.retry_requested": "Nova tentativa solicitada",
  "background_job.recovered": "Job recuperado após falha",
};

function OrganizationAudit() {
  const [category, setCategory] = React.useState<AuditCategory | "">("");
  const path = `/api/audit-events?limit=30${category ? `&category=${category}` : ""}`;
  const { data, error, loading } = useApiQuery<AuditEventPage>(path);
  const [events, setEvents] = React.useState<AuditEventPage["items"]>([]);
  const [nextCursor, setNextCursor] = React.useState<string | null>(null);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [pageError, setPageError] = React.useState("");

  React.useEffect(() => {
    if (!data) return;
    setEvents(data.items);
    setNextCursor(data.nextCursor);
  }, [data]);

  async function loadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    setPageError("");
    try {
      const page = await api<AuditEventPage>(
        `${path}&cursor=${encodeURIComponent(nextCursor)}`,
      );
      setEvents((current) => [...current, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch (reason) {
      setPageError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível carregar mais eventos.",
      );
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Governança operacional</span>
          <h1>Trilha de auditoria</h1>
          <p>Quem fez o quê, quando e sobre qual registro da sua empresa.</p>
        </div>
        <label className="audit-filter">
          <span>Categoria</span>
          <Select
            value={category}
            onChange={(event) => {
              setCategory(event.target.value as AuditCategory | "");
              setEvents([]);
              setNextCursor(null);
            }}
          >
            <option value="">Todas as ações</option>
            {Object.entries(auditCategoryLabels).map(([value, label]) => (
              <option value={value} key={value}>{label}</option>
            ))}
          </Select>
        </label>
      </div>
      <Panel
        title="Eventos da organização"
        subtitle="O conteúdo técnico interno permanece protegido; esta visão expõe apenas a trilha necessária para rastreabilidade."
      >
        {error || pageError ? (
          <Empty text={error || pageError} />
        ) : loading ? (
          <Empty text="Carregando auditoria..." />
        ) : events.length ? (
          <>
            <div className="audit-list tenant-audit-list">
              {events.map((event) => (
                <div key={event.id}>
                  <span className="audit-dot" />
                  <div>
                    <span className="audit-event-heading">
                      <strong>{auditActionLabels[event.action] ?? event.action}</strong>
                      <span className="badge neutral">
                        {auditCategoryLabels[event.category]}
                      </span>
                    </span>
                    <small>
                      {event.actor?.name ?? "Sistema"} · {event.entityType} · <code>{event.entityId}</code>
                    </small>
                  </div>
                  <time>{new Date(event.occurredAt).toLocaleString("pt-BR")}</time>
                </div>
              ))}
            </div>
            {nextCursor && (
              <div className="ledger-pagination">
                <Button
                  type="button"
                  variant="outline"
                  disabled={loadingMore}
                  onClick={() => void loadMore()}
                >
                  {loadingMore ? "Carregando..." : "Carregar eventos anteriores"}
                </Button>
              </div>
            )}
          </>
        ) : (
          <Empty text="Nenhum evento encontrado para este filtro." />
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
  const permissions = me.membership!.permissions;
  const canCreateCalculation = permissions.includes("calculation:create");
  const canCreateBatch = permissions.includes("batch:create");
  const canReviewBatch = permissions.includes("batch:review");
  const canRetryJob = permissions.includes("job:retry");
  const canExport = permissions.includes("export:create");
  const canReadAudit = permissions.includes("audit:read");
  const nav: { id: Section; label: string; icon: LucideIcon }[] = [
    { id: "overview", label: "Visão geral", icon: LayoutDashboard },
    { id: "history", label: "Histórico", icon: FileClock },
    { id: "imports", label: "Importações", icon: UploadCloud },
    { id: "company", label: "Empresa e equipe", icon: Users },
  ];
  if (canReadAudit) {
    nav.push({ id: "activity", label: "Trilha de auditoria", icon: ShieldCheck });
  }
  if (canCreateCalculation) {
    nav.splice(1, 0, {
      id: "calculate",
      label: "Novo cálculo",
      icon: Calculator,
    });
  }
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
              {organizationRoleLabel(me.membership!.role)}
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
        <div className="workspace-toolbar">
          <NotificationBell />
        </div>
        <div className="workspace-content">
          {section === "overview" && (
            <Overview
              setSection={setSection}
              canCreateCalculation={canCreateCalculation}
            />
          )}
          {section === "calculate" && (
            <Calculate segment={organization.segment} />
          )}
          {section === "history" && (
            <History
              canExport={canExport}
              canRecalculate={canCreateCalculation}
            />
          )}
          {section === "imports" && (
            <Imports
              segment={organization.segment}
              canCreate={canCreateBatch}
              canReview={canReviewBatch}
              canRetry={canRetryJob}
            />
          )}
          {section === "company" && <Company />}
          {section === "activity" && <OrganizationAudit />}
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
