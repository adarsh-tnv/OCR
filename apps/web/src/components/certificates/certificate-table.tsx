"use client";

import Link from "next/link";
import { FileJson, FileSpreadsheet, FileText } from "lucide-react";
import { StatusBadge } from "@/components/common/status-badge";
import { downloadCertificateExport } from "@/lib/api";
import type { CertificateRecord } from "@/types/api";

export function CertificateTable({ certificates }: { certificates: CertificateRecord[] }) {
  return (
    <div className="overflow-x-auto rounded-md border border-slate-200 bg-white shadow-soft">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-normal text-slate-500">
          <tr>
            <th className="px-4 py-3">Certificate</th>
            <th className="px-4 py-3">Organization</th>
            <th className="px-4 py-3">Body</th>
            <th className="px-4 py-3">Expiry</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Confidence</th>
            <th className="px-4 py-3">Export</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {certificates.map((certificate) => (
            <tr key={certificate.id} className="hover:bg-slate-50/70">
              <td className="px-4 py-3">
                <Link href={`/certificates/${certificate.id}`} className="font-medium text-brand-600 hover:underline">
                  {certificate.certificateNumber ?? "No certificate number"}
                </Link>
                <p className="text-xs text-slate-500">{certificate.certificateStandard ?? "Unknown standard"}</p>
              </td>
              <td className="max-w-xs px-4 py-3">
                <p className="truncate text-ink">{certificate.organizationName ?? "-"}</p>
                <p className="truncate text-xs text-slate-500">{certificate.organizationAddress ?? ""}</p>
              </td>
              <td className="max-w-xs px-4 py-3">
                <p className="truncate text-slate-700">{certificate.certificationBody ?? "-"}</p>
                <p className="truncate text-xs text-slate-500">{certificate.accreditationBody ?? ""}</p>
              </td>
              <td className="px-4 py-3 text-slate-600">
                {certificate.expiryDate ? certificate.expiryDate.slice(0, 10) : "-"}
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={certificate.certificateStatus} />
              </td>
              <td className="px-4 py-3 text-slate-600">{Math.round(certificate.confidenceScore * 100)}%</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => void downloadCertificateExport(certificate.id, "json")}
                    className="focus-ring rounded-md p-1.5 text-slate-600 hover:bg-slate-100"
                    title="Export JSON"
                  >
                    <FileJson className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void downloadCertificateExport(certificate.id, "xlsx")}
                    className="focus-ring rounded-md p-1.5 text-slate-600 hover:bg-slate-100"
                    title="Export Excel"
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void downloadCertificateExport(certificate.id, "pdf")}
                    className="focus-ring rounded-md p-1.5 text-slate-600 hover:bg-slate-100"
                    title="Export PDF"
                  >
                    <FileText className="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {!certificates.length ? (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                No certificates match the current filters.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
