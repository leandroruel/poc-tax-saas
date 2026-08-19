"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { OperationInput, PersonType } from "@/lib/api";

export interface CalculateInput {
  operation: OperationInput;
  asOfDate: string;
}

const OPERATION_TYPES = ["credit", "insurance", "foreign_exchange", "investment"] as const;

export function TaxForm({
  onCalculate,
  isPending,
}: {
  onCalculate: (input: CalculateInput) => void;
  isPending: boolean;
}) {
  const [type, setType] = React.useState<string>("credit");
  const [asOfDate, setAsOfDate] = React.useState<string>("2026-08-19");
  const [baseAmount, setBaseAmount] = React.useState<string>("10000");
  const [personType, setPersonType] = React.useState<PersonType>("PJ");
  const [days, setDays] = React.useState<string>("30");
  const [simples, setSimples] = React.useState<boolean>(false);
  const [direction, setDirection] = React.useState<string>("outflow");
  const [market, setMarket] = React.useState<"primary" | "secondary">("primary");
  const [sameInsurer, setSameInsurer] = React.useState("0");
  const [allInsurers, setAllInsurers] = React.useState("0");

  const handleSubmit = React.useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      const common = { date: asOfDate, baseAmount: Number(baseAmount) || 0 };
      const operation: OperationInput =
        type === "credit"
          ? {
              ...common,
              type,
              borrower: { personType, category: simples ? "simples_mei" : undefined },
              termInDays: Number(days) || 1,
              optedIntoSimples: simples,
            }
          : type === "insurance"
            ? {
                ...common,
                type,
                product: "vgbl",
                insured: { personType },
                payer: "policyholder",
                priorContributions: {
                  sameInsurer: Number(sameInsurer) || 0,
                  allInsurers: Number(allInsurers) || 0,
                },
              }
            : type === "foreign_exchange"
              ? { ...common, type, direction: direction as "outflow" | "inflow" | "investment" }
              : { ...common, type: "investment", instrument: "fidc", market };
      onCalculate({ operation, asOfDate });
    },
    [type, asOfDate, baseAmount, personType, days, simples, direction, market, sameInsurer, allInsurers, onCalculate]
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="type">Operation type</Label>
          <Select id="type" value={type} onChange={(e) => setType(e.target.value)}>
            {OPERATION_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="date">As-of date</Label>
          <Input id="date" type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="base">Base amount (BRL)</Label>
          <Input id="base" type="number" value={baseAmount} onChange={(e) => setBaseAmount(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="person">Party type</Label>
          <Select id="person" value={personType} onChange={(e) => setPersonType(e.target.value as PersonType)}>
            <option value="PF">PF</option>
            <option value="PJ">PJ</option>
          </Select>
        </div>
      </div>

      {type === "credit" && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="days">Days (daily rate)</Label>
            <Input id="days" type="number" value={days} onChange={(e) => setDays(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 self-end text-sm">
            <input type="checkbox" checked={simples} onChange={(e) => setSimples(e.target.checked)} />
            Simples Nacional / MEI
          </label>
        </div>
      )}

      {type === "foreign_exchange" && (
        <div className="space-y-1">
          <Label htmlFor="direction">Direction</Label>
          <Select id="direction" value={direction} onChange={(e) => setDirection(e.target.value)}>
            <option value="outflow">outflow</option>
            <option value="inflow">inflow</option>
            <option value="investment">investment</option>
          </Select>
        </div>
      )}

      {type === "insurance" && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="same-insurer">Prior contributions — same insurer</Label>
            <Input id="same-insurer" type="number" value={sameInsurer} onChange={(e) => setSameInsurer(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="all-insurers">Prior contributions — all insurers</Label>
            <Input id="all-insurers" type="number" value={allInsurers} onChange={(e) => setAllInsurers(e.target.value)} />
          </div>
        </div>
      )}

      {type === "investment" && (
        <div className="space-y-1">
          <Label htmlFor="market">Market</Label>
          <Select id="market" value={market} onChange={(e) => setMarket(e.target.value as "primary" | "secondary")}>
            <option value="primary">primary</option>
            <option value="secondary">secondary</option>
          </Select>
        </div>
      )}

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "Calculating..." : "Calculate tax"}
      </Button>
    </form>
  );
}
