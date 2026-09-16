"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatYen } from "@/lib/date";
import type { Category, Transaction } from "@/lib/types";

const SECRET_STORAGE_KEY = "kakeibo_admin_secret";

export function TransactionList({
  transactions,
  categories,
}: {
  transactions: Transaction[];
  categories: Category[];
}) {
  const router = useRouter();
  const [secret, setSecret] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [secretInput, setSecretInput] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));

  useEffect(() => {
    const stored = localStorage.getItem(SECRET_STORAGE_KEY);
    if (stored) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSecret(stored);
      setUnlocked(true);
    }
  }, []);

  function unlock() {
    if (!secretInput.trim()) return;
    localStorage.setItem(SECRET_STORAGE_KEY, secretInput.trim());
    setSecret(secretInput.trim());
    setUnlocked(true);
  }

  function lock() {
    localStorage.removeItem(SECRET_STORAGE_KEY);
    setSecret("");
    setUnlocked(false);
  }

  async function handleCategoryChange(transactionId: string, categoryId: string) {
    setSavingId(transactionId);
    setErrorMessage("");
    try {
      const res = await fetch("/api/transactions/categorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId, categoryId, secret }),
      });
      if (!res.ok) {
        const data = await res.json();
        if (res.status === 401) {
          setErrorMessage("合言葉が違います。もう一度ロック解除してください");
          lock();
        } else {
          setErrorMessage(data.error ?? "更新に失敗しました");
        }
        return;
      }
      router.refresh();
    } catch {
      setErrorMessage("通信に失敗しました");
    } finally {
      setSavingId(null);
    }
  }

  if (transactions.length === 0) {
    return <p className="empty-state">該当する取引がありません</p>;
  }

  return (
    <>
      {unlocked ? (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <p className="transaction-meta" style={{ margin: 0 }}>
            分類を選ぶと、同じ店名の次回以降も自動で同じカテゴリになります
          </p>
          <button className="btn-text" onClick={lock}>
            ロック
          </button>
        </div>
      ) : (
        <div className="filter-row" style={{ marginBottom: 12 }}>
          <input
            type="password"
            className="admin-input"
            placeholder="合言葉（分類を編集する場合）"
            value={secretInput}
            onChange={(e) => setSecretInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && unlock()}
          />
          <button className="btn-primary" onClick={unlock}>
            解除
          </button>
        </div>
      )}
      {errorMessage && <p className="admin-error">{errorMessage}</p>}

      <ul className="transaction-list">
        {transactions.map((tx) => (
          <li key={tx.id} className="transaction-item">
            <div>
              <div className="transaction-merchant">{tx.merchant_raw}</div>
              <div className="transaction-meta">
                {new Date(tx.transaction_date).toLocaleString("ja-JP", {
                  month: "numeric",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
              {unlocked ? (
                <select
                  className="category-select"
                  value={tx.category_id ?? ""}
                  disabled={savingId === tx.id}
                  onChange={(e) => handleCategoryChange(tx.id, e.target.value)}
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              ) : (
                tx.category_id && (
                  <span className="category-tag">{categoryNameById.get(tx.category_id) ?? "未分類"}</span>
                )
              )}
            </div>
            <span className="transaction-amount">{formatYen(tx.amount)}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
