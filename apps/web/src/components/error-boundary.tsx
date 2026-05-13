"use client";

/**
 * Error state for tRPC query failures. Themed via DaisyUI `alert alert-error`
 * so it inherits the active theme's error color (race-red in pitwall-dark,
 * default red in light).
 */
export function QueryError({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div role="alert" className="alert alert-error rounded-2xl">
      <div className="flex-1">
        <p className="font-semibold">Failed to load data</p>
        <p className="text-sm opacity-80 mt-0.5">
          {error instanceof Error ? error.message : "An error occurred"}
        </p>
      </div>
      {onRetry && (
        <button onClick={onRetry} className="btn btn-sm btn-neutral">
          Retry
        </button>
      )}
    </div>
  );
}
