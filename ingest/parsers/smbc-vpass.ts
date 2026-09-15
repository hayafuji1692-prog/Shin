import type { EmailParser, ParsedTransaction } from "./types";

// 実際のVpass通知メール本文（抜粋）:
//
//   ご利用カード：Ｏｌｉｖｅ ゴールド／クレジット
//
//   ◇利用日：2026/09/14 15:03
//   ◇利用先：スターバックス モバイルオーダー／ＡＰ
//   ◇利用取引：買物
//   ◇利用金額：440円
//
// 全角/半角どちらのコロンも許容し、金額の桁区切りカンマも許容する。
// 海外決済（Kiwi.comなど）では「62,586.00JPY」のように小数点＋JPY表記になることがある。
const CARD_RE = /ご利用カード[:：]\s*(.+)/;
const DATE_RE = /◇利用日[:：]\s*(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})/;
const MERCHANT_RE = /◇利用先[:：]\s*(.+)/;
const TRANSACTION_TYPE_RE = /◇利用取引[:：]\s*(.+)/;
const AMOUNT_RE = /◇利用金額[:：]\s*([\d,]+)(?:\.\d+)?\s*(?:円|JPY)/i;

export const smbcVpassParser: EmailParser = {
  issuer: "smbc",
  senderDomain: "vpass.ne.jp",

  matchesSender(fromHeader: string): boolean {
    return fromHeader.toLowerCase().includes(this.senderDomain);
  },

  parse(bodyText: string): ParsedTransaction | null {
    const dateMatch = bodyText.match(DATE_RE);
    const merchantMatch = bodyText.match(MERCHANT_RE);
    const amountMatch = bodyText.match(AMOUNT_RE);
    const cardMatch = bodyText.match(CARD_RE);
    const transactionTypeMatch = bodyText.match(TRANSACTION_TYPE_RE);

    if (!dateMatch || !merchantMatch || !amountMatch) {
      return null;
    }

    // 「取消」（オーソリのキャンセル）は支出ではないため取り込まない
    if (transactionTypeMatch?.[1]?.trim() === "取消") {
      return null;
    }

    const [, year, month, day, hour, minute] = dateMatch;
    // メール記載の日時は日本時間なので +09:00 を明示し、実行環境のタイムゾーンに左右されないようにする
    const transactionDate = `${year}-${month}-${day}T${hour}:${minute}:00+09:00`;

    const amount = Number(amountMatch[1]!.replace(/,/g, ""));
    if (Number.isNaN(amount)) {
      return null;
    }

    return {
      transactionDate,
      merchantRaw: merchantMatch[1]!.trim(),
      amount,
      cardName: cardMatch ? cardMatch[1]!.trim() : "SMBCカード",
    };
  },
};
