"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Database, FileCheck2, KeyRound, Save, Server, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { listExtractionProfiles, updateExtractionProfile } from "@/lib/api";
import type { DocumentCategory, ExtractionProfile } from "@/types/api";

const integrationSettings = [
  {
    title: "OCR provider",
    value: "AWS Textract",
    icon: FileCheck2,
    details: "Uses async Textract analysis for multi-page PDFs and image documents."
  },
  {
    title: "AI extraction",
    value: "Google Gemini",
    icon: KeyRound,
    details: "Uses category-specific JSON prompts generated from the extraction profiles below."
  },
  {
    title: "Storage",
    value: "AWS S3",
    icon: Server,
    details: "Files are stored privately and served with signed URLs after API authorization."
  },
  {
    title: "Database",
    value: "MongoDB and Prisma",
    icon: Database,
    details: "Profiles, extraction history, file chat, processing jobs, and certificate records are stored in MongoDB."
  },
  {
    title: "Security",
    value: "Bearer token, Helmet, rate limits",
    icon: ShieldCheck,
    details: "API and socket requests require the configured token when API_AUTH_TOKEN is set."
  }
];

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const profiles = useQuery({
    queryKey: ["extraction-profiles"],
    queryFn: listExtractionProfiles
  });
  const [selectedCategory, setSelectedCategory] = useState<DocumentCategory>("iso_certificate");
  const [draft, setDraft] = useState<ExtractionProfile | null>(null);

  const selectedProfile = useMemo(
    () => profiles.data?.items.find((profile) => profile.category === selectedCategory) ?? profiles.data?.items[0],
    [profiles.data?.items, selectedCategory]
  );

  useEffect(() => {
    if (!selectedProfile) return;
    setSelectedCategory(selectedProfile.category);
    setDraft(structuredClone(selectedProfile));
  }, [selectedProfile]);

  const saveProfile = useMutation({
    mutationFn: () => {
      if (!draft) throw new Error("No profile selected");
      return updateExtractionProfile(draft.category, {
        label: draft.label,
        description: draft.description ?? "",
        fields: draft.fields,
        checkpoints: draft.checkpoints
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["extraction-profiles"] });
    }
  });

  const updateDraft = (updater: (profile: ExtractionProfile) => ExtractionProfile) => {
    setDraft((current) => (current ? updater(current) : current));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">Runtime configuration and extraction profile checkpoints.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {integrationSettings.map((item) => {
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
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <h2 className="text-sm font-semibold text-ink">Extraction profiles</h2>
            <p className="mt-1 text-sm text-slate-500">
              Configure which document details and validation checkpoints are mandatory for each category.
            </p>
          </div>
          <button
            type="button"
            disabled={!draft || saveProfile.isPending}
            onClick={() => saveProfile.mutate()}
            className="focus-ring inline-flex items-center gap-2 rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {saveProfile.isPending ? "Saving" : "Save profile"}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {(profiles.data?.items ?? []).map((profile) => (
            <button
              key={profile.category}
              type="button"
              onClick={() => setSelectedCategory(profile.category)}
              className={`focus-ring rounded-md px-3 py-2 text-sm font-medium ${
                selectedCategory === profile.category
                  ? "bg-brand-600 text-white"
                  : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {profile.label}
            </button>
          ))}
        </div>

        {draft ? (
          <div className="mt-5 space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700">
                Profile label
                <input
                  value={draft.label}
                  onChange={(event) => updateDraft((profile) => ({ ...profile, label: event.target.value }))}
                  className="focus-ring mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Description
                <input
                  value={draft.description ?? ""}
                  onChange={(event) => updateDraft((profile) => ({ ...profile, description: event.target.value }))}
                  className="focus-ring mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
            </div>

            <ProfileFieldTable draft={draft} updateDraft={updateDraft} />
            <CheckpointTable draft={draft} updateDraft={updateDraft} />

            {saveProfile.error ? <p className="text-sm text-red-600">{saveProfile.error.message}</p> : null}
          </div>
        ) : (
          <div className="mt-6 rounded-md bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
            Loading extraction profiles
          </div>
        )}
      </section>
    </div>
  );
}

function ProfileFieldTable({
  draft,
  updateDraft
}: {
  draft: ExtractionProfile;
  updateDraft: (updater: (profile: ExtractionProfile) => ExtractionProfile) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <h3 className="mb-2 text-sm font-semibold text-ink">Details to fetch</h3>
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-normal text-slate-500">
          <tr>
            <th className="px-3 py-2">Label</th>
            <th className="px-3 py-2">Description</th>
            <th className="px-3 py-2">Mandatory</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {draft.fields.map((field, index) => (
            <tr key={field.key}>
              <td className="px-3 py-2">
                <input
                  value={field.label}
                  onChange={(event) =>
                    updateDraft((profile) => ({
                      ...profile,
                      fields: profile.fields.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, label: event.target.value } : item
                      )
                    }))
                  }
                  className="focus-ring w-full min-w-48 rounded-md border border-slate-300 px-2 py-1.5"
                />
              </td>
              <td className="px-3 py-2">
                <input
                  value={field.description ?? ""}
                  onChange={(event) =>
                    updateDraft((profile) => ({
                      ...profile,
                      fields: profile.fields.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, description: event.target.value } : item
                      )
                    }))
                  }
                  className="focus-ring w-full min-w-64 rounded-md border border-slate-300 px-2 py-1.5"
                />
              </td>
              <td className="px-3 py-2">
                <input
                  type="checkbox"
                  checked={field.mandatory}
                  onChange={(event) =>
                    updateDraft((profile) => ({
                      ...profile,
                      fields: profile.fields.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, mandatory: event.target.checked } : item
                      )
                    }))
                  }
                  className="h-4 w-4 rounded border-slate-300"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CheckpointTable({
  draft,
  updateDraft
}: {
  draft: ExtractionProfile;
  updateDraft: (updater: (profile: ExtractionProfile) => ExtractionProfile) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <h3 className="mb-2 text-sm font-semibold text-ink">Checkpoints</h3>
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-normal text-slate-500">
          <tr>
            <th className="px-3 py-2">Label</th>
            <th className="px-3 py-2">Description</th>
            <th className="px-3 py-2">Mandatory</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {draft.checkpoints.map((checkpoint, index) => (
            <tr key={checkpoint.key}>
              <td className="px-3 py-2">
                <input
                  value={checkpoint.label}
                  onChange={(event) =>
                    updateDraft((profile) => ({
                      ...profile,
                      checkpoints: profile.checkpoints.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, label: event.target.value } : item
                      )
                    }))
                  }
                  className="focus-ring w-full min-w-48 rounded-md border border-slate-300 px-2 py-1.5"
                />
              </td>
              <td className="px-3 py-2">
                <input
                  value={checkpoint.description ?? ""}
                  onChange={(event) =>
                    updateDraft((profile) => ({
                      ...profile,
                      checkpoints: profile.checkpoints.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, description: event.target.value } : item
                      )
                    }))
                  }
                  className="focus-ring w-full min-w-64 rounded-md border border-slate-300 px-2 py-1.5"
                />
              </td>
              <td className="px-3 py-2">
                <input
                  type="checkbox"
                  checked={checkpoint.mandatory}
                  onChange={(event) =>
                    updateDraft((profile) => ({
                      ...profile,
                      checkpoints: profile.checkpoints.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, mandatory: event.target.checked } : item
                      )
                    }))
                  }
                  className="h-4 w-4 rounded border-slate-300"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
