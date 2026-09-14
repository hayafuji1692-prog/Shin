const JST_OFFSET_MINUTES = 9 * 60;

/** 現在時刻を日本時間(JST)として扱ったときの年月を "YYYY-MM-01" 形式で返す */
export function currentMonthJst(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + JST_OFFSET_MINUTES * 60 * 1000);
  const year = jst.getUTCFullYear();
  const month = String(jst.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01`;
}

/** "YYYY-MM-01" 形式の月文字列から、nヶ月前の同形式の文字列を返す */
export function monthsBeforeJst(monthStr: string, n: number): string {
  const [year, month] = monthStr.split("-").map(Number) as [number, number];
  const date = new Date(Date.UTC(year, month - 1 - n, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

/** "YYYY-MM-01" を "2026年9月" のような表示用文字列に変換 */
export function formatMonthLabel(monthStr: string): string {
  const [year, month] = monthStr.split("-").map(Number) as [number, number];
  return `${year}年${month}月`;
}

export function formatYen(amount: number): string {
  return `¥${Math.round(amount).toLocaleString("ja-JP")}`;
}
