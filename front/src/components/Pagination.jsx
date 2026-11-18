// Пагинация для списков {items, total, limit, offset}.

export function Pagination({ total, limit, offset, onPage }) {
  if (!total) return null;
  const from = offset + 1;
  const to = Math.min(offset + limit, total);

  return (
    <div className="pagination">
      <span>
        Показано {from}–{to} из {total}
      </span>
      <div className="pagination__btns">
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          disabled={offset <= 0}
          onClick={() => onPage(Math.max(0, offset - limit))}
        >
          Назад
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          disabled={to >= total}
          onClick={() => onPage(offset + limit)}
        >
          Вперёд
        </button>
      </div>
    </div>
  );
}
