import { CategoryPieChart } from "@/components/charts/CategoryPieChart";
import { TransactionFilters } from "@/components/ui/TransactionFilters";
import { TransactionList } from "@/components/ui/TransactionList";
import { currentMonthJst, formatMonthLabel, formatYen, monthsBeforeJst } from "@/lib/date";
import { buildCategorySlices } from "@/lib/pie";
import { getCategories, getMonthlyCategoryTotals, getTransactions } from "@/lib/queries";

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

  // グラフはカテゴリで絞り込まず、その月の全カテゴリの内訳を常に表示する
  const [categories, transactions, monthlyTotals] = await Promise.all([
    getCategories(),
    getTransactions({ month: selectedMonth, categoryId: selectedCategory || undefined }),
    getMonthlyCategoryTotals(selectedMonth),
  ]);

  const total = transactions.reduce((sum, tx) => sum + Number(tx.amount), 0);
  const pieData = buildCategorySlices(monthlyTotals, categories);

  return (
    <>
      <h1 className="section-title">取引一覧</h1>
      <TransactionFilters months={months} monthLabels={monthLabels} categories={categories} />

      <div className="card">
        <div className="summary-label">{formatMonthLabel(selectedMonth)}の合計</div>
        <p className="summary-value">{formatYen(total)}</p>
      </div>

      <div className="card">
        <h2 className="section-title">{formatMonthLabel(selectedMonth)}のカテゴリ別内訳</h2>
        <CategoryPieChart data={pieData} month={selectedMonth} />
      </div>

      <div className="card">
        <TransactionList transactions={transactions} categories={categories} />
      </div>
    </>
  );
}
