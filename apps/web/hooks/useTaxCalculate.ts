"use client";

import { useMutation } from "@tanstack/react-query";
import { fetchCalculate, type CalculateResponse } from "@/lib/api";

export function useTaxCalculate() {
  return useMutation<CalculateResponse, Error, Parameters<typeof fetchCalculate>[0]>({
    mutationFn: fetchCalculate,
  });
}
