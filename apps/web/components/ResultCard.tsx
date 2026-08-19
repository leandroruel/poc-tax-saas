"use client";

import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBRL } from "@/lib/utils";
import type { CalculateResponse, TaxResult } from "@/lib/api";

function rateLabel(result: TaxResult): string {
  const extra = result.rateUnit === "daily_percent" ? "%/day" : "%";
  return `${result.rate}${extra}`;
}

function ResultRow({ result, contested }: { result: TaxResult; contested: boolean }) {
  return (
    <div className="space-y-2 border-b pb-3 last:border-0">
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-muted-foreground">{result.taxType}</span>
        <span className="text-2xl font-semibold">{formatBRL(result.amount)}</span>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <dt>Rate</dt>
        <dd>{rateLabel(result)}</dd>
        <dt>Base</dt>
        <dd>{formatBRL(result.base)}</dd>
        <dt>Taxable base</dt>
        <dd>{formatBRL(result.taxableBase)}</dd>
        <dt>Effective</dt>
        <dd>
          {result.effectivePeriod.from.slice(0, 10)} →{" "}
          {result.effectivePeriod.to ? result.effectivePeriod.to.slice(0, 10) : "vigente"}
        </dd>
      </dl>
      <p className="text-xs leading-relaxed">{result.legalBasis}</p>
      {contested && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-2 text-xs text-destructive">
          <AlertTriangle className="h-4 w-4" />
          Regra contestada judicialmente — validar com especialista.
        </div>
      )}
    </div>
  );
}

export function ResultCard({ response }: { response: CalculateResponse }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Result &amp; audit trail</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {response.results.length === 0 ? (
          <p className="text-sm text-destructive">{response.explanation.narrative}</p>
        ) : (
          <>
            <div className="space-y-3">
              {response.results.map((r) => (
                <ResultRow key={r.ruleId} result={r} contested={response.status === "calculated_with_warning"} />
              ))}
            </div>
            <p className="border-t pt-3 text-xs leading-relaxed text-muted-foreground">
              {response.explanation.narrative}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
