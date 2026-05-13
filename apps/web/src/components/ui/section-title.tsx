"use client";

import type { ReactNode } from "react";

export function SectionTitle({
  eyebrow,
  title,
  right,
}: {
  eyebrow?: string;
  title: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div>
        {eyebrow && (
          <p className="eyebrow mb-1">
            {eyebrow}
          </p>
        )}
        <h2 className="text-[15px] font-semibold text-base-content">
          {title}
        </h2>
      </div>
      {right}
    </div>
  );
}
