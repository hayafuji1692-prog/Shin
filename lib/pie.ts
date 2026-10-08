import type { CategorySlice } from "@/components/charts/CategoryPieChart";
import type { Category, MonthlyCategoryTotal } from "./types";

/** 月のカテゴリ別合計を、円グラフ用のデータ（金額の大きい順）に変換する */
export function buildCategorySlices(totals: MonthlyCategoryTotal[], categories: Category[]): CategorySlice[] {
  const nameById = new Map(categories.map((c) => [c.id, c.name]));

  return totals
    .map((row) => ({
      id: row.category_id,
      name: row.category_id ? nameById.get(row.category_id) ?? "未分類" : "未分類",
      value: Number(row.total),
    }))
    .sort((a, b) => b.value - a.value);
}
