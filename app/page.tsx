import Link from "next/link";
import { CategoryPieChart } from "@/components/charts/CategoryPieChart";
import { MonthlyTrendChart } from "@/components/charts/MonthlyTrendChart";
import { currentMonthJst, formatMonthLabel, formatYen } from "@/lib/date";
import { getCategories, getMonthlyCategoryTotals, getMonthlyTrend, getTransactions } from "@/lib/queries";

export const revalidate = 0;

export default async function DashboardPage() {
  const currentMonth = currentMonthJst();

  const [categories, monthlyTotals, trend, transactions] = await Promise.all([
    getCategories(),
    getMonthlyCategoryTotals(currentMonth),
    getMonthlyTrend(currentMonth, 6),
    getTransactions({ month: currentMonth }),
  ]);

  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));

  const totalThisMonth = monthlyTotals.reduce((sum, row) => sum + Number(row.total), 0);

  const pieData = monthlyTotals
    .map((row) => ({
      id: row.category_id,
      name: row.category_id ? categoryNameById.get(row.category_id) ?? "未分類" : "未分類",
      value: Number(row.total),
    }))
    .sort((a, b) => b.value - a.value);

  const trendData = trend.map((point) => ({
    label: formatMonthLabel(point.month).replace(/^\d+年/, ""),
    total: point.total,
  }));

  return (
    <>
      <div className="summary-grid">
        <div className="summary-card">
          <p className="summary-label">{formatMonthLabel(currentMonth)}の合計</p>
          <p className="summary-value">{formatYen(totalThisMonth)}</p>
        </div>
        <div className="summary-card">
          <p className="summary-label">取引件数</p>
          <p className="summary-value">{transactions.length}件</p>
        </div>
      </div>

      <div className="card">
        <h2 className="section-title">カテゴリ別内訳</h2>
        <CategoryPieChart data={pieData} month={currentMonth} />
        {pieData.length > 0 && (
          <ul className="transaction-list">
            {pieData.map((slice) =>
              slice.id ? (
                <li key={slice.name} className="transaction-item">
                  <Link
                    href={`/transactions?month=${currentMonth}&category=${slice.id}`}
                    className="category-link"
                  >
                    <span className="transaction-merchant">{slice.name}</span>
                    <span className="transaction-amount">{formatYen(slice.value)}</span>
                  </Link>
                </li>
              ) : (
                <li key={slice.name} className="transaction-item">
                  <span className="transaction-merchant">{slice.name}</span>
                  <span className="transaction-amount">{formatYen(slice.value)}</span>
                </li>
              )
            )}
          </ul>
        )}
      </div>

      <div className="card">
        <h2 className="section-title">月次推移（直近6ヶ月）</h2>
        <MonthlyTrendChart data={trendData} />
      </div>

      <div className="card">
        <h2 className="section-title">最近の取引</h2>
        {transactions.length === 0 ? (
          <p className="empty-state">今月の取引はまだありません</p>
        ) : (
          <ul className="transaction-list">
            {transactions.slice(0, 5).map((tx) => (
              <li key={tx.id} className="transaction-item">
                <div>
                  <div className="transaction-merchant">{tx.merchant_raw}</div>
                  <div className="transaction-meta">
                    {new Date(tx.transaction_date).toLocaleString("ja-JP", {
                      month: "numeric",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
                <span className="transaction-amount">{formatYen(tx.amount)}</span>
              </li>
            ))}
          </ul>
        )}
        <p style={{ marginTop: 12 }}>
          <Link href="/transactions">すべての取引を見る →</Link>
        </p>
      </div>
    </>
  );
}
