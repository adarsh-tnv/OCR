import { cn } from "@/lib/cn";

const styles: Record<string, string> = {
  valid: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  VALIDATED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  expired: "bg-amber-50 text-amber-700 ring-amber-200",
  suspicious: "bg-red-50 text-red-700 ring-red-200",
  incomplete: "bg-slate-100 text-slate-700 ring-slate-200",
  pending_review: "bg-blue-50 text-blue-700 ring-blue-200",
  NEEDS_REVIEW: "bg-blue-50 text-blue-700 ring-blue-200",
  FAILED: "bg-red-50 text-red-700 ring-red-200",
  PROCESSING: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  QUEUED: "bg-slate-100 text-slate-700 ring-slate-200",
  OCR_COMPLETED: "bg-cyan-50 text-cyan-700 ring-cyan-200",
  EXTRACTED: "bg-purple-50 text-purple-700 ring-purple-200",
  unknown: "bg-slate-100 text-slate-700 ring-slate-200"
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset",
        styles[status] ?? styles.unknown,
        className
      )}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}
