import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

function isAuthorized(secret: unknown): boolean {
  const expected = process.env.ADMIN_SECRET;
  return typeof expected === "string" && expected.length > 0 && secret === expected;
}

// 新しいカテゴリを追加する。表示順は「未分類」(999)の手前に入るよう自動採番する。
export async function POST(request: Request) {
  const body = await request.json();

  if (!isAuthorized(body.secret)) {
    return NextResponse.json({ error: "合言葉が違います" }, { status: 401 });
  }

  const name = String(body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "カテゴリ名は必須です" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: existing, error: fetchError } = await supabase
    .from("categories")
    .select("sort_order")
    .lt("sort_order", 999)
    .order("sort_order", { ascending: false })
    .limit(1);
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });

  const nextSortOrder = (existing?.[0]?.sort_order ?? 0) + 1;

  const { error: insertError } = await supabase.from("categories").insert({ name, sort_order: nextSortOrder });
  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json({ error: "同じ名前のカテゴリが既にあります" }, { status: 409 });
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// カテゴリ名を変更する。過去の取引・ルールはcategory_idで紐づいているので、
// 名前だけ変えれば見た目もそのまま追従する。
export async function PATCH(request: Request) {
  const body = await request.json();

  if (!isAuthorized(body.secret)) {
    return NextResponse.json({ error: "合言葉が違います" }, { status: 401 });
  }

  const id = String(body.id ?? "");
  const name = String(body.name ?? "").trim();
  if (!id || !name) {
    return NextResponse.json({ error: "idと新しい名前は必須です" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("categories").update({ name }).eq("id", id);
  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "同じ名前のカテゴリが既にあります" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
