import { NextResponse } from "next/server";
import { getCategories, getCategoryRules } from "@/lib/queries";

export async function GET() {
  const keys = Object.keys(process.env).filter((k) => k.includes("SUPABASE"));
  const envInfo = keys.map((k) => ({
    key: JSON.stringify(k),
    length: process.env[k]?.length ?? 0,
    hasValue: !!process.env[k],
  }));

  let categoriesResult: unknown = null;
  let categoriesError: string | null = null;
  try {
    categoriesResult = await getCategories();
  } catch (e) {
    categoriesError = e instanceof Error ? e.message : String(e);
  }

  let rulesResult: unknown = null;
  let rulesError: string | null = null;
  try {
    rulesResult = await getCategoryRules();
  } catch (e) {
    rulesError = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json({
    env: envInfo,
    categoriesCount: Array.isArray(categoriesResult) ? categoriesResult.length : null,
    categoriesError,
    rulesCount: Array.isArray(rulesResult) ? rulesResult.length : null,
    rulesError,
  });
}
