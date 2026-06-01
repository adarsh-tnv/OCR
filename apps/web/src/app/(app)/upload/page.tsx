"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCcw, UploadCloud } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { StatusBadge } from "@/components/common/status-badge";
import { Dropzone } from "@/components/upload/dropzone";
import { UploadProgress } from "@/components/upload/upload-progress";
import { listFiles, retryOcr, uploadFiles } from "@/lib/api";
import { attachSocketAuth, socket } from "@/lib/socket";
import { useProcessingStore } from "@/store/use-processing-store";

export default function UploadPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState(0);
  const queryClient = useQueryClient();
  const setUpdate = useProcessingStore((state) => state.setUpdate);
  const updates = useProcessingStore((state) => state.updates);

  const uploads = useQuery({
    queryKey: ["files", "recent"],
    queryFn: () => listFiles({ pageSize: 10 })
  });

  useEffect(() => {
    attachSocketAuth();
    socket.connect();
    socket.on("job:update", setUpdate);
    return () => {
      socket.off("job:update", setUpdate);
      socket.disconnect();
    };
  }, [setUpdate]);

  const uploadMutation = useMutation({
    mutationFn: () => uploadFiles(files, setProgress),
    onSuccess: () => {
      setFiles([]);
      setProgress(0);
      void queryClient.invalidateQueries({ queryKey: ["files"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    }
  });

  const retryMutation = useMutation({
    mutationFn: retryOcr,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["files"] });
    }
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Upload Center</h1>
        <p className="mt-1 text-sm text-slate-500">Upload ISO and compliance certificates for OCR extraction.</p>
      </div>

      <Dropzone files={files} onFilesChange={setFiles} disabled={uploadMutation.isPending} />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!files.length || uploadMutation.isPending}
          onClick={() => uploadMutation.mutate()}
          className="focus-ring inline-flex items-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <UploadCloud className="h-4 w-4" />
          Upload and process
        </button>
        {uploadMutation.error ? (
          <span className="text-sm text-red-600">{uploadMutation.error.message}</span>
        ) : null}
      </div>

      {uploadMutation.isPending ? <UploadProgress progress={progress} /> : null}

      <section className="rounded-md border border-slate-200 bg-white shadow-soft">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">Recent uploads</h2>
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
              {uploads.data?.items.map((file) => {
                const update = updates[file.id];
                return (
                  <tr key={file.id}>
                    <td className="max-w-md px-4 py-3">
                      <p className="truncate font-medium text-ink">{file.originalName}</p>
                      <p className="text-xs text-slate-500">{file.mimeType}</p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={file.status} />
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {file.ocrConfidence !== null ? `${Math.round(file.ocrConfidence * 100)}%` : "-"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {update ? `${update.status}${update.progress ? ` ${update.progress}%` : ""}` : "-"}
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
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
