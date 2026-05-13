"use client";

import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        <h1 className="text-[26px] font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-[13px]" style={{ color: "var(--text-muted)" }}>
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
