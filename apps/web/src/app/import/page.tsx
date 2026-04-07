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
      setResult(data);
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
      <h2 className="text-2xl font-bold">Import CSV</h2>

      {/* Step 1: Upload */}
      {step === "upload" && (
        <div className="space-y-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-2">Import Type</label>
              <div className="flex gap-2">
                {(["expenses", "ai_usage", "trades"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTarget(t)}
                    className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                      target === t ? "bg-blue-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                    }`}
                  >
                    {t === "ai_usage" ? "AI Usage" : t === "trades" ? "IBKR Trades" : "Expenses"}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm text-zinc-400 mb-2">Upload CSV File</label>
              <label className="flex items-center justify-center w-full h-32 border-2 border-dashed border-zinc-700 rounded-xl cursor-pointer hover:border-zinc-500 transition-colors">
                <div className="text-center">
                  {fileName ? (
                    <>
                      <p className="text-sm text-zinc-300">{fileName}</p>
                      <p className="text-xs text-zinc-500 mt-1">{csvContent.split("\n").length - 1} rows detected</p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-zinc-400">Click to upload or drag & drop</p>
                      <p className="text-xs text-zinc-600 mt-1">CSV files only</p>
                    </>
                  )}
                </div>
                <input type="file" accept=".csv,.tsv,.txt" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>

            <div>
              <label className="block text-sm text-zinc-400 mb-2">Or paste CSV content</label>
              <textarea
                value={csvContent}
                onChange={(e) => setCsvContent(e.target.value)}
                placeholder="date,description,amount&#10;2024-03-15,Entry fee,350&#10;2024-03-15,Tires,450"
                rows={6}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm font-mono"
              />
            </div>

            <button
              onClick={handleParse}
              disabled={!csvContent || parseMutation.isPending}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              {parseMutation.isPending ? "Parsing..." : "Preview & Map Columns"}
            </button>

            {parseMutation.error && (
              <p className="text-red-400 text-sm">Parse error: {parseMutation.error.message}</p>
            )}
          </div>
        </div>
      )}

      {/* Step 2: Column Mapping */}
      {step === "map" && preview && (
        <div className="space-y-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Map Columns</h3>
              <p className="text-sm text-zinc-500">{preview.rowCount} rows found</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {targetFields[target].map((field) => (
                <div key={field} className="flex items-center gap-3">
                  <span className="text-sm text-zinc-400 w-28 text-right">{field}</span>
                  <span className="text-zinc-600">→</span>
                  <select
                    value={mapping[field] ?? ""}
                    onChange={(e) => setMapping({ ...mapping, [field]: e.target.value })}
                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm"
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
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <h3 className="text-sm font-semibold p-4 pb-0 text-zinc-400">Preview (first 5 rows)</h3>
            <div className="overflow-x-auto">
              <table className="w-full mt-2">
                <thead>
                  <tr className="border-b border-zinc-800 text-left text-xs text-zinc-500">
                    {preview.headers.map((h) => (
                      <th key={h} className="px-3 py-2">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.preview.map((row, i) => (
                    <tr key={i} className="border-b border-zinc-800/50">
                      {preview.headers.map((h) => (
                        <td key={h} className="px-3 py-2 text-xs text-zinc-400 font-mono">{row[h] ?? ""}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={() => setStep("upload")} className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm">Back</button>
            <button
              onClick={handleExecute}
              disabled={executeMutation.isPending}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              {executeMutation.isPending ? "Importing..." : `Import ${preview.rowCount} rows`}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Result */}
      {step === "result" && result && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
          <h3 className="text-lg font-semibold">Import Complete</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-3xl font-bold text-green-400">{result.imported}</p>
              <p className="text-sm text-zinc-500">Imported</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-yellow-400">{result.skipped}</p>
              <p className="text-sm text-zinc-500">Skipped</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-red-400">{result.errors.length}</p>
              <p className="text-sm text-zinc-500">Errors</p>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="bg-red-950/30 border border-red-900/50 rounded-lg p-4 max-h-40 overflow-y-auto">
              {result.errors.map((err, i) => (
                <p key={i} className="text-xs text-red-400">{err}</p>
              ))}
            </div>
          )}

          <button onClick={handleReset} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm">Import More</button>
        </div>
      )}
    </div>
  );
}
