import {
  certificateSearchSchema,
  extractedCertificateSchema,
  reviewerCommentSchema,
  updateCertificateSchema,
  type ExtractedCertificatePayload,
  type UpdateCertificatePayload
} from "@iso-ocr/shared";
import type { Prisma } from "@prisma/client";
import { fileRepository } from "../files/file.repository.js";
import type { OcrResult } from "../ocr/ocr.types.js";
import { certificateValidationService } from "../validation/certificate-validation.service.js";
import { notFound } from "../../utils/api-error.js";
import { payloadToPrismaCreate, payloadToPrismaUpdate } from "./certificate.mapper.js";
import { certificateRepository } from "./certificate.repository.js";

const asObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

export class CertificateService {
  async persistExtraction(fileId: string, payload: ExtractedCertificatePayload, ocr: OcrResult) {
    const duplicate = await certificateRepository.findDuplicateByNumber(payload.certificate_number, fileId);
    const validation = certificateValidationService.validate({
      payload,
      ocr,
      duplicateCertificateId: duplicate?.id ?? null
    });

    const finalPayload = extractedCertificateSchema.parse({
      ...payload,
      qr_code_detected: payload.qr_code_detected || ocr.visualSignals.qrCodeDetected,
      seal_detected: payload.seal_detected || ocr.visualSignals.sealDetected,
      logo_detected: payload.logo_detected || ocr.visualSignals.logoDetected,
      certificate_status: validation.status,
      confidence_score: validation.confidenceScore,
      possible_issues: validation.possibleIssues
    });

    const certificate = await certificateRepository.upsertForFile(
      fileId,
      payloadToPrismaCreate({
        uploadedFileId: fileId,
        payload: finalPayload,
        validationFlags: validation.validationFlags
      })
    );

    await fileRepository.createHistory({
      uploadedFileId: fileId,
      certificateId: certificate.id,
      action: "EXTRACTION_COMPLETED",
      after: finalPayload as Prisma.InputJsonValue
    });

    await fileRepository.createHistory({
      uploadedFileId: fileId,
      certificateId: certificate.id,
      action: "VALIDATION_COMPLETED",
      after: {
        status: validation.status,
        validationFlags: validation.validationFlags,
        possibleIssues: validation.possibleIssues
      }
    });

    await fileRepository.updateStatus(fileId, validation.status === "valid" ? "VALIDATED" : "NEEDS_REVIEW", {
      processingEndedAt: new Date()
    });

    return certificate;
  }

  async list(rawQuery: unknown) {
    const query = certificateSearchSchema.parse(rawQuery);
    const [total, items] = await certificateRepository.list(query);

    return {
      items,
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize)
    };
  }

  async getById(id: string) {
    const certificate = await certificateRepository.getById(id);
    if (!certificate) throw notFound("Certificate");
    return certificate;
  }

  async getByFileId(fileId: string) {
    const certificate = await certificateRepository.getByFileId(fileId);
    if (!certificate) throw notFound("Certificate");
    return certificate;
  }

  async update(id: string, rawPayload: unknown) {
    const payload = updateCertificateSchema.parse(rawPayload);
    const current = await this.getById(id);
    const { reviewer_comment: reviewerComment, ...patch } = payload;
    const normalizedPayload = {
      ...asObject(current.normalizedPayload),
      ...patch
    };

    const mergedPayload = extractedCertificateSchema.parse({
      ...asObject(current.normalizedPayload),
      ...patch,
      surveillance_dates:
        "surveillance_dates" in patch ? patch.surveillance_dates : current.surveillanceDates,
      iaf_codes: "iaf_codes" in patch ? patch.iaf_codes : current.iafCodes,
      ea_codes: "ea_codes" in patch ? patch.ea_codes : current.eaCodes,
      site_addresses: "site_addresses" in patch ? patch.site_addresses : current.siteAddresses,
      registration_numbers:
        "registration_numbers" in patch ? patch.registration_numbers : current.registrationNumbers,
      possible_issues: "possible_issues" in patch ? patch.possible_issues : current.possibleIssues,
      qr_code_detected: "qr_code_detected" in patch ? patch.qr_code_detected : current.qrCodeDetected,
      seal_detected: "seal_detected" in patch ? patch.seal_detected : current.sealDetected,
      logo_detected: "logo_detected" in patch ? patch.logo_detected : current.logoDetected,
      confidence_score: "confidence_score" in patch ? patch.confidence_score : current.confidenceScore,
      certificate_status:
        "certificate_status" in patch ? patch.certificate_status : current.certificateStatus
    });

    const duplicate = await certificateRepository.findDuplicateByNumber(
      mergedPayload.certificate_number,
      current.uploadedFileId
    );
    const validation = certificateValidationService.validate({
      payload: mergedPayload,
      duplicateCertificateId: duplicate?.id ?? null,
      ocr: {
        rawText: current.uploadedFile.ocrText ?? "",
        tables: (current.uploadedFile.tables as never) ?? [],
        formFields: (current.uploadedFile.formFields as never) ?? [],
        pageMetadata: (current.uploadedFile.pageMetadata as never) ?? [],
        pageCount: current.uploadedFile.pageCount ?? 0,
        language: current.uploadedFile.language,
        confidence: current.uploadedFile.ocrConfidence,
        visualSignals: {
          qrCodeDetected: current.qrCodeDetected,
          sealDetected: current.sealDetected,
          logoDetected: current.logoDetected
        }
      }
    });

    const finalPayload = extractedCertificateSchema.parse({
      ...mergedPayload,
      certificate_status: validation.status,
      confidence_score: validation.confidenceScore,
      possible_issues: validation.possibleIssues
    });

    const updated = await certificateRepository.update(id, {
      ...payloadToPrismaUpdate(patch as UpdateCertificatePayload, {
        ...normalizedPayload,
        certificate_status: finalPayload.certificate_status,
        confidence_score: finalPayload.confidence_score,
        possible_issues: finalPayload.possible_issues
      }),
      certificateStatus: finalPayload.certificate_status,
      confidenceScore: finalPayload.confidence_score,
      possibleIssues: finalPayload.possible_issues,
      validationFlags: validation.validationFlags,
      reviewedAt: new Date(),
      reviewedBy: "Reviewer"
    });

    const historyUpdate: Parameters<typeof fileRepository.createHistory>[0] = {
      uploadedFileId: current.uploadedFileId,
      certificateId: id,
      action: "UPDATED",
      before: asObject(current.normalizedPayload) as Prisma.InputJsonValue,
      after: finalPayload as Prisma.InputJsonValue,
      actorName: "Reviewer"
    };

    if (reviewerComment) historyUpdate.note = reviewerComment;
    await fileRepository.createHistory(historyUpdate);

    if (reviewerComment) {
      await this.addComment(id, {
        authorName: "Reviewer",
        comment: reviewerComment
      });
    }

    await fileRepository.updateStatus(current.uploadedFileId, "VALIDATED");
    return updated;
  }

  async addComment(certificateId: string, rawPayload: unknown) {
    const payload = reviewerCommentSchema.parse(rawPayload);
    const certificate = await this.getById(certificateId);
    const comment = await certificateRepository.addComment({
      uploadedFileId: certificate.uploadedFileId,
      certificateId,
      authorName: payload.authorName,
      comment: payload.comment
    });

    await fileRepository.createHistory({
      uploadedFileId: certificate.uploadedFileId,
      certificateId,
      action: "COMMENTED",
      actorName: payload.authorName,
      note: payload.comment
    });

    return comment;
  }
}

export const certificateService = new CertificateService();
