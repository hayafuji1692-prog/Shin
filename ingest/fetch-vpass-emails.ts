import { simpleParser } from "mailparser";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "../lib/supabase/admin";
import type { CategoryRule } from "../lib/types";
import { categorize, normalizeMerchant } from "./categorize";
import { getAccessToken, getAttachmentRaw, getMessage, listMessageIds } from "./gmail-client";
import { buildSearchQuery, findParserForSender } from "./parsers";
import type { EmailParser, ParsedTransaction } from "./parsers/types";

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
  issuer: string,
  parsed: ParsedTransaction,
  categoryRules: CategoryRule[],
  uncategorizedId: string | null
): Promise<"inserted" | "skipped"> {
  const merchantNormalized = normalizeMerchant(parsed.merchantRaw);

  // 「取消」通知: 支出としては計上せず、対応する元の購入取引を無効化する。
  // ここでdeleteすると gmail_message_id の一意制約による保護が消え、同じ購入メールを
  // 万一再度取り込んだ場合（再転送やバックフィルの再実行など）に取消済みの取引が
  // 復活してしまうため、行は残したまま is_cancelled フラグを立てるだけにする。
  if (parsed.isCancellation) {
    const { data: match, error: findError } = await supabase
      .from("transactions")
      .select("id")
      .eq("merchant_normalized", merchantNormalized)
      .eq("amount", parsed.amount)
      .eq("source_issuer", issuer)
      .eq("is_cancelled", false)
      .lte("transaction_date", parsed.transactionDate)
      .order("transaction_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (findError) throw findError;

    if (!match) {
      console.warn(`  ! 取消に対応する取引が見つかりません: ${parsed.merchantRaw} ¥${parsed.amount}`);
      return "skipped";
    }

    const { error: updateError } = await supabase
      .from("transactions")
      .update({ is_cancelled: true })
      .eq("id", match.id);
    if (updateError) throw updateError;

    console.log(`  取消により無効化: ${parsed.merchantRaw} ¥${parsed.amount}`);
    return "inserted";
  }

  const categoryId = categorize(merchantNormalized, categoryRules) ?? uncategorizedId;

  const { error: insertError } = await supabase.from("transactions").insert({
    gmail_message_id: gmailMessageId,
    transaction_date: parsed.transactionDate,
    merchant_raw: parsed.merchantRaw,
    merchant_normalized: merchantNormalized,
    amount: parsed.amount,
    category_id: categoryId,
    source_issuer: issuer,
  });

  if (insertError) {
    // gmail_message_id の一意制約違反（同時実行や再送によるものも含む）は無視してよい
    if (insertError.code === "23505") return "skipped";
    throw insertError;
  }

  return "inserted";
}

// 1通のメールに複数件の取引（「ご利用明細のお知らせ」のような一括通知）が含まれる
// ことがあるため、既存の1件だけの通知との互換性を保ちつつ全件処理する。
// 1件目は従来通りメール自体のIDをそのままdedupキーに使い、2件目以降だけ連番を付ける
// （そうしないと、これまで登録済みの1件通知メールのキー形式が変わってしまい、
// 次回の実行で同じ取引が重複登録されてしまう）。
async function processEmail(
  supabase: SupabaseClient,
  baseDedupKey: string,
  parser: EmailParser,
  bodyText: string,
  categoryRules: CategoryRule[],
  uncategorizedId: string | null
): Promise<{ inserted: number; skipped: number }> {
  const parsedTransactions = parser.parseAll(bodyText);
  if (parsedTransactions.length === 0) {
    console.warn(`  ! 本文の解析に失敗: id=${baseDedupKey}`);
    return { inserted: 0, skipped: 1 };
  }

  let inserted = 0;
  let skipped = 0;
  for (const [i, parsed] of parsedTransactions.entries()) {
    const dedupKey = i === 0 ? baseDedupKey : `${baseDedupKey}:${i}`;
    const result = await insertTransaction(supabase, dedupKey, parser.issuer, parsed, categoryRules, uncategorizedId);
    result === "inserted" ? inserted++ : skipped++;
  }
  return { inserted, skipped };
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
      const result = await processEmail(
        supabase,
        message.messageId,
        directParser,
        message.bodyText,
        categoryRules,
        uncategorizedId
      );
      inserted += result.inserted;
      skipped += result.skipped;
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

      const result = await processEmail(
        supabase,
        dedupKey,
        embeddedParser,
        bodyText,
        categoryRules,
        uncategorizedId
      );
      inserted += result.inserted;
      skipped += result.skipped;
    }
  }

  console.log(`完了: ${inserted}件登録, ${skipped}件スキップ`);
}

main().catch((error) => {
  console.error("取り込みジョブが失敗しました:", error);
  process.exit(1);
});
