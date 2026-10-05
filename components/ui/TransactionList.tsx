"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatYen } from "@/lib/date";
import type { Category, Transaction } from "@/lib/types";

const SECRET_STORAGE_KEY = "kakeibo_admin_secret";

type Patch = Partial<Pick<Transaction, "merchant_raw" | "category_id">>;

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
  const [errorMessage, setErrorMessage] = useState("");
  const [overlay, setOverlay] = useState<{ base: Transaction[]; patches: Record<string, Patch> }>({
    base: transactions,
    patches: {},
  });
  const patches = overlay.base === transactions ? overlay.patches : {};
  const rows = transactions.map((tx) => (patches[tx.id] ? { ...tx, ...patches[tx.id] } : tx));

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

  // 保存の通信と画面データの再取得で2秒前後かかり、押しても画面が変わらず重く感じるため、
  // 変更はまず画面に即反映し、通信は裏で行う。失敗したら元に戻してエラーを出す。
  // 再取得でtransactionsの中身が新しくなると、仮の変更(patches)は自動的に捨てられる。
  function applyPatch(id: string, patch: Patch) {
    setOverlay((prev) => {
      const current = prev.base === transactions ? prev.patches : {};
      return { base: transactions, patches: { ...current, [id]: { ...current[id], ...patch } } };
    });
  }

  function revertPatch(id: string, keys: (keyof Patch)[]) {
    setOverlay((prev) => {
      if (prev.base !== transactions) return prev;
      const next = { ...prev.patches[id] };
      for (const key of keys) delete next[key];
      return { base: transactions, patches: { ...prev.patches, [id]: next } };
    });
  }

  async function saveOptimistically(
    id: string,
    patch: Patch,
    request: { url: string; method: string; body: object },
    failMessage: string
  ) {
    setErrorMessage("");
    applyPatch(id, patch);
    try {
      const res = await fetch(request.url, {
        method: request.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...request.body, secret }),
      });
      if (!res.ok) {
        revertPatch(id, Object.keys(patch) as (keyof Patch)[]);
        const data = await res.json();
        if (res.status === 401) {
          setErrorMessage("合言葉が違います。もう一度ロック解除してください");
          lock();
        } else {
          setErrorMessage(data.error ?? failMessage);
        }
        return;
      }
      router.refresh();
    } catch {
      revertPatch(id, Object.keys(patch) as (keyof Patch)[]);
      setErrorMessage("通信に失敗しました");
    }
  }

  function handleCategoryChange(transactionId: string, categoryId: string) {
    return saveOptimistically(
      transactionId,
      { category_id: categoryId },
      { url: "/api/transactions/categorize", method: "POST", body: { transactionId, categoryId } },
      "更新に失敗しました"
    );
  }

  function handleRename(transactionId: string) {
    const merchantRaw = editingName.trim();
    if (!merchantRaw) return;

    setEditingNameId(null);
    return saveOptimistically(
      transactionId,
      { merchant_raw: merchantRaw },
      { url: "/api/transactions", method: "PATCH", body: { id: transactionId, merchantRaw } },
      "名前の変更に失敗しました"
    );
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
        {rows.map((tx) => (
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
                  <button className="btn-primary" onClick={() => handleRename(tx.id)}>
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
