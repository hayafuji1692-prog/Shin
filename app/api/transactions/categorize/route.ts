import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

function isAuthorized(secret: unknown): boolean {
  const expected = process.env.ADMIN_SECRET;
  return typeof expected === "string" && expected.length > 0 && secret === expected;
}

// 取引を手動で分類したら、同じ店名の今後の取引も自動で同じカテゴリになるよう
// category_rules に1件反映する（すでに同じキーワードのルールがあれば上書き）。
export async function POST(request: Request) {
  const body = await request.json();

  if (!isAuthorized(body.secret)) {
    return NextResponse.json({ error: "合言葉が違います" }, { status: 401 });
  }

  const { transactionId, categoryId } = body;
  if (!transactionId || !categoryId) {
    return NextResponse.json({ error: "transactionIdとcategoryIdは必須です" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: tx, error: fetchError } = await supabase
    .from("transactions")
    .select("merchant_normalized")
    .eq("id", transactionId)
    .maybeSingle();
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!tx) return NextResponse.json({ error: "取引が見つかりません" }, { status: 404 });

  const { error: updateError } = await supabase
    .from("transactions")
    .update({ category_id: categoryId })
    .eq("id", transactionId);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  const { data: existingRule, error: findRuleError } = await supabase
    .from("category_rules")
    .select("id")
    .eq("keyword", tx.merchant_normalized)
    .maybeSingle();
  if (findRuleError) return NextResponse.json({ error: findRuleError.message }, { status: 500 });

  const ruleError = existingRule
    ? (await supabase.from("category_rules").update({ category_id: categoryId }).eq("id", existingRule.id)).error
    : (await supabase
        .from("category_rules")
        .insert({ keyword: tx.merchant_normalized, category_id: categoryId, priority: 1 })).error;
  if (ruleError) return NextResponse.json({ error: ruleError.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
