import { createClient } from "@supabase/supabase-js";

// service role key を使う管理者クライアント。
// RLSを無視して書き込みできるため、GitHub Actionsの取り込みジョブ (ingest/) からのみ使用する。
// app/ や components/ からは絶対にimportしないこと（ブラウザにキーが漏れる）。
export function createAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が設定されていません。GitHub Actions Secretsを確認してください。"
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}
