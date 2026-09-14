"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatYen } from "@/lib/date";

export type CategorySlice = {
  name: string;
  value: number;
};

export const CATEGORY_COLORS = [
  "#2f6f4f",
  "#5b8c5a",
  "#8aa86e",
  "#c9a24b",
  "#b3452c",
  "#7a6fb0",
  "#4a7fa6",
  "#a65d7a",
  "#9a9a9a",
];

export function CategoryPieChart({ data }: { data: CategorySlice[] }) {
  if (data.length === 0) {
    return <p className="empty-state">この月の取引データがありません</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
          // react-smoothのアニメーションが一部環境でrequestAnimationFrameと噛み合わず
          // セクターが一切描画されないことがあるため無効化している
          isAnimationActive={false}
        >
          {data.map((entry, index) => (
            <Cell key={entry.name} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(value) => formatYen(Number(value))} />
      </PieChart>
    </ResponsiveContainer>
  );
}
