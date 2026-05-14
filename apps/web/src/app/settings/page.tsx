"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { BackupsCard } from "./backups-card";
import { SectionTitle } from "@/components/ui/section-title";
import { Check } from "lucide-react";

type SettingDef = {
  key: string;
  label: string;
  placeholder: string;
  description: string;
};

const AI_KEYS: SettingDef[] = [
  {
    key: "anthropic_admin_api_key",
    label: "Anthropic Admin",
    placeholder: "sk-ant-admin...",
    description: "Syncs Anthropic usage",
  },
  {
    key: "openai_api_key",
    label: "OpenAI",
    placeholder: "sk-...",
    description: "Syncs OpenAI usage",
  },
  {
    key: "openrouter_api_key",
    label: "OpenRouter",
    placeholder: "sk-or-...",
    description: "Syncs OpenRouter usage",
  },
];

const IBKR_KEYS: SettingDef[] = [
  {
    key: "ibkr_gateway_host",
    label: "Gateway host",
    placeholder: "127.0.0.1",
    description: "IB Gateway hostname",
  },
  {
    key: "ibkr_gateway_port",
    label: "Gateway port",
    placeholder: "7497",
    description: "7497 = live, 7496 = paper",
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

  const renderRow = (s: SettingDef) => (
    <div
      key={s.key}
      className="grid grid-cols-[180px_1fr_auto] items-center gap-3 py-2"
    >
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-base-content truncate">
          {s.label}
        </p>
        <p className="text-[11px] text-base-content/55 truncate">
          {s.description}
        </p>
      </div>
      <input
        type={s.key.includes("key") ? "password" : "text"}
        placeholder={s.placeholder}
        value={values[s.key] ?? ""}
        onChange={(e) =>
          setValues((v) => ({ ...v, [s.key]: e.target.value }))
        }
        className="input input-bordered input-sm mono w-full"
      />
      <button
        onClick={() => handleSave(s.key)}
        disabled={setSetting.isPending}
        className={`btn btn-sm gap-1.5 ${
          saved === s.key ? "btn-success" : "btn-ghost"
        }`}
      >
        {saved === s.key ? (
          <>
            <Check size={13} strokeWidth={2.5} />
            Saved
          </>
        ) : (
          "Save"
        )}
      </button>
    </div>
  );

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-base-content">Settings</h1>

      <BackupsCard />

      <div className="finance-card">
        <SectionTitle eyebrow="Integrations" title="API keys & connectors" />

        <div className="mt-4">
          <p className="eyebrow !text-[10px] mb-1">AI providers</p>
          <div className="divide-y divide-base-200/60">
            {AI_KEYS.map(renderRow)}
          </div>

          <p className="eyebrow !text-[10px] mt-5 mb-1">IBKR gateway</p>
          <div className="divide-y divide-base-200/60">
            {IBKR_KEYS.map(renderRow)}
          </div>
        </div>
      </div>
    </div>
  );
}
