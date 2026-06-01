"use client";
/* eslint-disable @next/next/no-img-element */

import { FileText, Image as ImageIcon } from "lucide-react";
import { useEffect, useState } from "react";

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
        <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2 text-xs text-slate-600">
          <FileText className="h-4 w-4" />
          {file.name}
        </div>
        <iframe src={url} title={file.name} className="h-64 w-full bg-slate-50" />
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
      <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2 text-xs text-slate-600">
        <ImageIcon className="h-4 w-4" />
        {file.name}
      </div>
      <img src={url} alt={file.name} className="h-64 w-full object-contain bg-slate-50" />
    </div>
  );
}
