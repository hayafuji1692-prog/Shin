export default function TransactionsLoading() {
  return (
    <>
      <h1 className="section-title">取引一覧</h1>
      <div className="filter-row">
        <div className="skeleton skeleton-select" />
        <div className="skeleton skeleton-select" />
      </div>

      <div className="card">
        <div className="skeleton skeleton-label" />
        <div className="skeleton skeleton-value" />
      </div>

      <div className="card">
        <ul className="transaction-list">
          {Array.from({ length: 5 }).map((_, i) => (
            <li key={i} className="transaction-item">
              <div style={{ flex: 1 }}>
                <div className="skeleton skeleton-line" />
                <div className="skeleton skeleton-line-short" />
              </div>
              <div className="skeleton skeleton-amount" />
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
