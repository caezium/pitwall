"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type ChipColor = "red" | "green" | "yellow" | "blue" | "purple" | "pink";

export type MetricCardProps = {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  /** Pill in the top-right (e.g. "+2.1% ↗"). */
  pill?: { tone: "pos" | "neg" | "warn" | "info" | "mute"; text: string };
  /** Right-aligned ghost action button (e.g. "Replenish"). */
  action?: { label: string; onClick: () => void };
  icon?: LucideIcon;
  iconColor?: ChipColor;
  /** Optional gradient strip behind the icon chip (small flair). */
  glow?: boolean;
};

export function MetricCard({
  label,
  value,
  sub,
  pill,
  action,
  icon: Icon,
  iconColor = "blue",
  glow = false,
}: MetricCardProps) {
  return (
    <div className="finance-card relative overflow-hidden">
      {glow && (
        <div
          aria-hidden
          className="absolute -top-12 -right-12 w-44 h-44 rounded-full opacity-25 blur-3xl pointer-events-none"
          style={{ background: `var(--accent-${iconColor === "red" ? "red" : iconColor === "green" ? "green" : "cobalt"})` }}
        />
      )}
      <div className="relative flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          {Icon && (
            <span className={`icon-chip icon-chip-${iconColor}`}>
              <Icon size={18} strokeWidth={2.25} />
            </span>
          )}
          <span className="text-[13px] font-medium" style={{ color: "var(--text-secondary)" }}>
            {label}
          </span>
        </div>
        {pill && <span className={`pill pill-${pill.tone}`}>{pill.text}</span>}
      </div>

      <div className="relative mt-3 flex items-end justify-between gap-3">
        <div className="balance-xl" style={{ color: "var(--text-primary)" }}>
          {value}
        </div>
        {action && (
          <button onClick={action.onClick} className="btn btn-secondary !py-1.5 !px-3 text-[12px]">
            {action.label}
          </button>
        )}
      </div>

      {sub && (
        <p className="relative mt-1.5 text-[12px]" style={{ color: "var(--text-muted)" }}>
          {sub}
        </p>
      )}
    </div>
  );
}
