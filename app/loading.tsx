export default function DashboardLoading() {
  return (
    <>
      <div className="summary-grid">
        <div className="summary-card">
          <div className="skeleton skeleton-label" />
          <div className="skeleton skeleton-value" />
        </div>
        <div className="summary-card">
          <div className="skeleton skeleton-label" />
          <div className="skeleton skeleton-value" />
        </div>
      </div>

      <div className="card">
        <div className="skeleton skeleton-label" style={{ marginBottom: 16, width: "50%" }} />
        <div className="skeleton" style={{ height: 220, borderRadius: 12 }} />
      </div>

      <div className="card">
        <div className="skeleton skeleton-label" style={{ marginBottom: 16, width: "60%" }} />
        <div className="skeleton" style={{ height: 180, borderRadius: 12 }} />
      </div>
    </>
  );
}
