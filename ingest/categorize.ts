import type { CategoryRule } from "../lib/types";

export function normalizeMerchant(merchantRaw: string): string {
  return merchantRaw.trim().toLowerCase();
}

/**
 * merchantNormalized に対してキーワードルールを優先度順に評価し、
 * マッチしたカテゴリIDを返す。マッチしなければ null（呼び出し側で未分類カテゴリにフォールバック）。
 */
export function categorize(merchantNormalized: string, rules: CategoryRule[]): string | null {
  const sorted = [...rules].sort((a, b) => b.priority - a.priority);
  const hit = sorted.find((rule) => merchantNormalized.includes(rule.keyword.toLowerCase()));
  return hit?.category_id ?? null;
}
