"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/utils";
import { fetchCalculate } from "@/lib/api";
import type { CalculateResponse } from "@/lib/api";
import type { CalculateInput } from "@/components/TaxForm";

const COMPARE_DATES = ["2025-07-01", "2026-01-01"] as const;

function amountOf(response: CalculateResponse | undefined): number | null {
  if (!response || (response.status !== "calculated" && response.status !== "calculated_with_warning")) return null;
  return response.results.reduce((sum, r) => sum + r.amount, 0);
}

export function TimeMachine({ lastInput }: { lastInput: CalculateInput | null }) {
  const [results, setResults] = React.useState<Record<string, CalculateResponse>>({});
  const [isRunning, setIsRunning] = React.useState(false);

  const run = React.useCallback(async () => {
    if (!lastInput) return;
    setIsRunning(true);
    try {
      const settled = await Promise.all(
        COMPARE_DATES.map(async (date) => {
          const res = await fetchCalculate({
            tenantId: "tenant_demo",
            asOfDate: date,
            operation: lastInput.operation,
          });
          return [date, res] as const;
        })
      );
      setResults(Object.fromEntries(settled));
    } finally {
      setIsRunning(false);
    }
  }, [lastInput]);

  if (!lastInput) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tax time machine (2025 vs 2026)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button variant="secondary" onClick={run} disabled={isRunning}>
          {isRunning ? "Reconstruing..." : "Compare across years"}
        </Button>
        <div className="grid grid-cols-2 gap-4">
          {COMPARE_DATES.map((date) => {
            const value = amountOf(results[date]);
            return (
              <div key={date} className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">{date}</p>
                <p className="text-xl font-semibold">
                  {value == null ? "—" : formatBRL(value)}
                </p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
