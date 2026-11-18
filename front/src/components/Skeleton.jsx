// Скелетоны загрузки: показываем структуру карточки, пока данные идут из API.

export function Skeleton({ className = '' }) {
  return <span className={`skeleton ${className}`.trim()} />;
}

// Несколько «пустых» карточек для списков заявок
export function SkeletonCards({ count = 3 }) {
  return (
    <div className="stack" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card skeleton-card">
          <Skeleton className="skeleton--title" />
          <Skeleton className="skeleton--line" />
          <Skeleton className="skeleton--line-short" />
        </div>
      ))}
    </div>
  );
}

// Строки-заглушки для таблиц
export function SkeletonRows({ rows = 4 }) {
  return (
    <div className="stack" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="card skeleton-card">
          <Skeleton className="skeleton--line" />
        </div>
      ))}
    </div>
  );
}
