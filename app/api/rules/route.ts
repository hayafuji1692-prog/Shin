import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

function isAuthorized(secret: unknown): boolean {
  const expected = process.env.ADMIN_SECRET;
  return typeof expected === "string" && expected.length > 0 && secret === expected;
}

export async function POST(request: Request) {
  const body = await request.json();

  if (!isAuthorized(body.secret)) {
    return NextResponse.json({ error: "合言葉が違います" }, { status: 401 });
  }

  const rules = Array.isArray(body.rules) ? body.rules : [body];

  const rows = rules.map((rule: { keyword?: unknown; categoryId?: unknown; priority?: unknown }) => ({
    keyword: String(rule.keyword ?? "").trim(),
    category_id: rule.categoryId,
    priority: typeof rule.priority === "number" ? rule.priority : 1,
  }));

  if (rows.some((row: { keyword: string; category_id: unknown }) => !row.keyword || !row.category_id)) {
    return NextResponse.json({ error: "keywordとcategoryIdは必須です" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("category_rules").insert(rows);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, count: rows.length });
}

export async function DELETE(request: Request) {
  const body = await request.json();

  if (!isAuthorized(body.secret)) {
    return NextResponse.json({ error: "合言葉が違います" }, { status: 401 });
  }
  if (!body.id) {
    return NextResponse.json({ error: "idは必須です" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("category_rules").delete().eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
