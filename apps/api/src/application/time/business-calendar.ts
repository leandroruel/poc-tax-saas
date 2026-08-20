import type { LocalDate } from "../../domain/iof/operation.js";

export function businessDateInBrazil(now = new Date()): LocalDate {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
