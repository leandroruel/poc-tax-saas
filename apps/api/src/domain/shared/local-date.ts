export type LocalDate = string;

export function isLocalDate(value: string): value is LocalDate {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

export function elapsedCalendarDays(from: LocalDate, to: LocalDate): number {
  if (!isLocalDate(from) || !isLocalDate(to)) {
    throw new Error("Elapsed days require valid local dates.");
  }
  const milliseconds =
    new Date(`${to}T00:00:00.000Z`).getTime() -
    new Date(`${from}T00:00:00.000Z`).getTime();
  return milliseconds / 86_400_000;
}
