import type { EmailParser, ParsedTransaction } from "./types";

// 実際のVpass通知メール本文には主に2パターンある:
//
// (A) 1件ずつの通知（「ご利用のお知らせ」）: 日時に時刻まで含む
//   ◇利用日：2026/09/14 15:03
//   ◇利用先：スターバックス モバイルオーダー／ＡＰ
//   ◇利用取引：買物
//   ◇利用金額：440円
//
// (B) 複数件をまとめた通知（「ご利用明細のお知らせ」）: 日付のみで時刻がなく、
//     ◇のブロックが1通に複数繰り返される。返品の場合は金額がマイナスになる。
//   ◇利用日：2026/09/18
//   ◇利用先：ＰＬＡＮＴ 高島店
//   ◇利用取引：返品
//   ◇利用金額：-110円
//
// どちらの形式にも対応するため、◇利用日〜◇利用金額のブロックをすべて検出する。
// 全角/半角どちらのコロンも許容し、金額の桁区切りカンマも許容する。
// 海外決済（Kiwi.comなど）では「62,586.00JPY」のように小数点＋JPY表記になることがある。
const BLOCK_RE =
  /◇利用日[:：]\s*(\d{4})\/(\d{2})\/(\d{2})(?:\s+(\d{2}):(\d{2}))?[\s\S]*?◇利用先[:：]\s*(.+)[\s\S]*?◇利用取引[:：]\s*(.+)[\s\S]*?◇利用金額[:：]\s*(-?[\d,]+)(?:\.\d+)?\s*(?:円|JPY)/gi;
const CARD_RE = /ご利用カード[:：]\s*(.+)/;

export const smbcVpassParser: EmailParser = {
  issuer: "smbc",
  senderDomain: "vpass.ne.jp",

  matchesSender(fromHeader: string): boolean {
    return fromHeader.toLowerCase().includes(this.senderDomain);
  },

  parseAll(bodyText: string): ParsedTransaction[] {
    const cardMatch = bodyText.match(CARD_RE);
    const cardName = cardMatch ? cardMatch[1]!.trim() : "SMBCカード";

    const results: ParsedTransaction[] = [];
    for (const match of bodyText.matchAll(BLOCK_RE)) {
      const [, year, month, day, hour, minute, merchantRaw, transactionType, amountRaw] = match;

      // 時刻がない場合（複数件まとめ通知）は00:00として扱う
      const transactionDate = `${year}-${month}-${day}T${hour ?? "00"}:${minute ?? "00"}:00+09:00`;

      const amount = Number(amountRaw!.replace(/,/g, ""));
      if (Number.isNaN(amount)) continue;

      // 「取消」（オーソリのキャンセル）・「返品」はどちらも支出として計上せず、
      // 対応する元の購入取引を無効化する必要がある。呼び出し側（fetch-vpass-emails.ts）
      // で処理するため、ここでは金額の絶対値と店名・日付を返しつつフラグを立てる。
      const type = transactionType!.trim();
      const isCancellation = type === "取消" || type === "返品";

      results.push({
        transactionDate,
        merchantRaw: merchantRaw!.trim(),
        amount: Math.abs(amount),
        cardName,
        isCancellation,
      });
    }

    return results;
  },
};
