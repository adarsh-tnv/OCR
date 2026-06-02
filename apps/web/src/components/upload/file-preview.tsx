"use client";
/* eslint-disable @next/next/no-img-element */

import { FileText, Image as ImageIcon } from "lucide-react";
import { useEffect, useState } from "react";

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
};

export function FilePreview({ file }: { file: File }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const nextUrl = URL.createObjectURL(file);
    setUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [file]);

  if (!url) return null;

  if (file.type === "application/pdf") {
    return (
      <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
        <div className="flex min-h-14 items-start gap-2 border-b border-slate-200 px-3 py-2 pr-10 text-xs text-slate-600">
          <FileText className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
          <div className="min-w-0">
            <p className="truncate font-medium text-ink">{file.name}</p>
            <p className="mt-0.5 text-slate-500">{formatBytes(file.size)} · PDF</p>
          </div>
        </div>
        <iframe src={url} title={file.name} className="h-44 w-full bg-slate-50" />
      </div>
    );
  }

  if (!file.type.startsWith("image/")) {
    return (
      <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
        <div className="flex min-h-14 items-start gap-2 border-b border-slate-200 px-3 py-2 pr-10 text-xs text-slate-600">
          <FileText className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
          <div className="min-w-0">
            <p className="truncate font-medium text-ink">{file.name}</p>
            <p className="mt-0.5 text-slate-500">{formatBytes(file.size)} · DOCX</p>
          </div>
        </div>
        <div className="flex h-44 items-center justify-center bg-slate-50 text-sm text-slate-500">
          Word document
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
      <div className="flex min-h-14 items-start gap-2 border-b border-slate-200 px-3 py-2 pr-10 text-xs text-slate-600">
        <ImageIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
        <div className="min-w-0">
          <p className="truncate font-medium text-ink">{file.name}</p>
          <p className="mt-0.5 text-slate-500">{formatBytes(file.size)} · Image</p>
        </div>
      </div>
      <img src={url} alt={file.name} className="h-44 w-full bg-slate-50 object-contain" />
    </div>
  );
}
