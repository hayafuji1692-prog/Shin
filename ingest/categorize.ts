import type { CategoryRule } from "../lib/types";

// NFKCで全角英数・記号・全角ダッシュ等を半角に統一する。同じ店でもメールの種類によって
// 全角（「ＡＰＰＬＥ．ＣＯＭ／ＪＰ」）と半角（「APPLE.COM/JP」）が混在するため、
// 取引の突き合わせ（返品・取消）や分類ルールの照合が文字種の違いで外れないようにする。
function foldText(text: string): string {
  return text.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
}

export function normalizeMerchant(merchantRaw: string): string {
  return foldText(merchantRaw);
}

/**
 * merchantNormalized に対してキーワードルールを優先度順に評価し、
 * マッチしたカテゴリIDを返す。マッチしなければ null（呼び出し側で未分類カテゴリにフォールバック）。
 */
export function categorize(merchantNormalized: string, rules: CategoryRule[]): string | null {
  const sorted = [...rules].sort((a, b) => b.priority - a.priority);
  const hit = sorted.find((rule) => merchantNormalized.includes(foldText(rule.keyword)));
  return hit?.category_id ?? null;
}
