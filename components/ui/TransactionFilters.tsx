"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { Category } from "@/lib/types";

export function TransactionFilters({
  months,
  monthLabels,
  categories,
}: {
  months: string[];
  monthLabels: string[];
  categories: Category[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentMonth = searchParams.get("month") ?? months[0];
  const currentCategory = searchParams.get("category") ?? "";

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`/transactions?${params.toString()}`);
  }

  return (
    <div className="filter-row">
      <select value={currentMonth} onChange={(e) => updateParam("month", e.target.value)}>
        {months.map((month, i) => (
          <option key={month} value={month}>
            {monthLabels[i]}
          </option>
        ))}
      </select>
      <select value={currentCategory} onChange={(e) => updateParam("category", e.target.value)}>
        <option value="">すべてのカテゴリ</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  );
}
