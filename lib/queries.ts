import { supabase } from "./supabase/client";
import type { Category, MonthlyCategoryTotal, Transaction } from "./types";
import { monthsBeforeJst } from "./date";

export async function getCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, sort_order")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** 指定月(YYYY-MM-01)のカテゴリ別合計を取得 */
export async function getMonthlyCategoryTotals(month: string): Promise<MonthlyCategoryTotal[]> {
  const { data, error } = await supabase
    .from("monthly_category_totals")
    .select("month, category_id, total")
    .eq("month", month);
  if (error) throw error;
  return data ?? [];
}

/** 直近nヶ月分の月次合計（カテゴリ横断）を、古い月から新しい月の順で取得 */
export async function getMonthlyTrend(currentMonth: string, monthsBack: number): Promise<
  { month: string; total: number }[]
> {
  const earliestMonth = monthsBeforeJst(currentMonth, monthsBack - 1);
  const { data, error } = await supabase
    .from("monthly_category_totals")
    .select("month, total")
    .gte("month", earliestMonth)
    .lte("month", currentMonth);
  if (error) throw error;

  const totalsByMonth = new Map<string, number>();
  for (const row of data ?? []) {
    totalsByMonth.set(row.month, (totalsByMonth.get(row.month) ?? 0) + Number(row.total));
  }

  const result: { month: string; total: number }[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const month = monthsBeforeJst(currentMonth, i);
    result.push({ month, total: totalsByMonth.get(month) ?? 0 });
  }
  return result;
}

export type TransactionFilter = {
  month?: string; // YYYY-MM-01
  categoryId?: string;
};

export async function getTransactions(filter: TransactionFilter): Promise<Transaction[]> {
  let query = supabase
    .from("transactions")
    .select(
      "id, gmail_message_id, card_id, transaction_date, merchant_raw, merchant_normalized, amount, category_id, source_issuer, created_at"
    )
    .order("transaction_date", { ascending: false });

  if (filter.month) {
    const [year, month] = filter.month.split("-").map(Number) as [number, number];
    const start = `${filter.month}T00:00:00+09:00`;
    const nextMonthDate = new Date(Date.UTC(year, month, 1));
    const end = `${nextMonthDate.getUTCFullYear()}-${String(nextMonthDate.getUTCMonth() + 1).padStart(2, "0")}-01T00:00:00+09:00`;
    query = query.gte("transaction_date", start).lt("transaction_date", end);
  }

  if (filter.categoryId) {
    query = query.eq("category_id", filter.categoryId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}
