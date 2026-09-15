"use client";

import { useRouter } from "next/navigation";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatYen } from "@/lib/date";

export type CategorySlice = {
  id: string | null;
  name: string;
  value: number;
};

// 隣り合うカテゴリでも見分けやすいよう、色相を大きく散らした配色にしている
export const CATEGORY_COLORS = [
  "#4C6EF5", // 青
  "#E8590C", // オレンジ
  "#2F9E44", // 緑
  "#E03131", // 赤
  "#9C36B5", // 紫
  "#F08C00", // 黄橙
  "#1098AD", // 青緑
  "#C2255C", // ピンク
  "#495057", // グレー（未分類など）
];

export function CategoryPieChart({ data, month }: { data: CategorySlice[]; month: string }) {
  const router = useRouter();

  if (data.length === 0) {
    return <p className="empty-state">この月の取引データがありません</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={280 + Math.ceil(data.length / 3) * 24}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={55}
          outerRadius={90}
          paddingAngle={2}
          // react-smoothのアニメーションが一部環境でrequestAnimationFrameと噛み合わず
          // セクターが一切描画されないことがあるため無効化している
          isAnimationActive={false}
          cursor="pointer"
          onClick={(entry: { payload?: CategorySlice }) => {
            const id = entry.payload?.id;
            if (id) router.push(`/transactions?month=${month}&category=${id}`);
          }}
        >
          {data.map((entry, index) => (
            <Cell key={entry.name} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(value) => formatYen(Number(value))} />
        {/* スライスが小さいカテゴリでも文字が重ならず全部読めるよう、
            スライス上のラベルではなく凡例で全カテゴリ名を表示する */}
        <Legend
          verticalAlign="bottom"
          height={Math.ceil(data.length / 3) * 24}
          wrapperStyle={{ fontSize: 12, lineHeight: "20px" }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
