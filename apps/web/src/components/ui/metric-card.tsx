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
  /** Right-aligned ghost action button (e.g. "Replenish"). Icon is optional
   *  but recommended so the affordance reads as a button, not a text link. */
  action?: { label: string; onClick: () => void; icon?: LucideIcon };
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
          <span className="text-[13px] font-medium text-base-content/70">
            {label}
          </span>
        </div>
        {pill && <span className={`pill pill-${pill.tone}`}>{pill.text}</span>}
      </div>

      <div className="relative mt-3 flex items-end justify-between gap-3">
        <div className="balance-xl text-base-content">{value}</div>
        {action && (
          <button onClick={action.onClick} className="btn btn-ghost btn-sm gap-1.5">
            {action.icon && <action.icon size={13} strokeWidth={2.25} />}
            {action.label}
          </button>
        )}
      </div>

      {sub && (
        <p className="relative mt-1.5 text-[12px] text-base-content/50">
          {sub}
        </p>
      )}
    </div>
  );
}
