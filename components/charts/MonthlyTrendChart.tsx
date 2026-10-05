"use client";

import { useRouter } from "next/navigation";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatYen } from "@/lib/date";

export type MonthlyPoint = {
  month: string; // "2026-09-01" 形式。クリックで開く取引一覧の月指定に使う
  label: string; // "9月" のような短い表示
  total: number;
};

export function MonthlyTrendChart({ data }: { data: MonthlyPoint[] }) {
  const router = useRouter();

  return (
    <div className="clickable-chart">
      <ResponsiveContainer width="100%" height={220}>
        {/* 棒そのものではなく列全体をタップ対象にして、金額が小さい月や0円の月も押せるようにする */}
        <BarChart
          data={data}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          onClick={(state) => {
            const index = Number(state?.activeTooltipIndex);
            const point = Number.isInteger(index) ? data[index] : undefined;
            if (point) router.push(`/transactions?month=${point.month}`);
          }}
        >
          <XAxis dataKey="label" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis hide />
          <Tooltip formatter={(value) => formatYen(Number(value))} />
          {/* react-smoothのアニメーションが一部環境でrequestAnimationFrameと噛み合わず
              バーが一切描画されないことがあるため無効化している */}
          <Bar dataKey="total" fill="#2f6f4f" radius={[6, 6, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
