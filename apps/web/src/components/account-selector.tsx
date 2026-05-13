"use client";

import { trpc } from "@/lib/trpc";

type Props = {
  selected: string | null;
  onChange: (accountId: string | null) => void;
};

export function AccountSelector({ selected, onChange }: Props) {
  const positions = trpc.investments.positions.useQuery();

  // Extract unique account IDs from positions
  const accounts: string[] = [
    ...new Set<string>(positions.data?.map((p: { accountId: string }) => p.accountId) ?? []),
  ];

  if (accounts.length <= 1) return null;

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-base-content/60">Account:</span>
      <select
        value={selected ?? "all"}
        onChange={(e) => onChange(e.target.value === "all" ? null : e.target.value)}
        className="select select-sm select-bordered"
      >
        <option value="all">All accounts</option>
        {accounts.map((id) => (
          <option key={id} value={id}>
            {id}
          </option>
        ))}
      </select>
    </div>
  );
}
