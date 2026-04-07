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
      <h2 className="text-2xl font-bold">Settings</h2>

      <div className="space-y-4">
        {settingKeys.map((s) => (
          <div
            key={s.key}
            className="bg-zinc-900 border border-zinc-800 rounded-xl p-6"
          >
            <label className="block text-sm font-medium mb-1">{s.label}</label>
            <p className="text-xs text-zinc-500 mb-3">{s.description}</p>
            <div className="flex gap-2">
              <input
                type={s.key.includes("key") ? "password" : "text"}
                placeholder={s.placeholder}
                value={values[s.key] ?? ""}
                onChange={(e) =>
                  setValues((v) => ({ ...v, [s.key]: e.target.value }))
                }
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm font-mono"
              />
              <button
                onClick={() => handleSave(s.key)}
                disabled={setSetting.isPending}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm transition-colors disabled:opacity-50"
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
