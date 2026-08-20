"use client";

import * as React from "react";
import {
  Check,
  Download,
  FileJson,
  FileSpreadsheet,
  LoaderCircle,
  RefreshCw,
  Settings2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  BackgroundJob,
  CalculationExport,
  CalculationExportColumn,
  CalculationOperationType,
  CalculationStatus,
} from "@/lib/api-types";

export interface CalculationExportFilters {
  calculationId?: string;
  operationType?: CalculationOperationType;
  status?: CalculationStatus;
  occurredFrom?: string;
  occurredTo?: string;
}

const columnOptions: readonly {
  id: CalculationExportColumn;
  label: string;
}[] = [
  { id: "calculationId", label: "ID do cálculo" },
  { id: "operationType", label: "Modalidade" },
  { id: "occurredOn", label: "Data da operação" },
  { id: "status", label: "Status" },
  { id: "taxAmount", label: "Valor do tributo" },
  { id: "taxableBase", label: "Base tributável" },
  { id: "grossBase", label: "Base bruta" },
  { id: "ruleId", label: "ID da regra" },
  { id: "ruleVersion", label: "Versão da regra" },
  { id: "legalBasis", label: "Fundamento legal" },
  { id: "createdAt", label: "Data do registro" },
  { id: "createdBy", label: "Responsável" },
];
const defaultColumns: readonly CalculationExportColumn[] = [
  "calculationId",
  "operationType",
  "occurredOn",
  "status",
  "taxAmount",
  "taxableBase",
  "ruleVersion",
  "legalBasis",
  "createdAt",
];

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "include",
    headers: { "content-type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
      message?: string;
    } | null;
    throw new Error(payload?.message ?? payload?.error ?? "Falha na exportação.");
  }
  return response.status === 204 ? (undefined as T) : response.json();
}

function dateTime(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function CalculationExports({
  filters,
  canCreate,
}: {
  filters: CalculationExportFilters;
  canCreate: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [format, setFormat] = React.useState<"csv" | "evidence_json">("csv");
  const [columns, setColumns] = React.useState<CalculationExportColumn[]>([
    ...defaultColumns,
  ]);
  const [delimiter, setDelimiter] = React.useState<"," | ";">(";");
  const [artifacts, setArtifacts] = React.useState<CalculationExport[]>([]);
  const [jobs, setJobs] = React.useState<BackgroundJob[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [message, setMessage] = React.useState("");

  const reload = React.useCallback(async () => {
    try {
      const [nextArtifacts, nextJobs] = await Promise.all([
        request<CalculationExport[]>("/api/calculation-exports?limit=10"),
        request<BackgroundJob[]>("/api/jobs?limit=50"),
      ]);
      setArtifacts(nextArtifacts);
      setJobs(nextJobs);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao carregar exportações.");
    }
  }, []);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  const pending = artifacts.some((artifact) => artifact.status === "queued");
  React.useEffect(() => {
    if (!pending) return;
    const timer = window.setInterval(() => void reload(), 2_000);
    return () => window.clearInterval(timer);
  }, [pending, reload]);

  function toggleColumn(column: CalculationExportColumn) {
    setColumns((current) =>
      current.includes(column)
        ? current.filter((candidate) => candidate !== column)
        : [...current, column],
    );
  }

  async function createExport() {
    if (format === "csv" && columns.length === 0) {
      setError("Selecione ao menos uma coluna.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await request("/api/calculation-exports", {
        method: "POST",
        body: JSON.stringify({
          format,
          ...(format === "csv" ? { columns, delimiter } : {}),
          filters,
        }),
      });
      setMessage("Exportação adicionada à fila. Você pode continuar trabalhando.");
      setOpen(false);
      await reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao solicitar exportação.");
    } finally {
      setBusy(false);
    }
  }

  async function download(artifact: CalculationExport) {
    setError("");
    try {
      const response = await fetch(
        `/api/calculation-exports/${encodeURIComponent(artifact.id)}/download`,
        { credentials: "include" },
      );
      if (!response.ok) throw new Error("O arquivo ainda não está disponível.");
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = artifact.fileName ?? "taxman-exportacao";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha no download.");
    }
  }

  async function retry(artifact: CalculationExport) {
    const job = jobs.find(
      (candidate) => candidate.exportId === artifact.id && candidate.status === "failed",
    );
    if (!job) {
      setError("Job de exportação não encontrado para nova tentativa.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await request(`/api/jobs/${encodeURIComponent(job.id)}/retry`, { method: "POST" });
      setMessage("Nova tentativa solicitada.");
      await reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao tentar novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="export-workspace" aria-labelledby="exports-title">
      <header className="export-heading">
        <div>
          <span className="eyebrow">Saída de dados</span>
          <h2 id="exports-title">Exportações</h2>
          <p>O arquivo respeita os filtros aplicados no histórico.</p>
        </div>
        {canCreate && (
          <Button type="button" variant="outline" onClick={() => setOpen(!open)}>
            {open ? <X size={15} /> : <Settings2 size={15} />}
            {open ? "Fechar" : "Configurar exportação"}
          </Button>
        )}
      </header>

      {open && (
        <div className="export-config">
          <div className="export-format-grid" role="radiogroup" aria-label="Formato">
            <button
              type="button"
              role="radio"
              aria-checked={format === "csv"}
              className={format === "csv" ? "selected" : ""}
              onClick={() => setFormat("csv")}
            >
              <FileSpreadsheet />
              <span><strong>CSV para Excel</strong><small>Colunas configuráveis e compatibilidade com planilhas.</small></span>
              {format === "csv" && <Check size={16} />}
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={format === "evidence_json"}
              className={format === "evidence_json" ? "selected" : ""}
              onClick={() => setFormat("evidence_json")}
            >
              <FileJson />
              <span><strong>Evidência JSON</strong><small>Registro completo e versionado para auditoria e integração.</small></span>
              {format === "evidence_json" && <Check size={16} />}
            </button>
          </div>

          {format === "csv" && (
            <div className="export-columns">
              <div>
                <strong>Colunas do arquivo</strong>
                <button type="button" onClick={() => setColumns(columnOptions.map(({ id }) => id))}>Selecionar todas</button>
              </div>
              <div className="column-checks">
                {columnOptions.map((column) => (
                  <label key={column.id}>
                    <input
                      type="checkbox"
                      checked={columns.includes(column.id)}
                      onChange={() => toggleColumn(column.id)}
                    />
                    {column.label}
                  </label>
                ))}
              </div>
              <label className="delimiter-field">
                Separador para Excel
                <select value={delimiter} onChange={(event) => setDelimiter(event.target.value as "," | ";")}>
                  <option value=";">Ponto e vírgula (;)</option>
                  <option value=",">Vírgula (,)</option>
                </select>
              </label>
            </div>
          )}
          <div className="export-submit">
            <span>{Object.keys(filters).length ? "Filtros atuais serão aplicados." : "Todos os cálculos serão incluídos."}</span>
            <Button type="button" disabled={busy} onClick={createExport}>
              {busy ? <LoaderCircle className="spin" size={15} /> : null}
              {busy ? "Solicitando..." : "Gerar em segundo plano"}
            </Button>
          </div>
        </div>
      )}

      <div className="export-feedback" aria-live="polite">
        {message && <p className="form-success">{message}</p>}
        {error && <p className="form-error">{error}</p>}
      </div>

      {artifacts.length ? (
        <div className="export-list">
          {artifacts.map((artifact) => (
            <article key={artifact.id}>
              <span className={`export-icon ${artifact.format}`}>
                {artifact.format === "csv" ? <FileSpreadsheet /> : <FileJson />}
              </span>
              <div className="export-description">
                <strong>{artifact.format === "csv" ? "Cálculos · CSV" : "Pacote de evidência · JSON"}</strong>
                <small>
                  Solicitado em {dateTime(artifact.createdAt)}
                  {artifact.status === "ready" ? ` · ${artifact.rowCount} registro(s)` : ""}
                </small>
                {artifact.status === "failed" && artifact.errorMessage && <em>{artifact.errorMessage}</em>}
              </div>
              <span className={`badge ${artifact.status}`}>
                {artifact.status === "queued" ? "Processando" : artifact.status === "ready" ? "Pronto" : "Falhou"}
              </span>
              {artifact.status === "queued" && <LoaderCircle className="spin export-loader" size={17} aria-label="Processando" />}
              {artifact.status === "ready" && (
                <button type="button" className="export-action" onClick={() => void download(artifact)}>
                  <Download size={15} /> Baixar
                </button>
              )}
              {artifact.status === "failed" && canCreate && (
                <button type="button" className="export-action" disabled={busy} onClick={() => void retry(artifact)}>
                  <RefreshCw size={15} /> Tentar novamente
                </button>
              )}
            </article>
          ))}
        </div>
      ) : (
        <p className="export-empty">Nenhuma exportação solicitada ainda.</p>
      )}
    </section>
  );
}
