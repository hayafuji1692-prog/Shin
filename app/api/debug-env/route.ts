import { NextResponse } from "next/server";

export async function GET() {
  const keys = Object.keys(process.env).filter((k) => k.includes("SUPABASE"));
  const info = keys.map((k) => ({
    key: JSON.stringify(k),
    length: process.env[k]?.length ?? 0,
    hasValue: !!process.env[k],
  }));
  return NextResponse.json({ keys: info });
}
