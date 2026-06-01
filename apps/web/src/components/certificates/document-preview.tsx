"use client";
/* eslint-disable @next/next/no-img-element */

import { FileText } from "lucide-react";
import type { UploadedFile } from "@/types/api";

export function DocumentPreview({
  file,
  previewUrl
}: {
  file?: UploadedFile | undefined;
  previewUrl?: string | undefined;
}) {
  if (!file || !previewUrl) {
    return (
      <div className="flex h-96 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-sm text-slate-500">
        Preview unavailable
      </div>
    );
  }

  if (file.mimeType === "application/pdf") {
    return (
      <iframe
        src={previewUrl}
        title={file.originalName}
        className="h-[620px] w-full rounded-md border border-slate-200 bg-white"
      />
    );
  }

  if (file.mimeType.startsWith("image/")) {
    return (
      <img
        src={previewUrl}
        alt={file.originalName}
        className="h-[620px] w-full rounded-md border border-slate-200 bg-white object-contain"
      />
    );
  }

  return (
    <a
      href={previewUrl}
      className="flex h-96 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white text-sm text-brand-600"
    >
      <FileText className="h-4 w-4" />
      Open source file
    </a>
  );
}
