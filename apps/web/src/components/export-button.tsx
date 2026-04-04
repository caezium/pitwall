"use client";

type Props = {
  data: string | undefined;
  filename: string;
  label?: string;
};

export function ExportButton({ data, filename, label = "Export CSV" }: Props) {
  const handleExport = () => {
    if (!data) return;
    const blob = new Blob([data], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      onClick={handleExport}
      disabled={!data}
      className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors disabled:opacity-30"
    >
      {label}
    </button>
  );
}
