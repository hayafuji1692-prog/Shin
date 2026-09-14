import type { EmailParser } from "./types";
import { smbcVpassParser } from "./smbc-vpass";

// 新しいカード会社を追加する場合は、同じ EmailParser インターフェースを実装したファイルを
// このディレクトリに追加し、下の配列に1行足すだけでよい。他のファイルの変更は不要。
export const parsers: EmailParser[] = [smbcVpassParser];

export function findParserForSender(fromHeader: string): EmailParser | undefined {
  return parsers.find((parser) => parser.matchesSender(fromHeader));
}

/** 登録済みパーサーの送信元ドメインをORでつないだGmail検索クエリを組み立てる */
export function buildSearchQuery(days: number): string {
  const domains = parsers.map((parser) => parser.senderDomain).join(" OR ");
  return `from:(${domains}) newer_than:${days}d`;
}
