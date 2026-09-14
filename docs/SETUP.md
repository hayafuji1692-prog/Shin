# セットアップ手順

このアプリを動かすには、以下を**あなた自身の操作で**準備する必要があります（Claudeはアカウント作成やログイン情報の入力を代行できません）。順番に進めてください。

---

## 1. Supabase（データベース）

1. https://supabase.com にアクセスし、GitHubアカウント等でサインアップ
2. 「New Project」でプロジェクトを作成（リージョンは Northeast Asia (Tokyo) を推奨、無料プランでOK）
3. 作成したプロジェクトの左メニューから **SQL Editor** を開く
4. このリポジトリの [`supabase/schema.sql`](../supabase/schema.sql) の中身を全部コピーして貼り付け、実行（Run）する
   - `transactions` `categories` `category_rules` `cards` `budgets` テーブルと、月次集計ビュー、Row Level Securityの設定が一括で作られます
5. 左メニューの **Project Settings → API** を開き、以下をメモする:
   - `Project URL` → 後で `SUPABASE_URL` と `NEXT_PUBLIC_SUPABASE_URL` に使う
   - `anon public` キー → `NEXT_PUBLIC_SUPABASE_ANON_KEY` に使う
   - `service_role` キー → `SUPABASE_SERVICE_ROLE_KEY` に使う（**絶対に公開しない・フロントに渡さない**）

---

## 2. Google Cloud（Gmail API用のOAuthクライアント）

1. https://console.cloud.google.com にアクセスし、新しいプロジェクトを作成（例: `kakeibo-app`）
2. 左メニュー「APIとサービス → ライブラリ」で **Gmail API** を検索し、有効化する
3. 「APIとサービス → OAuth同意画面」を設定する
   - User Type: **外部** を選択
   - アプリ名・サポートメール・デベロッパー連絡先など必須項目を入力
   - スコープの追加は不要（あとでコード側で `gmail.readonly` を指定します）
   - テストユーザーに自分のGmailアドレスを追加
   - 「公開ステータス」は **テスト中** のままでOK（個人利用のみなので審査は不要）
4. 「APIとサービス → 認証情報 → 認証情報を作成 → OAuthクライアントID」
   - アプリケーションの種類: **デスクトップアプリ**
   - 作成後に表示される **クライアントID** と **クライアントシークレット** をメモする

---

## 3. Gmail のrefresh tokenを取得する（ローカルで1回だけ）

このリポジトリを自分のPCにcloneし、依存関係をインストールした状態で実行します。

```bash
npm install
GMAIL_CLIENT_ID="（手順2のクライアントID）" \
GMAIL_CLIENT_SECRET="（手順2のクライアントシークレット）" \
npm run mint-token
```

1. ターミナルに表示されたURLをブラウザで開く
2. 自分のGoogleアカウントでログインし、許可する（「このアプリは確認されていません」という警告が出た場合は「詳細設定 → 移動」で進めてOK。自分だけが使うテスト中アプリのためです）
3. 許可すると自動的にターミナルに `refresh_token` が表示されるので、コピーして控えておく（このスクリプトはトークンをファイルに保存しません）

---

## 4. GitHub（リポジトリとSecrets）

1. GitHub上に新しいリポジトリを作成（Private推奨）
2. このプロジェクトをpushする
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin <あなたのリポジトリURL>
   git push -u origin main
   ```
3. リポジトリの **Settings → Secrets and variables → Actions → New repository secret** で以下を1つずつ登録する:
   | Secret名 | 値 |
   |---|---|
   | `GMAIL_CLIENT_ID` | 手順2のクライアントID |
   | `GMAIL_CLIENT_SECRET` | 手順2のクライアントシークレット |
   | `GMAIL_REFRESH_TOKEN` | 手順3で取得したrefresh token |
   | `SUPABASE_URL` | 手順1のProject URL |
   | `SUPABASE_SERVICE_ROLE_KEY` | 手順1のservice_roleキー |
4. リポジトリの **Actions** タブを開き、「Fetch Vpass Emails」ワークフローを選択して **Run workflow** で手動実行してみる
5. 成功したら、Supabaseの `transactions` テーブルに実際の取引データが入っていることを確認する（Supabaseの Table Editor で見られます）

以降は1時間毎に自動実行されます（`.github/workflows/fetch-emails.yml` の cron設定）。

---

## 5. Vercel（Webサイトの公開）

1. https://vercel.com にアクセスし、GitHubアカウントでサインアップ
2. 「Add New → Project」で、手順4で作ったGitHubリポジトリをインポートする
3. **Environment Variables** に以下を追加する:
   | 変数名 | 値 |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | 手順1のProject URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 手順1のanon publicキー |
4. Deployをクリックしてデプロイする
5. デプロイ後、プロジェクトの **Settings → Deployment Protection** を開き、パスワード保護を有効にする（無料プランでの提供状況は表示される案内に従ってください）
   - パスワードを設定しておけば、URLを知らない・パスワードを知らない第三者はアクセスできません

デプロイされたURLをスマホのブラウザで開けば、パスワード入力後にダッシュボードが見られます。ホーム画面に追加すればアプリのように使えます。

---

## セキュリティについて（正直な説明）

- フロントエンドが使う `anon` キーは、仕様上ビルド後のJavaScriptに含まれます。ただしSupabase側のRow Level Securityで **SELECT（閲覧）のみ** 許可し、書き込み・削除はできない設定にしてあります。万一キーが第三者に知られても、データを見られるだけで改ざん・削除はされません。
- 「ログイン不要」にする代わりに、Vercelのデプロイ保護（パスワード）でアクセス自体をブロックしています。本格的なユーザー認証ではありませんが、個人の家計簿用途としては十分な保護レベルです。

---

## うまくいかないときは

- **GitHub Actionsが失敗する**: Actionsタブのログを確認。Secretsのスペルミス・refresh tokenの期限切れ（OAuth同意画面でテストユーザーを外した場合など）が多い原因です。
- **メールが取り込まれない**: 送信元が `statement@vpass.ne.jp` であることを確認。カードの種類によって通知文言が変わる場合は `ingest/parsers/smbc-vpass.ts` の正規表現の調整が必要です。
- **カテゴリが「未分類」ばかりになる**: Supabaseの `category_rules` テーブルにキーワードを追加してください（コード変更・再デプロイ不要、次回の取り込みから反映されます）。
