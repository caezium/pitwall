import { schema } from "@pitwall/db";
import type { PitwallDatabase } from "@pitwall/db";

type CSVRow = Record<string, string>;

type ImportTarget = "expenses" | "ai_usage" | "trades";

type ColumnMapping = Record<string, string>;

type ImportResult = {
  imported: number;
  skipped: number;
  errors: string[];
};

export class CSVImporter {
  constructor(private db: PitwallDatabase) {}

  parseCSV(content: string): { headers: string[]; rows: CSVRow[] } {
    const lines = content.trim().split("\n");
    if (lines.length < 2) return { headers: [], rows: [] };

    const headers = this.parseLine(lines[0]);
    const rows = lines.slice(1).map((line) => {
      const values = this.parseLine(line);
      const row: CSVRow = {};
      headers.forEach((h, i) => {
        row[h] = values[i] ?? "";
      });
      return row;
    });

    return { headers, rows };
  }

  suggestMapping(
    headers: string[],
    target: ImportTarget
  ): ColumnMapping {
    const mapping: ColumnMapping = {};
    const targetFields = this.getTargetFields(target);

    for (const field of targetFields) {
      const match = headers.find((h) => {
        const lower = h.toLowerCase().replace(/[_\s-]/g, "");
        const fieldLower = field.toLowerCase().replace(/[_\s-]/g, "");
        return (
          lower === fieldLower ||
          lower.includes(fieldLower) ||
          fieldLower.includes(lower)
        );
      });
      if (match) mapping[field] = match;
    }

    return mapping;
  }

  importExpenses(
    rows: CSVRow[],
    mapping: ColumnMapping
  ): ImportResult {
    const result: ImportResult = { imported: 0, skipped: 0, errors: [] };

    for (let i = 0; i < rows.length; i++) {
      try {
        const row = rows[i];
        const amount = parseFloat(row[mapping.amount] ?? "0");
        const description = row[mapping.description] ?? "";
        const date = row[mapping.date] ?? "";

        if (!description || !date || isNaN(amount)) {
          result.skipped++;
          continue;
        }

        this.db
          .insert(schema.expenses)
          .values({
            amount: Math.abs(amount),
            description,
            date: this.normalizeDate(date),
            notes: row[mapping.notes] ?? undefined,
            eventName: row[mapping.eventName] ?? undefined,
            trackName: row[mapping.trackName] ?? undefined,
          })
          .run();

        result.imported++;
      } catch (err) {
        result.errors.push(
          `Row ${i + 2}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    return result;
  }

  importAIUsage(
    rows: CSVRow[],
    mapping: ColumnMapping
  ): ImportResult {
    const result: ImportResult = { imported: 0, skipped: 0, errors: [] };

    for (let i = 0; i < rows.length; i++) {
      try {
        const row = rows[i];
        const cost = parseFloat(row[mapping.cost] ?? "0");
        const provider = row[mapping.provider] ?? "other";
        const model = row[mapping.model] ?? "unknown";
        const date = row[mapping.date] ?? "";

        if (!date || isNaN(cost)) {
          result.skipped++;
          continue;
        }

        this.db
          .insert(schema.aiUsageRecords)
          .values({
            provider: provider as "openai" | "anthropic" | "google" | "other",
            model,
            date: this.normalizeDate(date),
            inputTokens: parseInt(row[mapping.inputTokens] ?? "0") || 0,
            outputTokens: parseInt(row[mapping.outputTokens] ?? "0") || 0,
            cost,
            source: "csv",
          })
          .run();

        result.imported++;
      } catch (err) {
        result.errors.push(
          `Row ${i + 2}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    return result;
  }

  importTrades(
    rows: CSVRow[],
    mapping: ColumnMapping
  ): ImportResult {
    const result: ImportResult = { imported: 0, skipped: 0, errors: [] };

    for (let i = 0; i < rows.length; i++) {
      try {
        const row = rows[i];
        const symbol = row[mapping.symbol] ?? "";
        const quantity = parseFloat(row[mapping.quantity] ?? "0");
        const price = parseFloat(row[mapping.price] ?? "0");
        const date = row[mapping.tradeDate] ?? row[mapping.date] ?? "";

        if (!symbol || !date || isNaN(quantity) || isNaN(price)) {
          result.skipped++;
          continue;
        }

        const actionRaw = (row[mapping.action] ?? "buy").toLowerCase();
        const action = actionRaw.includes("sell")
          ? "sell"
          : actionRaw.includes("div")
            ? "dividend"
            : "buy";

        this.db
          .insert(schema.trades)
          .values({
            accountId: row[mapping.accountId] ?? "default",
            symbol,
            action: action as "buy" | "sell" | "dividend",
            quantity: Math.abs(quantity),
            price,
            commission: parseFloat(row[mapping.commission] ?? "0") || 0,
            tradeDate: this.normalizeDate(date),
            tradeId: row[mapping.tradeId] ?? undefined,
          })
          .run();

        result.imported++;
      } catch (err) {
        result.errors.push(
          `Row ${i + 2}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    return result;
  }

  private getTargetFields(target: ImportTarget): string[] {
    switch (target) {
      case "expenses":
        return ["amount", "description", "date", "notes", "eventName", "trackName"];
      case "ai_usage":
        return ["provider", "model", "date", "inputTokens", "outputTokens", "cost"];
      case "trades":
        return ["symbol", "action", "quantity", "price", "tradeDate", "commission", "accountId", "tradeId"];
    }
  }

  private parseLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  }

  private normalizeDate(dateStr: string): string {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toISOString().split("T")[0];
  }
}
