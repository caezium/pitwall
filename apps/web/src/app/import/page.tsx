"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";

type ImportTarget = "expenses" | "ai_usage" | "trades";

export default function ImportPage() {
  const [target, setTarget] = useState<ImportTarget>("expenses");
  const [csvContent, setCsvContent] = useState("");
  const [fileName, setFileName] = useState("");
  const [step, setStep] = useState<"upload" | "map" | "result">("upload");
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<{
    headers: string[];
    rowCount: number;
    suggestedMapping: Record<string, string>;
    preview: Record<string, string>[];
  } | null>(null);
  const [result, setResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);

  const parseMutation = trpc.import.parseCSV.useMutation({
    onSuccess: (data) => {
      setPreview(data);
      setMapping(data.suggestedMapping);
      setStep("map");
    },
  });

  const executeMutation = trpc.import.execute.useMutation({
    onSuccess: (data) => {
      if (data) setResult(data);
      setStep("result");
    },
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setCsvContent(text);
    };
    reader.readAsText(file);
  };

  const handleParse = () => {
    if (!csvContent) return;
    parseMutation.mutate({ content: csvContent, target });
  };

  const handleExecute = () => {
    executeMutation.mutate({ content: csvContent, target, mapping });
  };

  const handleReset = () => {
    setCsvContent("");
    setFileName("");
    setStep("upload");
    setPreview(null);
    setResult(null);
    setMapping({});
  };

  const targetFields: Record<ImportTarget, string[]> = {
    expenses: ["date", "description", "amount", "notes", "eventName", "trackName"],
    ai_usage: ["date", "provider", "model", "inputTokens", "outputTokens", "cost"],
    trades: ["tradeDate", "symbol", "action", "quantity", "price", "commission", "accountId"],
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>Import CSV</h1>

      {/* Step 1: Upload */}
      {step === "upload" && (
        <div className="space-y-4">
          <div className="finance-card space-y-5">
            <div>
              <label className="block text-xs font-medium uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>
                Import Type
              </label>
              <div className="flex gap-2">
                {(["expenses", "ai_usage", "trades"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTarget(t)}
                    className="px-4 py-2 rounded-xl text-sm font-medium transition-colors"
                    style={{
                      background: target === t ? "var(--accent-blue)" : "var(--bg-input)",
                      color: target === t ? "#fff" : "var(--text-secondary)",
                      border: target === t ? "none" : "1px solid var(--border)",
                    }}
                  >
                    {t === "ai_usage" ? "AI Usage" : t === "trades" ? "IBKR Trades" : "Expenses"}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>
                Upload CSV File
              </label>
              <label
                className="flex items-center justify-center w-full h-32 rounded-2xl cursor-pointer transition-colors"
                style={{
                  border: "2px dashed var(--border)",
                  background: "var(--bg-input)",
                }}
              >
                <div className="text-center">
                  {fileName ? (
                    <>
                      <p className="text-sm" style={{ color: "var(--text-primary)" }}>{fileName}</p>
                      <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{csvContent.split("\n").length - 1} rows detected</p>
                    </>
                  ) : (
                    <>
                      <div className="w-12 h-12 rounded-full flex items-center justify-center text-xl mx-auto mb-2" style={{ background: "var(--bg-card)" }}>
                        📄
                      </div>
                      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Click to upload or drag & drop</p>
                      <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>CSV files only</p>
                    </>
                  )}
                </div>
                <input type="file" accept=".csv,.tsv,.txt" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>

            <div>
              <label className="block text-xs font-medium uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>
                Or Paste CSV Content
              </label>
              <textarea
                value={csvContent}
                onChange={(e) => setCsvContent(e.target.value)}
                placeholder="date,description,amount&#10;2024-03-15,Entry fee,350&#10;2024-03-15,Tires,450"
                rows={6}
                className="w-full rounded-xl px-3 py-2.5 text-sm mono input input-bordered"
              />
            </div>

            <button
              onClick={handleParse}
              disabled={!csvContent || parseMutation.isPending}
              className="btn btn-primary"
            >
              {parseMutation.isPending ? "Parsing..." : "Preview & Map Columns"}
            </button>

            {parseMutation.error && (
              <p className="text-sm" style={{ color: "var(--accent-red)" }}>Parse error: {parseMutation.error.message}</p>
            )}
          </div>
        </div>
      )}

      {/* Step 2: Column Mapping */}
      {step === "map" && preview && (
        <div className="space-y-4">
          <div className="finance-card space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Map Columns</p>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{preview.rowCount} rows found</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {targetFields[target].map((field) => (
                <div key={field} className="flex items-center gap-3">
                  <span className="text-sm w-28 text-right mono" style={{ color: "var(--text-secondary)" }}>{field}</span>
                  <span style={{ color: "var(--text-muted)" }}>→</span>
                  <select
                    value={mapping[field] ?? ""}
                    onChange={(e) => setMapping({ ...mapping, [field]: e.target.value })}
                    className="flex-1 rounded-xl px-3 py-2 text-sm input input-bordered"
                  >
                    <option value="">-- skip --</option>
                    {preview.headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Preview Table */}
          <div className="finance-card !p-0 overflow-hidden">
            <p className="text-xs font-medium uppercase tracking-wide px-5 pt-4" style={{ color: "var(--text-muted)" }}>
              Preview (first 5 rows)
            </p>
            <div className="overflow-x-auto">
              <table className="w-full mt-2">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    {preview.headers.map((h) => (
                      <th key={h} className="px-4 py-2 text-left text-xs font-medium" style={{ color: "var(--text-muted)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.preview.map((row, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                      {preview.headers.map((h) => (
                        <td key={h} className="px-4 py-2.5 text-xs mono" style={{ color: "var(--text-secondary)" }}>{row[h] ?? ""}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setStep("upload")}
              className="px-4 py-2.5 rounded-xl text-sm font-medium"
              style={{ background: "var(--bg-input)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
            >
              Back
            </button>
            <button
              onClick={handleExecute}
              disabled={executeMutation.isPending}
              className="btn btn-success"
            >
              {executeMutation.isPending ? "Importing..." : `Import ${preview.rowCount} rows`}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Result */}
      {step === "result" && result && (
        <div className="finance-card space-y-5">
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Import Complete</p>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="balance-lg" style={{ color: "var(--accent-green)" }}>{result.imported}</p>
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Imported</p>
            </div>
            <div className="text-center">
              <p className="balance-lg" style={{ color: "#f59e0b" }}>{result.skipped}</p>
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Skipped</p>
            </div>
            <div className="text-center">
              <p className="balance-lg" style={{ color: "var(--accent-red)" }}>{result.errors.length}</p>
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Errors</p>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div
              className="rounded-xl p-4 max-h-40 overflow-y-auto"
              style={{ background: "rgba(248, 113, 113, 0.08)", border: "1px solid rgba(248, 113, 113, 0.2)" }}
            >
              {result.errors.map((err, i) => (
                <p key={i} className="text-xs" style={{ color: "var(--accent-red)" }}>{err}</p>
              ))}
            </div>
          )}

          <button
            onClick={handleReset}
            className="btn btn-primary"
          >
            Import More
          </button>
        </div>
      )}
    </div>
  );
}
