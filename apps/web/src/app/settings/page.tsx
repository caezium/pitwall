"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";

const settingKeys = [
  {
    key: "anthropic_admin_api_key",
    label: "Anthropic Admin API Key",
    placeholder: "sk-ant-admin...",
    description: "Required for syncing Anthropic usage data",
  },
  {
    key: "openai_api_key",
    label: "OpenAI API Key",
    placeholder: "sk-...",
    description: "Required for syncing OpenAI usage data",
  },
  {
    key: "openrouter_api_key",
    label: "OpenRouter API Key",
    placeholder: "sk-or-...",
    description: "Required for syncing OpenRouter usage data",
  },
  {
    key: "ibkr_gateway_host",
    label: "IBKR Gateway Host",
    placeholder: "127.0.0.1",
    description: "IB Gateway hostname (default: 127.0.0.1)",
  },
  {
    key: "ibkr_gateway_port",
    label: "IBKR Gateway Port",
    placeholder: "7497",
    description: "IB Gateway port (7497=live, 7496=paper)",
  },
];

export default function SettingsPage() {
  const allSettings = trpc.settings.getAll.useQuery();
  const setSetting = trpc.settings.set.useMutation({
    onSuccess: () => allSettings.refetch(),
  });
  const [values, setValues] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    if (allSettings.data) {
      const map: Record<string, string> = {};
      for (const s of allSettings.data) {
        map[s.key] = s.value;
      }
      setValues(map);
    }
  }, [allSettings.data]);

  const handleSave = (key: string) => {
    setSetting.mutate(
      { key, value: values[key] ?? "" },
      {
        onSuccess: () => {
          setSaved(key);
          setTimeout(() => setSaved(null), 2000);
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>Settings</h1>

      <div className="space-y-4">
        {settingKeys.map((s) => (
          <div key={s.key} className="finance-card">
            <label className="block text-sm font-medium" style={{ color: "var(--text-primary)" }}>{s.label}</label>
            <p className="text-xs mt-0.5 mb-3" style={{ color: "var(--text-muted)" }}>{s.description}</p>
            <div className="flex gap-2">
              <input
                type={s.key.includes("key") ? "password" : "text"}
                placeholder={s.placeholder}
                value={values[s.key] ?? ""}
                onChange={(e) =>
                  setValues((v) => ({ ...v, [s.key]: e.target.value }))
                }
                className="flex-1 rounded-xl px-3 py-2.5 text-sm mono"
                style={{ background: "var(--bg-input)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
              />
              <button
                onClick={() => handleSave(s.key)}
                disabled={setSetting.isPending}
                className="px-4 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50"
                style={{
                  background: saved === s.key ? "var(--accent-green)" : "var(--accent-blue)",
                  color: saved === s.key ? "#000" : "#fff",
                }}
              >
                {saved === s.key ? "Saved!" : "Save"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
