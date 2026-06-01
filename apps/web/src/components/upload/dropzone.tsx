"use client";

import { ACCEPTED_MIME_TYPES } from "@iso-ocr/shared";
import { UploadCloud, X } from "lucide-react";
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
      "image/jpeg": [".jpg", ".jpeg"]
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
        <UploadCloud className="h-10 w-10 text-brand-600" />
        <p className="mt-3 text-sm font-medium text-ink">Drop certificates here or browse files</p>
        <p className="mt-1 text-xs text-slate-500">
          PDF, PNG, JPG, JPEG up to {maxSizeMb} MB each. Accepted MIME types: {ACCEPTED_MIME_TYPES.join(", ")}.
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
        <div className="grid gap-4 lg:grid-cols-2">
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
      ) : null}
    </div>
  );
}
