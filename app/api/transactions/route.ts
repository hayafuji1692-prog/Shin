import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

function isAuthorized(secret: unknown): boolean {
  const expected = process.env.ADMIN_SECRET;
  return typeof expected === "string" && expected.length > 0 && secret === expected;
}

// 現金払いなど、カード通知メールが来ない支出を手動で追加する。
// gmail_message_id はメール取り込みの重複防止キーだが、手動分には対応するメールが
// ないため "manual:<uuid>" という一意な値をその場で発行して代用する。
export async function POST(request: Request) {
  const body = await request.json();

  if (!isAuthorized(body.secret)) {
    return NextResponse.json({ error: "合言葉が違います" }, { status: 401 });
  }

  const { transactionDate, merchantRaw, amount, categoryId } = body;
  const merchant = String(merchantRaw ?? "").trim();
  const amountNumber = Number(amount);

  if (!transactionDate || !merchant || !categoryId || !Number.isFinite(amountNumber) || amountNumber <= 0) {
    return NextResponse.json({ error: "日付・内容・金額・カテゴリはすべて必須です" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("transactions").insert({
    gmail_message_id: `manual:${randomUUID()}`,
    transaction_date: transactionDate,
    merchant_raw: merchant,
    merchant_normalized: merchant.trim().toLowerCase(),
    amount: amountNumber,
    category_id: categoryId,
    source_issuer: "manual",
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
