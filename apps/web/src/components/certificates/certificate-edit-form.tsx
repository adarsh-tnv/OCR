"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";
import { z } from "zod";
import type { CertificateRecord } from "@/types/api";

const formSchema = z.object({
  certificate_standard: z.string().optional(),
  certificate_number: z.string().optional(),
  organization_name: z.string().optional(),
  organization_address: z.string().optional(),
  scope_of_certification: z.string().optional(),
  certification_body: z.string().optional(),
  accreditation_body: z.string().optional(),
  issue_date: z.string().optional(),
  expiry_date: z.string().optional(),
  original_certification_date: z.string().optional(),
  authorized_signatory: z.string().optional(),
  certificate_status: z.enum(["valid", "expired", "suspicious", "incomplete", "pending_review", "unknown"]),
  surveillance_dates: z.string().optional(),
  iaf_codes: z.string().optional(),
  ea_codes: z.string().optional(),
  site_addresses: z.string().optional(),
  registration_numbers: z.string().optional(),
  reviewer_comment: z.string().optional()
});

type FormValues = z.infer<typeof formSchema>;

const dateValue = (value: string | null) => (value ? value.slice(0, 10) : "");
const textValue = (value: string | null) => value ?? "";
const payloadText = (payload: Record<string, unknown>, key: string) => {
  const value = payload[key];
  return typeof value === "string" ? value : null;
};
const payloadArray = (payload: Record<string, unknown>, key: string) => {
  const value = payload[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : null;
};
const normalizedDateValue = (value: string | null | undefined) => {
  if (!value) return "";
  const trimmed = value.trim();
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const slashDate = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (slashDate) {
    const [, day, month, year] = slashDate;
    if (!day || !month || !year) return "";
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  return "";
};
const arrayValue = (value: string[]) => value.join("\n");
const arrayFromTextarea = (value?: string) =>
  (value ?? "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
const nullable = (value?: string) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

export function CertificateEditForm({
  certificate,
  onSubmit,
  submitting
}: {
  certificate: CertificateRecord;
  onSubmit: (payload: Record<string, unknown>) => void;
  submitting?: boolean;
}) {
  const normalizedPayload = certificate.normalizedPayload ?? {};
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      certificate_standard: textValue(certificate.certificateStandard),
      certificate_number: textValue(certificate.certificateNumber),
      organization_name: textValue(certificate.organizationName),
      organization_address: textValue(payloadText(normalizedPayload, "organization_address") ?? certificate.organizationAddress),
      scope_of_certification: textValue(certificate.scopeOfCertification),
      certification_body: textValue(certificate.certificationBody),
      accreditation_body: textValue(certificate.accreditationBody),
      issue_date: normalizedDateValue(payloadText(normalizedPayload, "issue_date")) || dateValue(certificate.issueDate),
      expiry_date: normalizedDateValue(payloadText(normalizedPayload, "expiry_date")) || dateValue(certificate.expiryDate),
      original_certification_date:
        normalizedDateValue(payloadText(normalizedPayload, "original_certification_date")) ||
        dateValue(certificate.originalCertificationDate),
      authorized_signatory: textValue(certificate.authorizedSignatory),
      certificate_status: certificate.certificateStatus,
      surveillance_dates: arrayValue(payloadArray(normalizedPayload, "surveillance_dates") ?? certificate.surveillanceDates),
      iaf_codes: arrayValue(certificate.iafCodes),
      ea_codes: arrayValue(certificate.eaCodes),
      site_addresses: arrayValue(payloadArray(normalizedPayload, "site_addresses") ?? certificate.siteAddresses),
      registration_numbers: arrayValue(certificate.registrationNumbers),
      reviewer_comment: ""
    }
  });

  const submit = form.handleSubmit((values) => {
    onSubmit({
      certificate_standard: nullable(values.certificate_standard),
      certificate_number: nullable(values.certificate_number),
      organization_name: nullable(values.organization_name),
      organization_address: nullable(values.organization_address),
      scope_of_certification: nullable(values.scope_of_certification),
      certification_body: nullable(values.certification_body),
      accreditation_body: nullable(values.accreditation_body),
      issue_date: nullable(values.issue_date),
      expiry_date: nullable(values.expiry_date),
      original_certification_date: nullable(values.original_certification_date),
      authorized_signatory: nullable(values.authorized_signatory),
      certificate_status: values.certificate_status,
      surveillance_dates: arrayFromTextarea(values.surveillance_dates),
      iaf_codes: arrayFromTextarea(values.iaf_codes),
      ea_codes: arrayFromTextarea(values.ea_codes),
      site_addresses: arrayFromTextarea(values.site_addresses),
      registration_numbers: arrayFromTextarea(values.registration_numbers),
      reviewer_comment: nullable(values.reviewer_comment)
    });
  });

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Certificate standard" register={form.register("certificate_standard")} />
        <Field label="Certificate number" register={form.register("certificate_number")} />
        <Field label="Certified entity name" register={form.register("organization_name")} />
        <Field label="Certification body / issuer" register={form.register("certification_body")} />
        <Field label="Accreditation body" register={form.register("accreditation_body")} />
        <Field label="Authorized signatory" register={form.register("authorized_signatory")} />
        <Field label="Issue date" type="date" register={form.register("issue_date")} />
        <Field label="Validity / expiry date" type="date" register={form.register("expiry_date")} />
        <Field label="Original certification date" type="date" register={form.register("original_certification_date")} />
        <label>
          <span className="text-xs font-medium text-slate-600">Status</span>
          <select
            {...form.register("certificate_status")}
            className="focus-ring mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="valid">Valid</option>
            <option value="expired">Expired</option>
            <option value="suspicious">Suspicious</option>
            <option value="incomplete">Incomplete</option>
            <option value="pending_review">Pending review</option>
            <option value="unknown">Unknown</option>
          </select>
        </label>
      </div>

      <Textarea label="Issuer address" register={form.register("organization_address")} />
      <Textarea label="Scope of certification" register={form.register("scope_of_certification")} />
      <Textarea label="Certification site address" register={form.register("site_addresses")} />
      <Textarea label="Surveillance dates" register={form.register("surveillance_dates")} />
      <Textarea label="IAF codes" register={form.register("iaf_codes")} />
      <Textarea label="EA codes" register={form.register("ea_codes")} />
      <Textarea label="Registration numbers" register={form.register("registration_numbers")} />
      <Textarea label="Reviewer comment" register={form.register("reviewer_comment")} />

      <button
        type="submit"
        disabled={submitting}
        className="focus-ring inline-flex items-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-60"
      >
        <Save className="h-4 w-4" />
        Save correction
      </button>
    </form>
  );
}

function Field({
  label,
  register,
  type = "text"
}: {
  label: string;
  register: UseFormRegisterReturn;
  type?: string;
}) {
  return (
    <label>
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <input
        type={type}
        {...register}
        className="focus-ring mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
      />
    </label>
  );
}

function Textarea({
  label,
  register
}: {
  label: string;
  register: UseFormRegisterReturn;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <textarea
        rows={3}
        {...register}
        className="focus-ring mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
      />
    </label>
  );
}
