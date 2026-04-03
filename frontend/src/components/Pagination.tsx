interface Props {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, total, limit, onPageChange }: Props) {
  if (totalPages <= 1) return null;

  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50 text-sm">
      <span className="text-gray-500">
        Showing {from}–{to} of {total}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(1)}
          disabled={page <= 1}
          className="px-2 py-1 border rounded text-gray-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
        >
          «
        </button>
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="px-3 py-1 border rounded text-gray-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Prev
        </button>
        <span className="px-3 py-1 text-gray-700">
          {page} / {totalPages}
        </span>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="px-3 py-1 border rounded text-gray-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Next
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={page >= totalPages}
          className="px-2 py-1 border rounded text-gray-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
        >
          »
        </button>
      </div>
    </div>
  );
}
