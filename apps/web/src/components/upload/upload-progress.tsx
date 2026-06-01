export function UploadProgress({ progress }: { progress: number }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4 shadow-soft">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-ink">Upload progress</span>
        <span className="text-slate-600">{progress}%</span>
      </div>
      <div className="mt-3 h-2 rounded-full bg-slate-100">
        <div className="h-2 rounded-full bg-brand-600 transition-all" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
