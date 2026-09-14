# 家計簿アプリ (kakeibo-app)

三井住友カード(Vpass)の利用通知メール(Gmail経由)を自動取得し、カテゴリ分け・グラフ表示・月次集計を行う個人用家計簿Webアプリ。

- **取り込み**: GitHub Actions (cron) が1時間毎にGmailからVpass通知メールを取得し、解析・分類してSupabaseに保存
- **表示**: Next.js製フロントエンドがSupabaseから読み取り専用で取得し、グラフ・一覧を表示（Vercelでホスティング）
- **無料運用**: GitHub Actions + Supabase + Vercelの無料枠のみで完結

初回セットアップの手順は [docs/SETUP.md](docs/SETUP.md) を参照してください。

## アーキテクチャ

```
Gmail (statement@vpass.ne.jp) → GitHub Actions (cron) → Supabase (Postgres) → Next.js (Vercel)
```

- 書き込みができるのはGitHub Actionsの取り込みジョブのみ（Supabase service role key使用）
- フロントエンドはSupabaseのanonキー(読み取り専用、Row Level Securityで制御)を使う
- `transactions.gmail_message_id` の一意制約により、取り込みジョブは何度再実行しても安全（冪等）

## ローカル開発

```bash
npm install
cp .env.example .env.local   # Supabaseの値を入力
npm run dev
```

`.env.local` には最低限 `NEXT_PUBLIC_SUPABASE_URL` と `NEXT_PUBLIC_SUPABASE_ANON_KEY` が必要です（[docs/SETUP.md](docs/SETUP.md) 参照）。

## 取り込みジョブをローカルで手動テストする

```bash
GMAIL_CLIENT_ID=xxx \
GMAIL_CLIENT_SECRET=yyy \
GMAIL_REFRESH_TOKEN=zzz \
SUPABASE_URL=https://xxxx.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=xxxx \
npm run ingest
```

実行するとGmailから直近2日分のVpass通知メールを検索し、新規分だけをSupabaseに登録します。既存のメールは`gmail_message_id`で重複排除されるため、何度実行しても安全です。

## 新しいカード会社を追加する方法

1. `ingest/parsers/types.ts` の `EmailParser` インターフェースを実装した新しいファイルを `ingest/parsers/` に追加する（例: `rakuten.ts`）。参考: `ingest/parsers/smbc-vpass.ts`
2. `ingest/parsers/index.ts` の `parsers` 配列に追加したパーサーを1行足す
3. `supabase/schema.sql` の `cards` テーブルに新しいカードの行を追加する（任意）

これだけで、Gmail検索クエリ（`buildSearchQuery`）・解析・分類の全パイプラインが自動的に新しいカードにも対応します。

## ディレクトリ構成

- `app/` — Next.js App Router のページ（ダッシュボード・取引一覧）
- `components/` — チャート・UIコンポーネント
- `ingest/` — Gmail取り込みスクリプト（GitHub Actionsから実行）
- `lib/` — Supabaseクライアント・型定義・データ取得関数
- `scripts/mint-gmail-refresh-token.ts` — 初回のみローカルで実行するGmail認可スクリプト
- `supabase/schema.sql` — SupabaseのSQL Editorに貼り付けるスキーマ定義

## 今後の拡張（未実装・スキーマは準備済み）

- 予算管理機能: `budgets` テーブルと `monthly_category_totals` ビューを使った予算対比UI
- 他カード会社（楽天・JCBなど）のパーサー追加
