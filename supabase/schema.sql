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

-- ── 初期カテゴリ ─────────────────────────────────────────
insert into categories (name, sort_order) values
  ('食費', 1),
  ('外食', 2),
  ('コンビニ', 3),
  ('日用品', 4),
  ('交通費', 5),
  ('光熱費', 6),
  ('通信費', 7),
  ('娯楽', 8),
  ('医療', 9),
  ('未分類', 999);

-- ── サンプルの分類ルール（あとから自由に追加・編集してください）──
insert into category_rules (keyword, category_id, priority)
select keyword, categories.id, priority
from (values
  ('セブン-イレブン', 'コンビニ', 1),
  ('セブンイレブン', 'コンビニ', 1),
  ('ファミリーマート', 'コンビニ', 1),
  ('ローソン', 'コンビニ', 1),
  ('スターバックス', '外食', 1),
  ('matsuya', '外食', 1),
  ('マツモトキヨシ', '日用品', 1),
  ('drug', '日用品', 1),
  ('icoca', '交通費', 1),
  ('ｉｃｏｃａ', '交通費', 1),
  ('jr', '交通費', 1),
  ('amazon', '日用品', 0)
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
group by 1, 2;

-- ── Row Level Security ──────────────────────────────────
alter table cards enable row level security;
alter table categories enable row level security;
alter table category_rules enable row level security;
alter table transactions enable row level security;
alter table budgets enable row level security;

-- anon(フロントエンド)キーは読み取り専用。insert/update/delete用のポリシーは作らないため、
-- anonキーからの書き込みは自動的に拒否される。
-- GitHub Actionsの取り込みジョブはRLSを無視できるservice role keyを使う。
create policy "anon can read cards"          on cards          for select using (true);
create policy "anon can read categories"     on categories     for select using (true);
create policy "anon can read category_rules" on category_rules for select using (true);
create policy "anon can read transactions"   on transactions   for select using (true);
create policy "anon can read budgets"        on budgets        for select using (true);

-- ── テーブルレベルの権限付与 ────────────────────────────
-- RLSポリシーだけでは不十分で、Postgresのテーブル権限自体もanon/service_roleに
-- 付与されている必要がある。
grant usage on schema public to anon, service_role;
grant select on all tables in schema public to anon;
grant select, insert, update, delete on all tables in schema public to service_role;
