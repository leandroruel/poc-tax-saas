"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TaxForm, type CalculateInput } from "@/components/TaxForm";
import { ResultCard } from "@/components/ResultCard";
import { TimeMachine } from "@/components/TimeMachine";
import { useTaxCalculate } from "@/hooks/useTaxCalculate";

export default function Page() {
  const mutation = useTaxCalculate();
  const [lastInput, setLastInput] = React.useState<CalculateInput | null>(null);

  const handleCalculate = React.useCallback(
    (input: CalculateInput) => {
      setLastInput(input);
      mutation.mutate({ tenantId: "tenant_demo", asOfDate: input.asOfDate, operation: input.operation });
    },
    [mutation]
  );

  return (
    <main className="container max-w-3xl py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-bold">Tax Engine — IOF</h1>
        <p className="text-sm text-muted-foreground">
          Cálculo tributário versionado, auditável e com máquina do tempo.
        </p>
      </header>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Operation</CardTitle>
          </CardHeader>
          <CardContent>
            <TaxForm onCalculate={handleCalculate} isPending={mutation.isPending} />
          </CardContent>
        </Card>

        {mutation.data && <ResultCard response={mutation.data} />}

        <TimeMachine lastInput={lastInput} />
      </div>
    </main>
  );
}
