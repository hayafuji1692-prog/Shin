import { TransactionFilters } from "@/components/ui/TransactionFilters";
import { currentMonthJst, formatMonthLabel, formatYen, monthsBeforeJst } from "@/lib/date";
import { getCategories, getTransactions } from "@/lib/queries";

export const revalidate = 0;

const MONTH_OPTIONS_COUNT = 12;

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; category?: string }>;
}) {
  const params = await searchParams;
  const current = currentMonthJst();
  const months = Array.from({ length: MONTH_OPTIONS_COUNT }, (_, i) => monthsBeforeJst(current, i));
  const monthLabels = months.map(formatMonthLabel);

  const selectedMonth = params.month && months.includes(params.month) ? params.month : current;
  const selectedCategory = params.category ?? "";

  const [categories, transactions] = await Promise.all([
    getCategories(),
    getTransactions({ month: selectedMonth, categoryId: selectedCategory || undefined }),
  ]);

  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));
  const total = transactions.reduce((sum, tx) => sum + Number(tx.amount), 0);

  return (
    <>
      <h1 className="section-title">取引一覧</h1>
      <TransactionFilters months={months} monthLabels={monthLabels} categories={categories} />

      <div className="card">
        <div className="summary-label">{formatMonthLabel(selectedMonth)}の合計</div>
        <p className="summary-value">{formatYen(total)}</p>
      </div>

      <div className="card">
        {transactions.length === 0 ? (
          <p className="empty-state">該当する取引がありません</p>
        ) : (
          <ul className="transaction-list">
            {transactions.map((tx) => (
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
                  {tx.category_id && (
                    <span className="category-tag">{categoryNameById.get(tx.category_id) ?? "未分類"}</span>
                  )}
                </div>
                <span className="transaction-amount">{formatYen(tx.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
