"use client";

import { ACCEPTED_EXTENSIONS } from "@iso-ocr/shared";
import { FileCheck2, UploadCloud, X } from "lucide-react";
import { useDropzone, type DropzoneOptions } from "react-dropzone";
import { cn } from "@/lib/cn";
import { FilePreview } from "./file-preview";

const maxSizeMb = 25;

export function Dropzone({
  files,
  onFilesChange,
  disabled
}: {
  files: File[];
  onFilesChange: (files: File[]) => void;
  disabled?: boolean;
}) {
  const dropzoneOptions: DropzoneOptions = {
    multiple: true,
    maxSize: maxSizeMb * 1024 * 1024,
    accept: {
      "application/pdf": [".pdf"],
      "image/png": [".png"],
      "image/jpeg": [".jpg", ".jpeg"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"]
    },
    onDropAccepted: (acceptedFiles) => {
      onFilesChange([...files, ...acceptedFiles]);
    }
  };
  if (disabled !== undefined) dropzoneOptions.disabled = disabled;

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone(dropzoneOptions);

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={cn(
          "flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-slate-300 bg-white p-8 text-center shadow-soft transition",
          isDragActive && "border-brand-500 bg-blue-50",
          disabled && "cursor-not-allowed opacity-60"
        )}
      >
        <input {...getInputProps()} />
        <div className="flex h-12 w-12 items-center justify-center rounded-md bg-blue-50 text-brand-600">
          <UploadCloud className="h-6 w-6" />
        </div>
        <p className="mt-3 text-sm font-semibold text-ink">Drop documents here or browse files</p>
        <p className="mt-1 text-xs text-slate-500">
          {ACCEPTED_EXTENSIONS.join(", ").toUpperCase()} up to {maxSizeMb} MB each.
        </p>
      </div>

      {fileRejections.length ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {fileRejections.map((rejection) => (
            <p key={rejection.file.name}>
              {rejection.file.name}: {rejection.errors.map((error) => error.message).join(", ")}
            </p>
          ))}
        </div>
      ) : null}

      {files.length ? (
        <div className="rounded-md border border-slate-200 bg-white shadow-soft">
          <div className="flex flex-col justify-between gap-2 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <FileCheck2 className="h-4 w-4 text-brand-600" />
              <h2 className="text-sm font-semibold text-ink">Selected files</h2>
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                {files.length}
              </span>
            </div>
            <button
              type="button"
              onClick={() => onFilesChange([])}
              className="focus-ring inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-red-600"
            >
              <X className="h-3.5 w-3.5" />
              Clear all
            </button>
          </div>
          <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
            {files.map((file) => (
              <div key={`${file.name}-${file.lastModified}`} className="relative">
                <button
                  type="button"
                  onClick={() => onFilesChange(files.filter((candidate) => candidate !== file))}
                  className="focus-ring absolute right-2 top-2 z-10 rounded-md bg-white p-1 text-slate-600 shadow-soft hover:text-red-600"
                  title="Remove file"
                >
                  <X className="h-4 w-4" />
                </button>
                <FilePreview file={file} />
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
