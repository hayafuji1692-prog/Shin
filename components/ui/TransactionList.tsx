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

  const [manualDate, setManualDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [manualMerchant, setManualMerchant] = useState("");
  const [manualAmount, setManualAmount] = useState("");
  const [manualCategoryId, setManualCategoryId] = useState(categories[0]?.id ?? "");
  const [isAddingManual, setIsAddingManual] = useState(false);

  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

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

  async function handleRename(transactionId: string) {
    const merchantRaw = editingName.trim();
    if (!merchantRaw) return;

    setSavingId(transactionId);
    setErrorMessage("");
    try {
      const res = await fetch("/api/transactions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: transactionId, merchantRaw, secret }),
      });
      if (!res.ok) {
        const data = await res.json();
        if (res.status === 401) {
          setErrorMessage("合言葉が違います。もう一度ロック解除してください");
          lock();
        } else {
          setErrorMessage(data.error ?? "名前の変更に失敗しました");
        }
        return;
      }
      setEditingNameId(null);
      router.refresh();
    } catch {
      setErrorMessage("通信に失敗しました");
    } finally {
      setSavingId(null);
    }
  }

  async function handleAddManual() {
    if (!manualDate || !manualMerchant.trim() || !manualCategoryId) return;
    const amountNumber = Number(manualAmount);
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      setErrorMessage("金額は正しい数値で入力してください");
      return;
    }

    setIsAddingManual(true);
    setErrorMessage("");
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionDate: `${manualDate}T12:00:00+09:00`,
          merchantRaw: manualMerchant.trim(),
          amount: amountNumber,
          categoryId: manualCategoryId,
          secret,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          setErrorMessage("合言葉が違います。もう一度ロック解除してください");
          lock();
        } else {
          setErrorMessage(data.error ?? "追加に失敗しました");
        }
        return;
      }
      setManualMerchant("");
      setManualAmount("");
      router.refresh();
    } catch {
      setErrorMessage("通信に失敗しました");
    } finally {
      setIsAddingManual(false);
    }
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
      {unlocked && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h2 className="section-title">現金など手動で追加</h2>
          <div className="filter-row">
            <input
              type="date"
              className="admin-input"
              value={manualDate}
              onChange={(e) => setManualDate(e.target.value)}
            />
            <input
              className="admin-input"
              placeholder="内容（例: ランチ代）"
              value={manualMerchant}
              onChange={(e) => setManualMerchant(e.target.value)}
            />
          </div>
          <div className="filter-row">
            <input
              type="number"
              className="admin-input"
              placeholder="金額"
              value={manualAmount}
              onChange={(e) => setManualAmount(e.target.value)}
            />
            <select value={manualCategoryId} onChange={(e) => setManualCategoryId(e.target.value)}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <button className="btn-primary" disabled={isAddingManual} onClick={handleAddManual}>
            追加
          </button>
        </div>
      )}

      {errorMessage && <p className="admin-error">{errorMessage}</p>}

      {transactions.length === 0 ? (
        <p className="empty-state">該当する取引がありません</p>
      ) : (
      <ul className="transaction-list">
        {transactions.map((tx) => (
          <li key={tx.id} className="transaction-item">
            <div>
              {editingNameId === tx.id ? (
                <div className="filter-row" style={{ marginBottom: 4 }}>
                  <input
                    className="admin-input"
                    autoFocus
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRename(tx.id);
                      if (e.key === "Escape") setEditingNameId(null);
                    }}
                  />
                  <button className="btn-primary" disabled={savingId === tx.id} onClick={() => handleRename(tx.id)}>
                    保存
                  </button>
                  <button className="btn-text" onClick={() => setEditingNameId(null)}>
                    取消
                  </button>
                </div>
              ) : (
                <div className="transaction-merchant">
                  {tx.merchant_raw}
                  {unlocked && (
                    <button
                      className="btn-text"
                      aria-label="名前を編集"
                      onClick={() => {
                        setEditingNameId(tx.id);
                        setEditingName(tx.merchant_raw);
                      }}
                    >
                      ✎
                    </button>
                  )}
                </div>
              )}
              <div className="transaction-meta">
                {new Date(tx.transaction_date).toLocaleString("ja-JP", {
                  timeZone: "Asia/Tokyo",
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
      )}
    </>
  );
}
