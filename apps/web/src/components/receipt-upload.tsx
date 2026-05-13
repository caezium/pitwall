"use client";

import { useState } from "react";

type Props = {
  expenseId: string;
  currentUrl?: string | null;
  onUploaded: (url: string) => void;
};

export function ReceiptUpload({ expenseId, currentUrl, onUploaded }: Props) {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("expenseId", expenseId);

    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.url) onUploaded(data.url);
    } catch {
      // silent fail for now
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {currentUrl && (
        <a
          href={currentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="link link-info text-xs"
        >
          View receipt
        </a>
      )}
      <label className="cursor-pointer">
        <span className="text-xs text-base-content/60 hover:text-base-content transition-colors">
          {uploading ? "Uploading..." : currentUrl ? "Replace" : "Upload receipt"}
        </span>
        <input
          type="file"
          accept="image/*,.pdf"
          onChange={handleUpload}
          disabled={uploading}
          className="hidden"
        />
      </label>
    </div>
  );
}
