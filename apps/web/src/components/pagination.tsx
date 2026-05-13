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
        className="btn btn-sm btn-neutral"
      >
        Previous
      </button>
      <span className="text-sm text-base-content/60">Page {page}</span>
      <button
        onClick={onNext}
        disabled={!hasMore}
        className="btn btn-sm btn-neutral"
      >
        Next
      </button>
    </div>
  );
}
