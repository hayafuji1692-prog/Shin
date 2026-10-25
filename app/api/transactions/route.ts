import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
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

  // ダッシュボード等は高速化のため一定時間キャッシュしているので、編集したらすぐ最新が出るよう破棄する
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true });
}

// 取引の表示名を変更する（「Visa加盟店」など、メールの店名が分かりにくい場合用）。
// merchant_normalized は元の店名のまま残す。後から届く返品・取消メールとの突き合わせは
// こちらを使うため、表示名を変えても紐づけが外れない。
export async function PATCH(request: Request) {
  const body = await request.json();

  if (!isAuthorized(body.secret)) {
    return NextResponse.json({ error: "合言葉が違います" }, { status: 401 });
  }

  const id = String(body.id ?? "");
  const merchantRaw = String(body.merchantRaw ?? "").trim();
  if (!id || !merchantRaw) {
    return NextResponse.json({ error: "idと新しい名前は必須です" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("transactions").update({ merchant_raw: merchantRaw }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // ダッシュボード等は高速化のため一定時間キャッシュしているので、編集したらすぐ最新が出るよう破棄する
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true });
}

// 取引を一覧・集計から消す。行そのものは削除せず is_cancelled を立てるだけにする。
// 行を削除すると gmail_message_id による重複防止が効かなくなり、同じメールが次の取り込みで
// 再登録されて復活してしまうため。
export async function DELETE(request: Request) {
  const body = await request.json();

  if (!isAuthorized(body.secret)) {
    return NextResponse.json({ error: "合言葉が違います" }, { status: 401 });
  }

  const id = String(body.id ?? "");
  if (!id) {
    return NextResponse.json({ error: "idは必須です" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("transactions").update({ is_cancelled: true }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true });
}
