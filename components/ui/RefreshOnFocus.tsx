"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// ホーム画面に追加したアプリは、バックグラウンドから戻っても前回の画面のまま
// 再読み込みされないことがある。画面に戻ってきた時に最新データへ更新する。
export function RefreshOnFocus() {
  const router = useRouter();

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") router.refresh();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [router]);

  return null;
}
