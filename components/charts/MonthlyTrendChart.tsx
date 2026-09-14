"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatYen } from "@/lib/date";

export type MonthlyPoint = {
  label: string; // "9月" のような短い表示
  total: number;
};

export function MonthlyTrendChart({ data }: { data: MonthlyPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <XAxis dataKey="label" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
        <YAxis hide />
        <Tooltip formatter={(value) => formatYen(Number(value))} />
        {/* react-smoothのアニメーションが一部環境でrequestAnimationFrameと噛み合わず
            バーが一切描画されないことがあるため無効化している */}
        <Bar dataKey="total" fill="#2f6f4f" radius={[6, 6, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}
