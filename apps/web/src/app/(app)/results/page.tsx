"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCcw } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { StatusBadge } from "@/components/common/status-badge";
import { listFiles, retryOcr } from "@/lib/api";
import { attachSocketAuth, socket } from "@/lib/socket";
import { useProcessingStore } from "@/store/use-processing-store";

const activeUploadStatuses = new Set(["UPLOADED", "QUEUED", "PROCESSING", "OCR_COMPLETED", "EXTRACTED"]);

export default function ResultsPage() {
  const [uploadsPage, setUploadsPage] = useState(1);
  const [uploadsPageSize, setUploadsPageSize] = useState(5);
  const queryClient = useQueryClient();
  const setUpdate = useProcessingStore((state) => state.setUpdate);
  const updates = useProcessingStore((state) => state.updates);

  const uploads = useQuery({
    queryKey: ["files", "results", uploadsPage, uploadsPageSize],
    queryFn: () => listFiles({ page: uploadsPage, pageSize: uploadsPageSize }),
    refetchInterval: (query) => {
      const data = query.state.data as Awaited<ReturnType<typeof listFiles>> | undefined;
      return data?.items.some((file) => activeUploadStatuses.has(file.status)) ? 2000 : false;
    }
  });

  const uploadItems = uploads.data?.items ?? [];
  const uploadTotal = uploads.data?.total ?? 0;
  const uploadTotalPages = uploads.data?.totalPages ?? 1;
  const uploadStart = uploadTotal
    ? ((uploads.data?.page ?? uploadsPage) - 1) * (uploads.data?.pageSize ?? uploadsPageSize) + 1
    : 0;
  const uploadEnd = uploadTotal ? uploadStart + uploadItems.length - 1 : 0;

  useEffect(() => {
    attachSocketAuth();
    socket.connect();
    const handleJobUpdate = (update: Parameters<typeof setUpdate>[0]) => {
      setUpdate(update);
      if (update.status === "completed" || update.status === "failed") {
        void queryClient.invalidateQueries({ queryKey: ["files"] });
        void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      }
    };

    socket.on("job:update", handleJobUpdate);
    return () => {
      socket.off("job:update", handleJobUpdate);
      socket.disconnect();
    };
  }, [queryClient, setUpdate]);

  const retryMutation = useMutation({
    mutationFn: retryOcr,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["files"] });
    }
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">OCR Results</h1>
        <p className="mt-1 text-sm text-slate-500">Open uploaded files and monitor OCR extraction status.</p>
      </div>

      <section className="rounded-md border border-slate-200 bg-white shadow-soft">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-sm font-semibold text-ink">Recent uploads</h2>
            <p className="mt-1 text-xs text-slate-500">
              {uploadTotal ? `Showing ${uploadStart}-${uploadEnd} of ${uploadTotal}` : "No uploads yet"}
            </p>
          </div>
          <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
            Rows per page
            <select
              value={uploadsPageSize}
              onChange={(event) => {
                setUploadsPageSize(Number(event.target.value));
                setUploadsPage(1);
              }}
              className="focus-ring rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-ink"
            >
              {[5, 10, 20, 50].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-normal text-slate-500">
              <tr>
                <th className="px-4 py-3">File</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">OCR</th>
                <th className="px-4 py-3">Queue</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {uploadItems.map((file) => {
                const update = updates[file.id];
                return (
                  <tr key={file.id}>
                    <td className="max-w-md px-4 py-3">
                      <p className="truncate font-medium text-ink">{file.originalName}</p>
                      <p className="text-xs text-slate-500">
                        {file.mimeType}
                        {file.documentCategory ? ` · ${file.documentCategory.replaceAll("_", " ")}` : ""}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={file.status} />
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {file.ocrConfidence !== null ? `${Math.round(file.ocrConfidence * 100)}%` : "-"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {update
                        ? `${update.status}${update.progress ? ` ${update.progress}%` : ""}`
                        : activeUploadStatuses.has(file.status)
                          ? "Extracting data"
                          : "-"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/files/${file.id}`}
                          className="focus-ring inline-flex items-center rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Open
                        </Link>
                        {file.status === "FAILED" ? (
                          <button
                            type="button"
                            onClick={() => retryMutation.mutate(file.id)}
                            className="focus-ring inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            <RefreshCcw className="h-3.5 w-3.5" />
                            Retry
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!uploadItems.length ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    No uploads found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col justify-between gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-600 sm:flex-row sm:items-center">
          <span>
            Page {uploadTotal ? uploadsPage : 0} of {uploadTotal ? uploadTotalPages : 0}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={uploadsPage <= 1 || uploads.isFetching}
              onClick={() => setUploadsPage((page) => Math.max(1, page - 1))}
              className="focus-ring rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={uploadsPage >= uploadTotalPages || uploads.isFetching || !uploadTotal}
              onClick={() => setUploadsPage((page) => Math.min(uploadTotalPages, page + 1))}
              className="focus-ring rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
