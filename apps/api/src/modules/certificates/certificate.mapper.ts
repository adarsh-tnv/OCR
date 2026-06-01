import type { Prisma } from "@prisma/client";
import type { ExtractedCertificatePayload, UpdateCertificatePayload } from "@iso-ocr/shared";
import { parseCertificateDate } from "../../utils/parse-date.js";

export const payloadToPrismaCreate = (input: {
  uploadedFileId: string;
  payload: ExtractedCertificatePayload;
  validationFlags: string[];
}): Prisma.ExtractedCertificateUncheckedCreateInput => {
  const payload = input.payload;
  return {
    uploadedFileId: input.uploadedFileId,
    documentType: payload.document_type,
    certificateStandard: payload.certificate_standard,
    certificateNumber: payload.certificate_number,
    organizationName: payload.organization_name,
    organizationAddress: payload.organization_address,
    scopeOfCertification: payload.scope_of_certification,
    certificationBody: payload.certification_body,
    accreditationBody: payload.accreditation_body,
    issueDate: parseCertificateDate(payload.issue_date),
    expiryDate: parseCertificateDate(payload.expiry_date),
    originalCertificationDate: parseCertificateDate(payload.original_certification_date),
    surveillanceDates: payload.surveillance_dates as Prisma.InputJsonValue,
    iafCodes: payload.iaf_codes as Prisma.InputJsonValue,
    eaCodes: payload.ea_codes as Prisma.InputJsonValue,
    authorizedSignatory: payload.authorized_signatory,
    siteAddresses: payload.site_addresses as Prisma.InputJsonValue,
    registrationNumbers: payload.registration_numbers as Prisma.InputJsonValue,
    qrCodeDetected: payload.qr_code_detected,
    sealDetected: payload.seal_detected,
    logoDetected: payload.logo_detected,
    certificateStatus: payload.certificate_status,
    confidenceScore: payload.confidence_score,
    possibleIssues: payload.possible_issues as Prisma.InputJsonValue,
    validationFlags: input.validationFlags as Prisma.InputJsonValue,
    normalizedPayload: payload as Prisma.InputJsonValue,
    rawSummary: payload.raw_summary
  };
};

export const payloadToPrismaUpdate = (
  payload: UpdateCertificatePayload,
  normalizedPayload: Record<string, unknown>
): Prisma.ExtractedCertificateUpdateInput => {
  const data: Prisma.ExtractedCertificateUpdateInput = {
    normalizedPayload: normalizedPayload as Prisma.InputJsonValue
  };

  if (payload.document_type !== undefined) data.documentType = payload.document_type;
  if (payload.certificate_standard !== undefined) data.certificateStandard = payload.certificate_standard;
  if (payload.certificate_number !== undefined) data.certificateNumber = payload.certificate_number;
  if (payload.organization_name !== undefined) data.organizationName = payload.organization_name;
  if (payload.organization_address !== undefined) data.organizationAddress = payload.organization_address;
  if (payload.scope_of_certification !== undefined) data.scopeOfCertification = payload.scope_of_certification;
  if (payload.certification_body !== undefined) data.certificationBody = payload.certification_body;
  if (payload.accreditation_body !== undefined) data.accreditationBody = payload.accreditation_body;
  if (payload.issue_date !== undefined) data.issueDate = parseCertificateDate(payload.issue_date);
  if (payload.expiry_date !== undefined) data.expiryDate = parseCertificateDate(payload.expiry_date);
  if (payload.original_certification_date !== undefined) {
    data.originalCertificationDate = parseCertificateDate(payload.original_certification_date);
  }
  if (payload.surveillance_dates !== undefined) data.surveillanceDates = payload.surveillance_dates as Prisma.InputJsonValue;
  if (payload.iaf_codes !== undefined) data.iafCodes = payload.iaf_codes as Prisma.InputJsonValue;
  if (payload.ea_codes !== undefined) data.eaCodes = payload.ea_codes as Prisma.InputJsonValue;
  if (payload.authorized_signatory !== undefined) data.authorizedSignatory = payload.authorized_signatory;
  if (payload.site_addresses !== undefined) data.siteAddresses = payload.site_addresses as Prisma.InputJsonValue;
  if (payload.registration_numbers !== undefined) data.registrationNumbers = payload.registration_numbers as Prisma.InputJsonValue;
  if (payload.qr_code_detected !== undefined) data.qrCodeDetected = payload.qr_code_detected;
  if (payload.seal_detected !== undefined) data.sealDetected = payload.seal_detected;
  if (payload.logo_detected !== undefined) data.logoDetected = payload.logo_detected;
  if (payload.certificate_status !== undefined) data.certificateStatus = payload.certificate_status;
  if (payload.confidence_score !== undefined) data.confidenceScore = payload.confidence_score;
  if (payload.possible_issues !== undefined) data.possibleIssues = payload.possible_issues as Prisma.InputJsonValue;
  if (payload.raw_summary !== undefined) data.rawSummary = payload.raw_summary;

  return data;
};
