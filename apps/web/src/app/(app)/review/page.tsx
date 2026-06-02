"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertCircle } from "lucide-react";
import { StatusBadge } from "@/components/common/status-badge";
import { getReviewQueue } from "@/lib/api";

export default function ReviewQueuePage() {
  const queue = useQuery({
    queryKey: ["review", "queue"],
    queryFn: getReviewQueue
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Review Queue</h1>
        <p className="mt-1 text-sm text-slate-500">
          Prioritized certificates that need human correction or validation.
        </p>
      </div>

      <div className="grid gap-4">
        {(queue.data?.items ?? []).map((certificate) => (
          <article key={certificate.id} className="rounded-md border border-slate-200 bg-white p-4 shadow-soft">
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={certificate.certificateStatus} />
                  <span className="text-sm text-slate-500">
                    {Math.round(certificate.confidenceScore * 100)}% confidence
                  </span>
                </div>
                <p className="mt-2 text-base font-semibold text-ink">
                  {certificate.certificateNumber ?? "Missing certificate number"}
                </p>
                <p className="mt-1 truncate text-sm text-ink">{certificate.organizationName ?? "Unknown organization"}</p>
                <p className="mt-1 text-sm text-slate-500">{certificate.certificateStandard ?? "Unknown standard"}</p>
              </div>
            </div>

            {certificate.validationFlags?.length ? (
              <div className="mt-4 grid gap-2 md:grid-cols-2">
                {certificate.validationFlags.slice(0, 4).map((flag) => (
                  <div key={flag} className="flex gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{flag}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </article>
        ))}
      </div>

      {!queue.isLoading && !queue.data?.items.length ? (
        <div className="rounded-md border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-soft">
          No certificates are waiting for review.
        </div>
      ) : null}
    </div>
  );
}
