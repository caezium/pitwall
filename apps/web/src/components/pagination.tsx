"use client";

type Props = {
  offset: number;
  limit: number;
  hasMore: boolean;
  onPrev: () => void;
  onNext: () => void;
};

export function Pagination({ offset, limit, hasMore, onPrev, onNext }: Props) {
  const page = Math.floor(offset / limit) + 1;

  return (
    <div className="flex items-center justify-between pt-4">
      <button
        onClick={onPrev}
        disabled={offset === 0}
        className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        Previous
      </button>
      <span className="text-sm text-zinc-500">Page {page}</span>
      <button
        onClick={onNext}
        disabled={!hasMore}
        className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        Next
      </button>
    </div>
  );
}
