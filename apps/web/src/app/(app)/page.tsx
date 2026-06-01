"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Files,
  Gauge,
  TimerReset
} from "lucide-react";
import { DashboardCharts } from "@/components/charts/dashboard-charts";
import { StatCard } from "@/components/dashboard/stat-card";
import { getDashboardCharts, getDashboardStatistics } from "@/lib/api";

export default function DashboardPage() {
  const stats = useQuery({ queryKey: ["dashboard", "statistics"], queryFn: getDashboardStatistics });
  const charts = useQuery({ queryKey: ["dashboard", "charts"], queryFn: getDashboardCharts });

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">Operational view of OCR processing and certificate review.</p>
        </div>
        <div className="text-sm text-slate-500">Live queue updates are available on upload and detail pages.</div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <StatCard label="Total uploads" value={stats.data?.totalUploads ?? "-"} icon={Files} />
        <StatCard label="Pending review" value={stats.data?.pendingReview ?? "-"} icon={Clock3} />
        <StatCard label="Processed" value={stats.data?.processedCertificates ?? "-"} icon={CheckCircle2} />
        <StatCard label="Failed" value={stats.data?.failedExtractions ?? "-"} icon={AlertTriangle} />
        <StatCard label="Expiring soon" value={stats.data?.expiringCertificates ?? "-"} icon={TimerReset} />
        <StatCard
          label="OCR accuracy"
          value={stats.data ? `${Math.round(stats.data.ocrAccuracyRate * 100)}%` : "-"}
          icon={Gauge}
        />
      </div>

      {charts.data ? (
        <DashboardCharts data={charts.data} />
      ) : (
        <div className="rounded-md border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-soft">
          Loading chart data
        </div>
      )}
    </div>
  );
}
