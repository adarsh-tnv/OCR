"use client";

import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { CertificateTable } from "@/components/certificates/certificate-table";
import { listCertificates } from "@/lib/api";

export default function ResultsPage() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [standard, setStandard] = useState("");
  const [confidenceMin, setConfidenceMin] = useState("");

  const params = useMemo(() => {
    const next: Record<string, string | number> = { pageSize: 25 };
    if (query) next.query = query;
    if (status) next.status = status;
    if (standard) next.certificateStandard = standard;
    if (confidenceMin) next.confidenceMin = Number(confidenceMin) / 100;
    return next;
  }, [confidenceMin, query, standard, status]);

  const certificates = useQuery({
    queryKey: ["certificates", params],
    queryFn: () => listCertificates(params)
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">OCR Results</h1>
        <p className="mt-1 text-sm text-slate-500">Search and filter extracted certificate records.</p>
      </div>

      <section className="rounded-md border border-slate-200 bg-white p-4 shadow-soft">
        <div className="grid gap-3 md:grid-cols-4">
          <label className="md:col-span-2">
            <span className="text-xs font-medium text-slate-600">Search</span>
            <div className="mt-1 flex items-center rounded-md border border-slate-300 bg-white px-3">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Certificate number, organization, standard, body"
                className="focus-ring w-full border-0 bg-transparent px-2 py-2 text-sm outline-none"
              />
            </div>
          </label>
          <label>
            <span className="text-xs font-medium text-slate-600">Status</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="focus-ring mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">Any status</option>
              <option value="valid">Valid</option>
              <option value="expired">Expired</option>
              <option value="suspicious">Suspicious</option>
              <option value="incomplete">Incomplete</option>
              <option value="pending_review">Pending review</option>
            </select>
          </label>
          <label>
            <span className="text-xs font-medium text-slate-600">Minimum confidence</span>
            <input
              type="number"
              min="0"
              max="100"
              value={confidenceMin}
              onChange={(event) => setConfidenceMin(event.target.value)}
              className="focus-ring mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="0"
            />
          </label>
          <label className="md:col-span-2">
            <span className="text-xs font-medium text-slate-600">ISO or certificate type</span>
            <input
              value={standard}
              onChange={(event) => setStandard(event.target.value)}
              placeholder="ISO 9001, ISO 27001, CE, GMP, HACCP"
              className="focus-ring mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
        </div>
      </section>

      <CertificateTable certificates={certificates.data?.items ?? []} />
    </div>
  );
}
