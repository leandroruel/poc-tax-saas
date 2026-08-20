export interface CsvRow {
  readonly rowNumber: number;
  readonly values: Readonly<Record<string, string>>;
}

export interface ParsedCsv {
  readonly delimiter: "," | ";" | "\t";
  readonly headers: readonly string[];
  readonly rows: readonly CsvRow[];
}

export class InvalidCsvError extends Error {
  constructor(
    readonly code:
      | "empty_file"
      | "empty_header"
      | "duplicate_header"
      | "unclosed_quote"
      | "column_count_mismatch",
    readonly rowNumber?: number,
  ) {
    super(rowNumber ? `${code} at CSV row ${rowNumber}` : code);
  }
}

type Delimiter = ParsedCsv["delimiter"];

function detectDelimiter(text: string): Delimiter {
  const candidates = [",", ";", "\t"] as const;
  const counts = new Map<Delimiter, number>(candidates.map((value) => [value, 0]));
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') index += 1;
      else quoted = !quoted;
      continue;
    }
    if (!quoted && (character === "\n" || character === "\r")) break;
    if (!quoted && candidates.includes(character as Delimiter)) {
      const delimiter = character as Delimiter;
      counts.set(delimiter, (counts.get(delimiter) ?? 0) + 1);
    }
  }
  return candidates.reduce((best, candidate) =>
    (counts.get(candidate) ?? 0) > (counts.get(best) ?? 0) ? candidate : best,
  );
}

function parseRecords(text: string, delimiter: Delimiter): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;

  const finishRecord = () => {
    record.push(field);
    field = "";
    records.push(record);
    record = [];
  };

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }
    if (character === '"' && field.length === 0) quoted = true;
    else if (character === delimiter) {
      record.push(field);
      field = "";
    } else if (character === "\n") finishRecord();
    else if (character === "\r") {
      if (text[index + 1] === "\n") index += 1;
      finishRecord();
    } else field += character;
  }
  if (quoted) throw new InvalidCsvError("unclosed_quote");
  if (field.length > 0 || record.length > 0) finishRecord();
  return records;
}

export function parseCsv(text: string): ParsedCsv {
  const normalized = text.replace(/^\uFEFF/, "");
  if (!normalized.trim()) throw new InvalidCsvError("empty_file");
  const delimiter = detectDelimiter(normalized);
  const records = parseRecords(normalized, delimiter);
  const headers = records[0]?.map((header) => header.trim()) ?? [];
  if (headers.length === 0 || headers.some((header) => !header)) {
    throw new InvalidCsvError("empty_header");
  }
  if (new Set(headers).size !== headers.length) {
    throw new InvalidCsvError("duplicate_header");
  }

  const rows: CsvRow[] = [];
  records.slice(1).forEach((record, index) => {
    const rowNumber = index + 2;
    if (record.every((value) => !value.trim())) return;
    if (record.length !== headers.length) {
      throw new InvalidCsvError("column_count_mismatch", rowNumber);
    }
    rows.push({
      rowNumber,
      values: Object.fromEntries(
        headers.map((header, column) => [header, record[column]!.trim()]),
      ),
    });
  });
  return { delimiter, headers, rows };
}
