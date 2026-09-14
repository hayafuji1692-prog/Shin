import { createAdminClient } from "../lib/supabase/admin";
import type { CategoryRule } from "../lib/types";
import { categorize, normalizeMerchant } from "./categorize";
import { getAccessToken, getMessage, listMessageIds } from "./gmail-client";
import { buildSearchQuery, findParserForSender } from "./parsers";

// 実行間隔（GitHub Actionsのcronは1時間毎）より広めの窓を持たせ、取りこぼしを防止する。
// 重複は transactions.gmail_message_id の一意制約で防がれるので安全に再実行できる。
const SEARCH_WINDOW_DAYS = 2;

async function main() {
  const supabase = createAdminClient();

  console.log("[1/5] Gmailアクセストークンを取得中...");
  const accessToken = await getAccessToken();

  const query = buildSearchQuery(SEARCH_WINDOW_DAYS);
  console.log(`[2/5] Gmailメッセージを検索中... query="${query}"`);
  const messageIds = await listMessageIds(accessToken, query);
  console.log(`  → ${messageIds.length}件のメッセージが見つかりました`);

  if (messageIds.length === 0) {
    console.log("処理対象のメールがありませんでした。終了します。");
    return;
  }

  console.log("[3/5] 既存の取引と突き合わせ中...");
  const { data: existing, error: existingError } = await supabase
    .from("transactions")
    .select("gmail_message_id")
    .in("gmail_message_id", messageIds);
  if (existingError) throw existingError;
  const existingIds = new Set((existing ?? []).map((row) => row.gmail_message_id as string));

  const newMessageIds = messageIds.filter((id) => !existingIds.has(id));
  console.log(`  → 新規メッセージ: ${newMessageIds.length}件`);

  if (newMessageIds.length === 0) {
    console.log("新規の取引はありませんでした。終了します。");
    return;
  }

  console.log("[4/5] 分類ルールを取得中...");
  const { data: rules, error: rulesError } = await supabase
    .from("category_rules")
    .select("id, keyword, category_id, priority");
  if (rulesError) throw rulesError;
  const categoryRules = (rules ?? []) as CategoryRule[];

  const { data: uncategorized, error: uncategorizedError } = await supabase
    .from("categories")
    .select("id")
    .eq("name", "未分類")
    .maybeSingle();
  if (uncategorizedError) throw uncategorizedError;
  const uncategorizedId: string | null = uncategorized?.id ?? null;

  console.log("[5/5] メールを解析してSupabaseへ登録中...");
  let inserted = 0;
  let skipped = 0;

  for (const messageId of newMessageIds) {
    const message = await getMessage(accessToken, messageId);
    const parser = findParserForSender(message.from);
    if (!parser) {
      console.warn(`  ! 対応パーサーなし: from="${message.from}" (id=${messageId})`);
      skipped++;
      continue;
    }

    const parsed = parser.parse(message.bodyText);
    if (!parsed) {
      console.warn(`  ! 本文の解析に失敗: id=${messageId}`);
      skipped++;
      continue;
    }

    const merchantNormalized = normalizeMerchant(parsed.merchantRaw);
    const categoryId = categorize(merchantNormalized, categoryRules) ?? uncategorizedId;

    const { error: insertError } = await supabase.from("transactions").insert({
      gmail_message_id: messageId,
      transaction_date: parsed.transactionDate,
      merchant_raw: parsed.merchantRaw,
      merchant_normalized: merchantNormalized,
      amount: parsed.amount,
      category_id: categoryId,
      source_issuer: parser.issuer,
    });

    if (insertError) {
      // gmail_message_id の一意制約違反（同時実行などでの重複）は無視してよい
      if (insertError.code === "23505") {
        skipped++;
        continue;
      }
      throw insertError;
    }

    inserted++;
  }

  console.log(`完了: ${inserted}件登録, ${skipped}件スキップ`);
}

main().catch((error) => {
  console.error("取り込みジョブが失敗しました:", error);
  process.exit(1);
});
