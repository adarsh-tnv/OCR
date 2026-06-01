"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type { DashboardCharts } from "@/types/api";

const palette = ["#2563eb", "#16a34a", "#f59e0b", "#dc2626", "#7c3aed", "#0891b2", "#475569"];

export function DashboardCharts({ data }: { data: DashboardCharts }) {
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <section className="rounded-md border border-slate-200 bg-white p-4 shadow-soft xl:col-span-2">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-ink">Upload Trends</h2>
          <p className="text-xs text-slate-500">Last 30 days</p>
        </div>
        <div className="h-72">
          <ResponsiveContainer>
            <AreaChart data={data.uploadTrends}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Area type="monotone" dataKey="count" stroke="#2563eb" fill="#bfdbfe" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-md border border-slate-200 bg-white p-4 shadow-soft">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-ink">Status Distribution</h2>
          <p className="text-xs text-slate-500">Current extracted certificates</p>
        </div>
        <div className="h-72">
          <ResponsiveContainer>
            <PieChart>
              <Pie data={data.statusDistribution} dataKey="count" nameKey="status" innerRadius={58} outerRadius={92}>
                {data.statusDistribution.map((entry, index) => (
                  <Cell key={entry.status} fill={palette[index % palette.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-md border border-slate-200 bg-white p-4 shadow-soft xl:col-span-3">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-ink">Certificate Types</h2>
          <p className="text-xs text-slate-500">Top extracted standards and compliance types</p>
        </div>
        <div className="h-72">
          <ResponsiveContainer>
            <BarChart data={data.certificateTypes}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="type" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#16a34a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
