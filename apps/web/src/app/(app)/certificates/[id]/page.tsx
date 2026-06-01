"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Braces, FileText, RefreshCcw, Sparkles } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CertificateEditForm } from "@/components/certificates/certificate-edit-form";
import { DocumentPreview } from "@/components/certificates/document-preview";
import { FileAiPanel } from "@/components/certificates/file-ai-panel";
import { JsonViewer } from "@/components/common/json-viewer";
import { StatusBadge } from "@/components/common/status-badge";
import { getCertificate, getOcrResult, getPreview, retryOcr, updateCertificate } from "@/lib/api";
import { attachSocketAuth, socket } from "@/lib/socket";
import { useProcessingStore } from "@/store/use-processing-store";

type Tab = "fields" | "json" | "ocr" | "ai";

export default function CertificateDetailsPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [tab, setTab] = useState<Tab>("fields");
  const queryClient = useQueryClient();
  const setUpdate = useProcessingStore((state) => state.setUpdate);

  const certificate = useQuery({
    queryKey: ["certificate", id],
    queryFn: () => getCertificate(id)
  });

  const fileId = certificate.data?.uploadedFileId;
  const preview = useQuery({
    queryKey: ["preview", fileId],
    queryFn: () => getPreview(fileId as string),
    enabled: Boolean(fileId)
  });

  const ocr = useQuery({
    queryKey: ["ocr", fileId],
    queryFn: () => getOcrResult(fileId as string),
    enabled: Boolean(fileId)
  });

  useEffect(() => {
    if (!fileId) return;
    attachSocketAuth();
    socket.connect();
    socket.emit("file:subscribe", fileId);
    socket.on("job:update", setUpdate);
    return () => {
      socket.emit("file:unsubscribe", fileId);
      socket.off("job:update", setUpdate);
      socket.disconnect();
    };
  }, [fileId, setUpdate]);

  const updateMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => updateCertificate(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["certificate", id] });
      void queryClient.invalidateQueries({ queryKey: ["certificates"] });
      void queryClient.invalidateQueries({ queryKey: ["review"] });
    }
  });

  const retryMutation = useMutation({
    mutationFn: () => retryOcr(fileId as string),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["certificate", id] });
    }
  });

  if (certificate.isLoading) {
    return <div className="text-sm text-slate-500">Loading certificate</div>;
  }

  if (!certificate.data) {
    return <div className="text-sm text-slate-500">Certificate not found</div>;
  }

  const data = certificate.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <Link href="/results" className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-ink">
            <ArrowLeft className="h-4 w-4" />
            Results
          </Link>
          <h1 className="mt-3 text-2xl font-semibold text-ink">
            {data.certificateNumber ?? "Certificate details"}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={data.certificateStatus} />
            <span className="text-sm text-slate-500">{data.certificateStandard ?? "Unknown standard"}</span>
            <span className="text-sm text-slate-500">{Math.round(data.confidenceScore * 100)}% confidence</span>
          </div>
        </div>
        <button
          type="button"
          disabled={!fileId || retryMutation.isPending}
          onClick={() => retryMutation.mutate()}
          className="focus-ring inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-soft hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCcw className="h-4 w-4" />
          Retry OCR
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section>
          <DocumentPreview file={data.uploadedFile} previewUrl={preview.data?.url} />
        </section>

        <section className="rounded-md border border-slate-200 bg-white shadow-soft">
          <div className="flex border-b border-slate-200">
            <TabButton active={tab === "fields"} onClick={() => setTab("fields")} icon={<FileText className="h-4 w-4" />}>
              Fields
            </TabButton>
            <TabButton active={tab === "json"} onClick={() => setTab("json")} icon={<Braces className="h-4 w-4" />}>
              Extracted JSON
            </TabButton>
            <TabButton active={tab === "ocr"} onClick={() => setTab("ocr")} icon={<FileText className="h-4 w-4" />}>
              OCR text
            </TabButton>
            <TabButton active={tab === "ai"} onClick={() => setTab("ai")} icon={<Sparkles className="h-4 w-4" />}>
              File AI
            </TabButton>
          </div>
          <div className="p-4">
            {tab === "fields" ? (
              <CertificateEditForm
                certificate={data}
                submitting={updateMutation.isPending}
                onSubmit={(payload) => updateMutation.mutate(payload)}
              />
            ) : null}
            {tab === "json" ? <JsonViewer value={data.normalizedPayload} /> : null}
            {tab === "ocr" ? (
              <pre className="max-h-[680px] overflow-auto whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-700">
                {ocr.data?.rawText ?? "OCR text unavailable"}
              </pre>
            ) : null}
            {tab === "ai" ? <FileAiPanel file={data.uploadedFile} /> : null}
          </div>
        </section>
      </div>

      <section className="rounded-md border border-slate-200 bg-white p-4 shadow-soft">
        <h2 className="text-sm font-semibold text-ink">Validation flags</h2>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {(data.validationFlags ?? []).map((flag) => (
            <div key={flag} className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {flag}
            </div>
          ))}
          {!data.validationFlags?.length ? <p className="text-sm text-slate-500">No validation flags.</p> : null}
        </div>
      </section>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium ${
        active ? "border-brand-600 text-brand-600" : "border-transparent text-slate-500 hover:text-ink"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}
