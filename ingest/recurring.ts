// 定期支出ルールの有効期間。start_month / end_month は "YYYY-MM-01" 形式（どちらも含む）。
// 未設定(null)は期間の制限なし。金額を途中で変えたいときは、今のルールにend_monthを入れて
// 終わらせ、新しい金額のルールをstart_month付きで追加する。
export type RecurringPeriod = {
  start_month: string | null;
  end_month: string | null;
};

export function isRuleActiveInMonth(rule: RecurringPeriod, monthFirst: string): boolean {
  if (rule.start_month && monthFirst < rule.start_month) return false;
  if (rule.end_month && monthFirst > rule.end_month) return false;
  return true;
}
