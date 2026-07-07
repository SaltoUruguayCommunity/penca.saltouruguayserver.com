export function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function toCsv(headers: string[], rows: (string | number | null)[][]): string {
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(row.map(escapeCsvField).join(","));
  }
  return lines.join("\r\n");
}

function unquote(field: string): string {
  if (field.length >= 2 && field.startsWith('"') && field.endsWith('"')) {
    return field.slice(1, -1).replace(/""/g, '"');
  }
  return field;
}

function parseFixedWidth(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split("\n").filter((l) => l.trim() !== "");
  if (lines.length < 2) return { headers: [], rows: [] };

  const headerLine = lines[0];

  // Find column start positions: non-space char preceded by 3+ spaces (column separator)
  const starts: number[] = [0]; // first column always starts at 0
  for (let i = 1; i < headerLine.length; i++) {
    if (headerLine[i] !== " " && headerLine[i - 1] === " ") {
      // Count consecutive spaces before this position
      let spaceCount = 0;
      for (let j = i - 1; j >= 0 && headerLine[j] === " "; j--) {
        spaceCount++;
      }
      if (spaceCount >= 3) {
        starts.push(i);
      }
    }
  }

  const extract = (line: string, idx: number): string => {
    const start = starts[idx];
    const end = idx + 1 < starts.length ? starts[idx + 1] : line.length;
    return line.slice(start, Math.min(end, line.length)).trim();
  };

  const rawHeaders = starts.map((_, i) => extract(headerLine, i).toLowerCase().replace(/\s+/g, ""));
  // Deduplicate headers and map to expected names
  const seen: Record<string, number> = {};
  const headers = rawHeaders.map((h) => {
    if (h === "fifacode") {
      seen[h] = (seen[h] ?? 0) + 1;
      return seen[h] === 1 ? "homeFifaCode" : "awayFifaCode";
    }
    if (h === "homescore") return "predHome";
    if (h === "awayscore") return "predAway";
    if (h === "susid") return "susId";
    if (h === "matchdate") return "matchDate";
    return h;
  });
  const rows = lines.slice(1).map((line) => starts.map((_, i) => extract(line, i)));

  return { headers, rows };
}

function parseDelimited(text: string, delimiter: "," | "\t"): { headers: string[]; rows: string[][] } {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  let i = 0;

  const pushField = () => {
    row.push(unquote(field));
    field = "";
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += char;
      i++;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (char === delimiter) {
      pushField();
      i++;
      continue;
    }
    if (char === "\r") {
      i++;
      continue;
    }
    if (char === "\n") {
      pushRow();
      i++;
      continue;
    }
    field += char;
    i++;
  }

  if (field.length > 0 || row.length > 0) {
    pushRow();
  }

  if (rows.length === 0) return { headers: [], rows: [] };
  const headers = rows[0].map((h) => h.trim());
  return { headers, rows: rows.slice(1).filter((r) => r.some((c) => c.trim() !== "")) };
}

export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const firstLine = text.split("\n")[0] ?? "";

  // CSV: first line has commas
  if (firstLine.includes(",")) {
    return parseDelimited(text, ",");
  }

  // TSV: first line has tabs
  if (firstLine.includes("\t")) {
    return parseDelimited(text, "\t");
  }

  // Fixed-width: multiple spaces between words (Turso shell output)
  return parseFixedWidth(text);
}
