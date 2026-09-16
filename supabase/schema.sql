-- kakeibo-app: Supabase schema
-- SupabaseダッシュボードのSQL Editorにこのファイルの内容をそのまま貼り付けて実行してください。

create extension if not exists pgcrypto;

-- ── cards ──────────────────────────────────────────────
create table cards (
  id         uuid primary key default gen_random_uuid(),
  issuer     text not null,              -- 'smbc', 'rakuten', ...
  name       text not null,              -- 'Olive ゴールド／クレジット' など表示名
  created_at timestamptz not null default now()
);

-- ── categories ─────────────────────────────────────────
create table categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ── category_rules ─────────────────────────────────────
-- キーワード→カテゴリのマッピング。Supabaseのテーブルエディタから直接編集可能。
create table category_rules (
  id          uuid primary key default gen_random_uuid(),
  keyword     text not null,             -- merchant_normalized への部分一致（小文字化して比較）
  category_id uuid not null references categories(id) on delete cascade,
  priority    int not null default 0,    -- 複数マッチ時は数値が大きい方を優先
  created_at  timestamptz not null default now()
);
create index idx_category_rules_keyword on category_rules (keyword);

-- ── transactions ───────────────────────────────────────
create table transactions (
  id                  uuid primary key default gen_random_uuid(),
  gmail_message_id    text not null unique,     -- 取り込みジョブの冪等性キー
  card_id             uuid references cards(id),
  transaction_date    timestamptz not null,     -- 利用日時
  merchant_raw        text not null,
  merchant_normalized text not null,
  amount              numeric(12, 2) not null,
  category_id         uuid references categories(id),
  source_issuer       text not null default 'smbc',
  is_cancelled        boolean not null default false, -- 「取消」通知が来た元取引。行はdeleteせず論理的に無効化する
  created_at          timestamptz not null default now()
);
create index idx_transactions_date on transactions (transaction_date);
create index idx_transactions_category on transactions (category_id);

-- ── budgets（将来の予算管理機能用。v1では未使用だがスキーマを先に用意）──
create table budgets (
  id            uuid primary key default gen_random_uuid(),
  category_id   uuid references categories(id),
  month         date not null,           -- 月初日として保存 (例: 2026-09-01)
  target_amount numeric(12, 2) not null,
  created_at    timestamptz not null default now(),
  unique (category_id, month)
);

-- ── recurring_transactions ──────────────────────────────
-- カード決済されない定期支出（銀行振替の積立投資など）。取り込みジョブが
-- 毎月day_of_month以降に1回だけ、対応するtransactionsの行を自動生成する。
create table recurring_transactions (
  id            uuid primary key default gen_random_uuid(),
  label         text not null,             -- '株式積立' など表示名
  amount        numeric(12, 2) not null,
  category_id   uuid references categories(id),
  day_of_month  int not null check (day_of_month between 1 and 28),
  created_at    timestamptz not null default now()
);

-- ── 初期カテゴリ ─────────────────────────────────────────
-- シンプルな構成: 株(投資)・交通費・コンビニ・スーパー(食費/外食/日用品を統合)・未分類
insert into categories (name, sort_order) values
  ('株', 1),
  ('交通費', 2),
  ('コンビニ', 3),
  ('スーパー', 4),
  ('未分類', 999);

-- ── サンプルの分類ルール（あとから自由に追加・編集してください）──
-- 食費・外食・日用品まわりの店は全部「スーパー」に寄せている
insert into category_rules (keyword, category_id, priority)
select keyword, categories.id, priority
from (values
  -- 実メールでは「セブン－イレブン」の中点が全角ダッシュ等で表記ゆれするため、
  -- ダッシュを含まない「セブン」だけで拾う
  ('セブン', 'コンビニ', 1),
  ('ファミリーマート', 'コンビニ', 1),
  ('ローソン', 'コンビニ', 1),
  ('スターバックス', 'スーパー', 1),
  ('matsuya', 'スーパー', 1),
  -- 有名飲食チェーン・小売（新しく利用しても自動で「スーパー」に分類されるよう先回りで登録）
  ('マクドナルド', 'スーパー', 1), ('mcdonald', 'スーパー', 1),
  ('モスバーガー', 'スーパー', 1), ('mosburger', 'スーパー', 1),
  ('ケンタッキー', 'スーパー', 1), ('kfc', 'スーパー', 1),
  ('バーガーキング', 'スーパー', 1), ('burger king', 'スーパー', 1),
  ('吉野家', 'スーパー', 1), ('yoshinoya', 'スーパー', 1),
  ('すき家', 'スーパー', 1), ('sukiya', 'スーパー', 1),
  ('なか卯', 'スーパー', 1), ('nakau', 'スーパー', 1),
  ('松屋', 'スーパー', 1),
  ('やよい軒', 'スーパー', 1), ('yayoiken', 'スーパー', 1),
  ('リンガーハット', 'スーパー', 1), ('ringerhut', 'スーパー', 1),
  ('丸亀製麺', 'スーパー', 1), ('marugame', 'スーパー', 1),
  ('スシロー', 'スーパー', 1), ('sushiro', 'スーパー', 1),
  ('くら寿司', 'スーパー', 1), ('kurazushi', 'スーパー', 1),
  ('はま寿司', 'スーパー', 1), ('hamazushi', 'スーパー', 1),
  ('ガスト', 'スーパー', 1), ('gusto', 'スーパー', 1),
  ('サイゼリヤ', 'スーパー', 1), ('saizeriya', 'スーパー', 1),
  ('デニーズ', 'スーパー', 1), ('dennys', 'スーパー', 1),
  ('ロイヤルホスト', 'スーパー', 1), ('royalhost', 'スーパー', 1),
  ('ドトール', 'スーパー', 1), ('doutor', 'スーパー', 1),
  ('タリーズ', 'スーパー', 1), ('tullys', 'スーパー', 1),
  ('コメダ', 'スーパー', 1), ('komeda', 'スーパー', 1),
  ('大戸屋', 'スーパー', 1), ('ootoya', 'スーパー', 1),
  ('ココイチ', 'スーパー', 1), ('ichibanya', 'スーパー', 1),
  ('王将', 'スーパー', 1), ('ohsho', 'スーパー', 1),
  ('てんや', 'スーパー', 1), ('tenya', 'スーパー', 1),
  ('ミスタードーナツ', 'スーパー', 1), ('misdo', 'スーパー', 1),
  ('サブウェイ', 'スーパー', 1), ('subway', 'スーパー', 1),
  ('ピザハット', 'スーパー', 1), ('pizzahut', 'スーパー', 1),
  ('ドミノ', 'スーパー', 1), ('dominos', 'スーパー', 1),
  ('ピザーラ', 'スーパー', 1), ('pizzala', 'スーパー', 1),
  ('一風堂', 'スーパー', 1), ('ippudo', 'スーパー', 1),
  ('幸楽苑', 'スーパー', 1), ('kourakuen', 'スーパー', 1),
  ('日高屋', 'スーパー', 1), ('hidakaya', 'スーパー', 1),
  ('マツモトキヨシ', 'スーパー', 1),
  ('drug', 'スーパー', 1),
  ('icoca', '交通費', 1),
  ('ｉｃｏｃａ', '交通費', 1),
  ('jr', '交通費', 1),
  ('amazon', 'スーパー', 0)
) as seed(keyword, category_name, priority)
join categories on categories.name = seed.category_name;

-- ── 月次集計ビュー（将来の予算対比にも流用）──
-- transaction_date は timestamptz で保存されているため、月の区切りは日本時間(Asia/Tokyo)基準にする。
create view monthly_category_totals as
select
  date_trunc('month', transaction_date at time zone 'Asia/Tokyo')::date as month,
  category_id,
  sum(amount) as total
from transactions
where not is_cancelled
group by 1, 2;

-- ── Row Level Security ──────────────────────────────────
alter table cards enable row level security;
alter table categories enable row level security;
alter table category_rules enable row level security;
alter table transactions enable row level security;
alter table budgets enable row level security;
alter table recurring_transactions enable row level security;

-- anon(フロントエンド)キーは読み取り専用。insert/update/delete用のポリシーは作らないため、
-- anonキーからの書き込みは自動的に拒否される。
-- GitHub Actionsの取り込みジョブはRLSを無視できるservice role keyを使う。
create policy "anon can read cards"                 on cards                  for select using (true);
create policy "anon can read categories"            on categories             for select using (true);
create policy "anon can read category_rules"        on category_rules         for select using (true);
create policy "anon can read transactions"          on transactions           for select using (true);
create policy "anon can read budgets"               on budgets                for select using (true);
create policy "anon can read recurring_transactions" on recurring_transactions for select using (true);

-- ── テーブルレベルの権限付与 ────────────────────────────
-- RLSポリシーだけでは不十分で、Postgresのテーブル権限自体もanon/service_roleに
-- 付与されている必要がある。
grant usage on schema public to anon, service_role;
grant select on all tables in schema public to anon;
grant select, insert, update, delete on all tables in schema public to service_role;
