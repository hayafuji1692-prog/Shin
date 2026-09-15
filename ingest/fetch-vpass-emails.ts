import { simpleParser } from "mailparser";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "../lib/supabase/admin";
import type { CategoryRule } from "../lib/types";
import { categorize, normalizeMerchant } from "./categorize";
import { getAccessToken, getAttachmentRaw, getMessage, listMessageIds } from "./gmail-client";
import { buildSearchQuery, findParserForSender } from "./parsers";
import type { EmailParser } from "./parsers/types";

// 実行間隔（GitHub Actionsのcronは1時間毎）より広めの窓を持たせ、取りこぼしを防止する。
// 重複は transactions.gmail_message_id の一意制約で防がれるので安全に再実行できる。
const SEARCH_WINDOW_DAYS = 2;

// 過去分をまとめて.eml添付で自分宛てに転送したメールも取り込み対象にしたい場合、
// GitHub Secretsに転送元アドレスを設定しておく（未設定なら通常のVpassメールのみ処理）。
const SELF_FORWARD_SENDER = process.env.SELF_FORWARD_SENDER?.trim();

function buildFullQuery(days: number): string {
  const base = buildSearchQuery(days);
  if (!SELF_FORWARD_SENDER) return base;
  return `(${base}) OR (from:(${SELF_FORWARD_SENDER}) has:attachment newer_than:${days}d)`;
}

async function insertTransaction(
  supabase: SupabaseClient,
  gmailMessageId: string,
  parser: EmailParser,
  bodyText: string,
  categoryRules: CategoryRule[],
  uncategorizedId: string | null
): Promise<"inserted" | "skipped"> {
  const parsed = parser.parse(bodyText);
  if (!parsed) {
    console.warn(`  ! 本文の解析に失敗、または対象外（取消など）: id=${gmailMessageId}`);
    return "skipped";
  }

  const merchantNormalized = normalizeMerchant(parsed.merchantRaw);
  const categoryId = categorize(merchantNormalized, categoryRules) ?? uncategorizedId;

  const { error: insertError } = await supabase.from("transactions").insert({
    gmail_message_id: gmailMessageId,
    transaction_date: parsed.transactionDate,
    merchant_raw: parsed.merchantRaw,
    merchant_normalized: merchantNormalized,
    amount: parsed.amount,
    category_id: categoryId,
    source_issuer: parser.issuer,
  });

  if (insertError) {
    // gmail_message_id の一意制約違反（同時実行や再送によるものも含む）は無視してよい
    if (insertError.code === "23505") return "skipped";
    throw insertError;
  }

  return "inserted";
}

async function main() {
  const supabase = createAdminClient();

  console.log("[1/4] Gmailアクセストークンを取得中...");
  const accessToken = await getAccessToken();

  const query = buildFullQuery(SEARCH_WINDOW_DAYS);
  console.log(`[2/4] Gmailメッセージを検索中... query="${query}"`);
  const messageIds = await listMessageIds(accessToken, query);
  console.log(`  → ${messageIds.length}件のメッセージが見つかりました`);

  if (messageIds.length === 0) {
    console.log("処理対象のメールがありませんでした。終了します。");
    return;
  }

  // 事前の重複チェックはしない。取り込み対象のIDが「メール自体のMessage-ID」であり
  // Gmail検索結果のトップレベルIDと一致するとは限らない（.eml添付経由の場合は特に）ため、
  // 実際に中身を開いて解析した後、insert時のunique制約で重複を弾く方が確実。
  console.log("[3/4] 分類ルールを取得中...");
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

  console.log("[4/4] メールを解析してSupabaseへ登録中...");
  let inserted = 0;
  let skipped = 0;

  for (const messageId of messageIds) {
    const message = await getMessage(accessToken, messageId);

    // 直接届いたVpass通知メール。メール自体のMessage-IDで重複判定するため、
    // 同じメールが.eml添付として転送されてきても二重登録されない。
    const directParser = findParserForSender(message.from);
    if (directParser) {
      const result = await insertTransaction(
        supabase,
        message.messageId,
        directParser,
        message.bodyText,
        categoryRules,
        uncategorizedId
      );
      result === "inserted" ? inserted++ : skipped++;
    } else if (message.embeddedEmailAttachments.length === 0) {
      console.warn(`  ! 対応パーサーなし: from="${message.from}" (id=${messageId})`);
      skipped++;
    }

    // .eml添付として転送されたメール（過去分の一括バックフィルなど）
    for (const attachment of message.embeddedEmailAttachments) {
      const raw = await getAttachmentRaw(accessToken, messageId, attachment.attachmentId);
      const embedded = await simpleParser(raw);
      const from = embedded.from?.text ?? "";
      const bodyText = embedded.text ?? "";
      const dedupKey = embedded.messageId ?? `${messageId}:attachment:${attachment.attachmentId}`;

      const embeddedParser = findParserForSender(from);
      if (!embeddedParser) {
        console.warn(`  ! 添付メールの対応パーサーなし: from="${from}" (親id=${messageId})`);
        skipped++;
        continue;
      }

      const result = await insertTransaction(
        supabase,
        dedupKey,
        embeddedParser,
        bodyText,
        categoryRules,
        uncategorizedId
      );
      result === "inserted" ? inserted++ : skipped++;
    }
  }

  console.log(`完了: ${inserted}件登録, ${skipped}件スキップ`);
}

main().catch((error) => {
  console.error("取り込みジョブが失敗しました:", error);
  process.exit(1);
});
