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

// カテゴリを削除する。そのカテゴリが付いていた取引はすべて「未分類」に付け替えてから
// 削除する（取引データ自体は失われない）。紐づく分類ルールはDBのon delete cascadeで
// 自動的に削除される。
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

  const { data: uncategorized, error: uncategorizedError } = await supabase
    .from("categories")
    .select("id")
    .eq("name", "未分類")
    .maybeSingle();
  if (uncategorizedError) return NextResponse.json({ error: uncategorizedError.message }, { status: 500 });
  if (!uncategorized) return NextResponse.json({ error: "未分類カテゴリが見つかりません" }, { status: 500 });

  if (id === uncategorized.id) {
    return NextResponse.json({ error: "「未分類」は削除できません" }, { status: 400 });
  }

  const { error: reassignError } = await supabase
    .from("transactions")
    .update({ category_id: uncategorized.id })
    .eq("category_id", id);
  if (reassignError) return NextResponse.json({ error: reassignError.message }, { status: 500 });

  const { error: deleteError } = await supabase.from("categories").delete().eq("id", id);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
