"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Category, CategoryRule } from "@/lib/types";

const SECRET_STORAGE_KEY = "kakeibo_admin_secret";

type ParsedBulkRule = { keyword: string; categoryId: string; categoryName: string };
type BulkError = { line: string; reason: string };

export function RulesManager({
  categories,
  initialRules,
}: {
  categories: Category[];
  initialRules: CategoryRule[];
}) {
  const router = useRouter();
  const [secret, setSecret] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [secretInput, setSecretInput] = useState("");

  const [keyword, setKeyword] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [bulkText, setBulkText] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");

  const [errorMessage, setErrorMessage] = useState("");
  const [bulkErrors, setBulkErrors] = useState<BulkError[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));

  useEffect(() => {
    // localStorageはSSR時に存在しないため、マウント後の一度限りの読み込みとして扱う
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

  async function submitRules(rules: { keyword: string; categoryId: string }[]) {
    setIsSubmitting(true);
    setErrorMessage("");
    try {
      const res = await fetch("/api/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules, secret }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          setErrorMessage("合言葉が違います。もう一度ロック解除してください");
          lock();
        } else {
          setErrorMessage(data.error ?? "登録に失敗しました");
        }
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setErrorMessage("通信に失敗しました");
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSingleAdd() {
    if (!keyword.trim() || !categoryId) return;
    const ok = await submitRules([{ keyword: keyword.trim(), categoryId }]);
    if (ok) setKeyword("");
  }

  async function handleBulkAdd() {
    const lines = bulkText.split("\n").map((l) => l.trim()).filter(Boolean);
    const parsed: ParsedBulkRule[] = [];
    const errors: BulkError[] = [];

    for (const line of lines) {
      const [rawKeyword, rawCategory] = line.split(",").map((s) => s?.trim());
      if (!rawKeyword || !rawCategory) {
        errors.push({ line, reason: "「キーワード,カテゴリ名」の形式ではありません" });
        continue;
      }
      const category = categories.find((c) => c.name === rawCategory);
      if (!category) {
        errors.push({ line, reason: `カテゴリ「${rawCategory}」が見つかりません` });
        continue;
      }
      parsed.push({ keyword: rawKeyword, categoryId: category.id, categoryName: category.name });
    }

    setBulkErrors(errors);
    if (parsed.length === 0) return;

    const ok = await submitRules(parsed.map(({ keyword, categoryId }) => ({ keyword, categoryId })));
    if (ok) setBulkText(errors.map((e) => e.line).join("\n"));
  }

  async function handleAddCategory() {
    if (!newCategoryName.trim()) return;
    setIsSubmitting(true);
    setErrorMessage("");
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCategoryName.trim(), secret }),
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
      setNewCategoryName("");
      router.refresh();
    } catch {
      setErrorMessage("通信に失敗しました");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    setErrorMessage("");
    try {
      const res = await fetch("/api/rules", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, secret }),
      });
      if (!res.ok) {
        const data = await res.json();
        if (res.status === 401) {
          setErrorMessage("合言葉が違います。もう一度ロック解除してください");
          lock();
        } else {
          setErrorMessage(data.error ?? "削除に失敗しました");
        }
        return;
      }
      router.refresh();
    } catch {
      setErrorMessage("通信に失敗しました");
    }
  }

  if (!unlocked) {
    return (
      <div className="card">
        <p className="summary-label" style={{ marginBottom: 12 }}>
          この画面はデータを追加・削除できるため、合言葉が必要です
        </p>
        <div className="filter-row">
          <input
            type="password"
            className="admin-input"
            placeholder="合言葉"
            value={secretInput}
            onChange={(e) => setSecretInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && unlock()}
          />
          <button className="btn-primary" onClick={unlock}>
            解除
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 className="section-title" style={{ margin: 0 }}>
            カテゴリを追加
          </h2>
          <button className="btn-text" onClick={lock}>
            ロック
          </button>
        </div>
        <div className="filter-row">
          <input
            className="admin-input"
            placeholder="新しいカテゴリ名（例: 日用品）"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddCategory()}
          />
          <button className="btn-primary" disabled={isSubmitting} onClick={handleAddCategory}>
            追加
          </button>
        </div>
      </div>

      <div className="card">
        <h2 className="section-title">まとめて登録</h2>
        <p className="transaction-meta" style={{ marginBottom: 8 }}>
          1行に「キーワード,カテゴリ名」の形式で複数行まとめて貼り付けられます
        </p>
        <textarea
          className="admin-textarea"
          rows={5}
          placeholder={"イオン,スーパー\nセブン-イレブン,コンビニ"}
          value={bulkText}
          onChange={(e) => setBulkText(e.target.value)}
        />
        <button className="btn-primary" style={{ marginTop: 8 }} disabled={isSubmitting} onClick={handleBulkAdd}>
          まとめて登録
        </button>
        {bulkErrors.length > 0 && (
          <ul className="admin-error-list">
            {bulkErrors.map((e, i) => (
              <li key={i}>
                {e.line}: {e.reason}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <h2 className="section-title">1件ずつ登録</h2>
        <div className="filter-row">
          <input
            className="admin-input"
            placeholder="キーワード（店名など）"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <button className="btn-primary" disabled={isSubmitting} onClick={handleSingleAdd}>
          追加
        </button>
      </div>

      {errorMessage && <p className="admin-error">{errorMessage}</p>}

      <div className="card">
        <h2 className="section-title">登録済みルール（{initialRules.length}件）</h2>
        {initialRules.length === 0 ? (
          <p className="empty-state">まだ登録されていません</p>
        ) : (
          <ul className="transaction-list">
            {initialRules.map((rule) => (
              <li key={rule.id} className="transaction-item">
                <div>
                  <div className="transaction-merchant">{rule.keyword}</div>
                  <span className="category-tag">{categoryNameById.get(rule.category_id) ?? "?"}</span>
                </div>
                <button className="btn-text" onClick={() => handleDelete(rule.id)}>
                  削除
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
