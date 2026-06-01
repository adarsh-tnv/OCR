import { Database, FileCheck2, KeyRound, Server, ShieldCheck } from "lucide-react";

const settings = [
  {
    title: "OCR provider",
    value: "AWS Textract",
    icon: FileCheck2,
    details: "Uses the same AWS credentials and S3 bucket configured for file storage."
  },
  {
    title: "AI extraction",
    value: "Google Gemini",
    icon: KeyRound,
    details: "Uses the Gemini generateContent API with JSON-mode prompts for extraction and file chat."
  },
  {
    title: "Storage",
    value: "AWS S3",
    icon: Server,
    details: "Files are stored under certificate date partitions and served with signed URLs."
  },
  {
    title: "Database",
    value: "MongoDB and Prisma",
    icon: Database,
    details: "Extraction history, review comments, processing jobs, file chat, and certificate records are stored in MongoDB."
  },
  {
    title: "Security",
    value: "Helmet, rate limits, validation",
    icon: ShieldCheck,
    details: "No authentication is enabled in this phase."
  }
];

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">Runtime configuration and integration checkpoints.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {settings.map((item) => {
          const Icon = item.icon;
          return (
            <section key={item.title} className="rounded-md border border-slate-200 bg-white p-4 shadow-soft">
              <div className="flex items-start gap-3">
                <div className="rounded-md bg-slate-100 p-2 text-slate-600">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-ink">{item.title}</h2>
                  <p className="mt-1 text-sm text-brand-600">{item.value}</p>
                  <p className="mt-2 text-sm text-slate-500">{item.details}</p>
                </div>
              </div>
            </section>
          );
        })}
      </div>

      <section className="rounded-md border border-slate-200 bg-white p-4 shadow-soft">
        <h2 className="text-sm font-semibold text-ink">Environment variables</h2>
        <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
          {[
            "MONGO_URL",
            "REDIS_URL",
            "AWS_S3_BUCKET",
            "TEXTRACT_FEATURE_TYPES",
            "GEMINI_MODEL",
            "DEFAULT_EXTRACTION_FIELDS",
            "OCR_CONFIDENCE_THRESHOLD",
            "QUEUE_CONCURRENCY",
            "MAX_UPLOAD_MB"
          ].map((name) => (
            <div key={name} className="rounded-md bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700">
              {name}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
