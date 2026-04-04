"use client";

// React 19 doesn't support class-based ErrorBoundary in JSX well.
// Use the QueryError component for error states from tRPC queries.

export function QueryError({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="bg-red-950/30 border border-red-900/50 rounded-xl p-6 text-center">
      <p className="text-red-400 font-medium mb-2">Failed to load data</p>
      <p className="text-sm text-zinc-500 mb-4">
        {error instanceof Error ? error.message : "An error occurred"}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors"
        >
          Retry
        </button>
      )}
    </div>
  );
}
