import type { CertificateStatus, Prisma } from "@prisma/client";
import type { CertificateSearchParams } from "@iso-ocr/shared";
import { prisma } from "../../config/prisma.js";

export class CertificateRepository {
  findDuplicateByNumber(certificateNumber: string | null, excludeUploadedFileId?: string) {
    if (!certificateNumber) return Promise.resolve(null);
    return prisma.extractedCertificate.findFirst({
      where: {
        certificateNumber,
        ...(excludeUploadedFileId ? { uploadedFileId: { not: excludeUploadedFileId } } : {})
      },
      select: { id: true, uploadedFileId: true, certificateNumber: true }
    });
  }

  upsertForFile(uploadedFileId: string, data: Prisma.ExtractedCertificateUncheckedCreateInput) {
    return prisma.extractedCertificate.upsert({
      where: { uploadedFileId },
      create: data,
      update: {
        ...data,
        uploadedFileId
      }
    });
  }

  getById(id: string) {
    return prisma.extractedCertificate.findUnique({
      where: { id },
      include: {
        uploadedFile: true,
        extractionHistory: { orderBy: { createdAt: "desc" } },
        reviewerComments: { orderBy: { createdAt: "desc" } }
      }
    });
  }

  getByFileId(uploadedFileId: string) {
    return prisma.extractedCertificate.findUnique({
      where: { uploadedFileId },
      include: {
        uploadedFile: true,
        extractionHistory: { orderBy: { createdAt: "desc" } },
        reviewerComments: { orderBy: { createdAt: "desc" } }
      }
    });
  }

  list(params: CertificateSearchParams) {
    const where: Prisma.ExtractedCertificateWhereInput = {};
    const and: Prisma.ExtractedCertificateWhereInput[] = [];

    if (params.query) {
      and.push({
        OR: [
          { certificateNumber: { contains: params.query, mode: "insensitive" } },
          { organizationName: { contains: params.query, mode: "insensitive" } },
          { certificateStandard: { contains: params.query, mode: "insensitive" } },
          { certificationBody: { contains: params.query, mode: "insensitive" } }
        ]
      });
    }

    if (params.certificateNumber) {
      and.push({ certificateNumber: { contains: params.certificateNumber, mode: "insensitive" } });
    }
    if (params.organizationName) {
      and.push({ organizationName: { contains: params.organizationName, mode: "insensitive" } });
    }
    if (params.certificateStandard) {
      and.push({ certificateStandard: { contains: params.certificateStandard, mode: "insensitive" } });
    }
    if (params.certificationBody) {
      and.push({ certificationBody: { contains: params.certificationBody, mode: "insensitive" } });
    }
    if (params.status) {
      and.push({ certificateStatus: params.status as CertificateStatus });
    }
    if (params.expiryFrom || params.expiryTo) {
      and.push({
        expiryDate: {
          ...(params.expiryFrom ? { gte: new Date(params.expiryFrom) } : {}),
          ...(params.expiryTo ? { lte: new Date(params.expiryTo) } : {})
        }
      });
    }
    if (params.confidenceMin !== undefined || params.confidenceMax !== undefined) {
      and.push({
        confidenceScore: {
          ...(params.confidenceMin !== undefined ? { gte: params.confidenceMin } : {}),
          ...(params.confidenceMax !== undefined ? { lte: params.confidenceMax } : {})
        }
      });
    }
    if (params.uploadedFrom || params.uploadedTo) {
      and.push({
        uploadedFile: {
          createdAt: {
            ...(params.uploadedFrom ? { gte: new Date(params.uploadedFrom) } : {}),
            ...(params.uploadedTo ? { lte: new Date(params.uploadedTo) } : {})
          }
        }
      });
    }

    if (and.length) where.AND = and;

    const skip = (params.page - 1) * params.pageSize;

    return Promise.all([
      prisma.extractedCertificate.count({ where }),
      prisma.extractedCertificate.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: params.pageSize,
        include: {
          uploadedFile: true
        }
      })
    ]);
  }

  update(id: string, data: Prisma.ExtractedCertificateUpdateInput) {
    return prisma.extractedCertificate.update({
      where: { id },
      data,
      include: {
        uploadedFile: true,
        extractionHistory: { orderBy: { createdAt: "desc" } },
        reviewerComments: { orderBy: { createdAt: "desc" } }
      }
    });
  }

  addComment(data: {
    uploadedFileId: string;
    certificateId?: string;
    authorName: string;
    comment: string;
  }) {
    const createData: Prisma.ReviewerCommentUncheckedCreateInput = {
      uploadedFileId: data.uploadedFileId,
      authorName: data.authorName,
      comment: data.comment
    };
    if (data.certificateId !== undefined) createData.certificateId = data.certificateId;

    return prisma.reviewerComment.create({
      data: createData,
      include: { certificate: true }
    });
  }
}

export const certificateRepository = new CertificateRepository();
