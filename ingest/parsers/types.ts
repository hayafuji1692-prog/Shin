export type ParsedTransaction = {
  transactionDate: string; // ISO日時文字列
  merchantRaw: string;
  amount: number;
  cardName: string;
  /** オーソリのキャンセル通知の場合true。対応する元の購入取引を削除する必要がある */
  isCancellation?: boolean;
};

export interface EmailParser {
  /** 'smbc' などカード発行会社の識別子 */
  issuer: string;
  /** 通知メールの送信元ドメイン（Gmail検索クエリの構築にも使う。例: 'vpass.ne.jp'） */
  senderDomain: string;
  /** Fromヘッダーの文字列からこのパーサーが対象とするメールかを判定する */
  matchesSender(fromHeader: string): boolean;
  /** メール本文（プレーンテキスト）から取引情報を抽出する。抽出できない場合はnull */
  parse(bodyText: string): ParsedTransaction | null;
}
