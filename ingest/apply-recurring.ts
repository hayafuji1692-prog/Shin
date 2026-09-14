import { createAdminClient } from "../lib/supabase/admin";

// カード決済されない定期支出（銀行振替の積立投資など）を、毎月day_of_month以降に
// 1回だけtransactionsへ自動登録する。gmail_message_idを
// "recurring:<rule id>:<年-月>" という合成キーにすることで、
// 同じ月に何度実行しても二重登録されない（unique制約に守られる）。

async function main() {
  const supabase = createAdminClient();

  const { data: rules, error } = await supabase
    .from("recurring_transactions")
    .select("id, label, amount, category_id, day_of_month");
  if (error) throw error;

  if (!rules || rules.length === 0) {
    console.log("recurring_transactionsは未登録です。終了します。");
    return;
  }

  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const year = jst.getUTCFullYear();
  const month = jst.getUTCMonth() + 1;
  const day = jst.getUTCDate();
  const monthStr = `${year}-${String(month).padStart(2, "0")}`;

  let inserted = 0;
  let skipped = 0;

  for (const rule of rules) {
    if (day < rule.day_of_month) {
      skipped++;
      continue;
    }

    const gmailMessageId = `recurring:${rule.id}:${monthStr}`;
    const transactionDate = `${year}-${String(month).padStart(2, "0")}-${String(rule.day_of_month).padStart(2, "0")}T00:00:00+09:00`;

    const { error: insertError } = await supabase.from("transactions").insert({
      gmail_message_id: gmailMessageId,
      transaction_date: transactionDate,
      merchant_raw: rule.label,
      merchant_normalized: rule.label.toLowerCase(),
      amount: rule.amount,
      category_id: rule.category_id,
      source_issuer: "recurring",
    });

    if (insertError) {
      // 一意制約違反（今月分は登録済み）は正常なのでスキップ扱い
      if (insertError.code === "23505") {
        skipped++;
        continue;
      }
      throw insertError;
    }

    console.log(`登録: ${rule.label} ¥${rule.amount} (${monthStr})`);
    inserted++;
  }

  console.log(`完了: ${inserted}件登録, ${skipped}件スキップ`);
}

main().catch((error) => {
  console.error("定期支出の登録処理が失敗しました:", error);
  process.exit(1);
});
