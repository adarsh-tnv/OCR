"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, FileBadge2, RefreshCcw, UploadCloud } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { StatusBadge } from "@/components/common/status-badge";
import { Dropzone } from "@/components/upload/dropzone";
import { UploadProgress } from "@/components/upload/upload-progress";
import { listExtractionProfiles, listFiles, retryOcr, uploadFiles } from "@/lib/api";
import { attachSocketAuth, socket } from "@/lib/socket";
import { useProcessingStore } from "@/store/use-processing-store";
import type { DocumentCategory, ExtractionProfile } from "@/types/api";

const categoryIcon = (category: DocumentCategory) =>
  category === "company_registration" ? Building2 : FileBadge2;
const activeUploadStatuses = new Set(["UPLOADED", "QUEUED", "PROCESSING", "OCR_COMPLETED", "EXTRACTED"]);

export default function UploadPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState(0);
  const [documentCategory, setDocumentCategory] = useState<DocumentCategory>("iso_certificate");
  const [uploadsPage, setUploadsPage] = useState(1);
  const [uploadsPageSize, setUploadsPageSize] = useState(5);
  const queryClient = useQueryClient();
  const setUpdate = useProcessingStore((state) => state.setUpdate);
  const updates = useProcessingStore((state) => state.updates);

  const uploads = useQuery({
    queryKey: ["files", "recent", uploadsPage, uploadsPageSize],
    queryFn: () => listFiles({ page: uploadsPage, pageSize: uploadsPageSize }),
    refetchInterval: (query) => {
      const data = query.state.data as Awaited<ReturnType<typeof listFiles>> | undefined;
      return data?.items.some((file) => activeUploadStatuses.has(file.status)) ? 2000 : false;
    }
  });

  const profiles = useQuery({
    queryKey: ["extraction-profiles"],
    queryFn: listExtractionProfiles
  });
  const profileItems = profiles.data?.items ?? [];
  const uploadItems = uploads.data?.items ?? [];
  const uploadTotal = uploads.data?.total ?? 0;
  const uploadTotalPages = uploads.data?.totalPages ?? 1;
  const uploadStart = uploadTotal ? ((uploads.data?.page ?? uploadsPage) - 1) * (uploads.data?.pageSize ?? uploadsPageSize) + 1 : 0;
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

  const uploadMutation = useMutation({
    mutationFn: () => uploadFiles(files, documentCategory, setProgress),
    onSuccess: () => {
      setFiles([]);
      setProgress(0);
      setUploadsPage(1);
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

      <section className="rounded-md border border-slate-200 bg-white p-4 shadow-soft">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-sm font-semibold text-ink">Document category</h2>
            <p className="mt-1 text-sm text-slate-500">Choose the extraction profile before adding files.</p>
          </div>
          <div className="text-xs font-medium uppercase tracking-normal text-slate-500">
            {profileItems.find((profile) => profile.category === documentCategory)?.fields.length ?? 0} fields
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {profileItems.length ? (
            profileItems.map((profile) => (
              <CategoryCard
                key={profile.category}
                profile={profile}
                selected={documentCategory === profile.category}
                disabled={uploadMutation.isPending}
                onSelect={() => setDocumentCategory(profile.category)}
              />
            ))
          ) : (
            <CategoryCard
              profile={{
                category: "iso_certificate",
                label: "ISO certificate",
                description: "Certificate body, certified entity, standard, scope, and registration dates.",
                fields: [],
                checkpoints: []
              }}
              selected
              disabled={uploadMutation.isPending}
              onSelect={() => setDocumentCategory("iso_certificate")}
            />
          )}
        </div>
      </section>

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

function CategoryCard({
  profile,
  selected,
  disabled,
  onSelect
}: {
  profile: ExtractionProfile;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  const Icon = categoryIcon(profile.category);
  const mandatoryFields = profile.fields.filter((field) => field.mandatory).length;

  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={selected}
      onClick={onSelect}
      className={`focus-ring grid min-h-32 grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-md border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
        selected
          ? "border-brand-600 bg-blue-50 shadow-soft"
          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
      }`}
    >
      <span
        className={`flex h-10 w-10 items-center justify-center rounded-md ${
          selected ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600"
        }`}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="flex items-start justify-between gap-3">
          <span className="font-semibold text-ink">{profile.label}</span>
          {selected ? (
            <span className="rounded-md bg-brand-600 px-2 py-1 text-xs font-medium text-white">Selected</span>
          ) : null}
        </span>
        <span className="mt-1 block text-sm leading-5 text-slate-500">
          {profile.description ?? "Configured OCR extraction profile."}
        </span>
        <span className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
          <span className="rounded-md bg-white px-2 py-1 ring-1 ring-slate-200">{profile.fields.length} fields</span>
          <span className="rounded-md bg-white px-2 py-1 ring-1 ring-slate-200">{mandatoryFields} mandatory</span>
          <CheckpointBadge profile={profile} />
        </span>
      </span>
    </button>
  );
}

function CheckpointBadge({ profile }: { profile: ExtractionProfile }) {
  const summary = profile.checkpoints.length
    ? profile.checkpoints
        .map((checkpoint) => `${checkpoint.label}${checkpoint.mandatory ? " mandatory" : ""}`)
        .join(", ")
    : "No checkpoints configured";

  return (
    <span
      className="group/checkpoints relative rounded-md bg-white px-2 py-1 ring-1 ring-slate-200"
      aria-label={summary}
    >
      {profile.checkpoints.length} checkpoints
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-full left-0 z-20 mb-2 hidden w-80 rounded-md border border-slate-200 bg-white p-3 text-left text-xs normal-case text-slate-600 shadow-lg group-hover/checkpoints:block"
      >
        <span className="block font-semibold text-ink">{profile.label} checkpoints</span>
        <span className="mt-2 block space-y-2">
          {profile.checkpoints.length ? (
            profile.checkpoints.map((checkpoint) => (
              <span key={checkpoint.key} className="block">
                <span className="font-medium text-ink">
                  {checkpoint.label}
                  {checkpoint.mandatory ? " *" : ""}
                </span>
                {checkpoint.description ? (
                  <span className="mt-0.5 block leading-5 text-slate-500">{checkpoint.description}</span>
                ) : null}
              </span>
            ))
          ) : (
            <span className="block text-slate-500">No checkpoints configured.</span>
          )}
        </span>
      </span>
    </span>
  );
}
