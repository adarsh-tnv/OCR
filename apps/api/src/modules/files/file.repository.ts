import type { FileStatus, HistoryAction, JobStatus, JobType, Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma.js";

export const activeUploadedFileWhere: Prisma.UploadedFileWhereInput = {
  OR: [{ deletedAt: null }, { deletedAt: { isSet: false } }]
};

export class FileRepository {
  createUploadedFile(data: Prisma.UploadedFileCreateInput) {
    return prisma.uploadedFile.create({ data });
  }

  findById(id: string) {
    return prisma.uploadedFile.findFirst({
      where: { id, ...activeUploadedFileWhere },
      include: {
        extractedCertificate: true,
        processingJobs: { orderBy: { createdAt: "desc" }, take: 5 }
      }
    });
  }

  list(params: { status?: FileStatus; skip: number; take: number }) {
    const where: Prisma.UploadedFileWhereInput = {
      ...activeUploadedFileWhere,
      ...(params.status ? { status: params.status } : {})
    };

    return Promise.all([
      prisma.uploadedFile.count({ where }),
      prisma.uploadedFile.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: params.skip,
        take: params.take,
        include: {
          extractedCertificate: true,
          processingJobs: { orderBy: { createdAt: "desc" }, take: 1 }
        }
      })
    ]);
  }

  updateStatus(id: string, status: FileStatus, data: Prisma.UploadedFileUpdateInput = {}) {
    return prisma.uploadedFile.update({
      where: { id },
      data: {
        ...data,
        status
      }
    });
  }

  updateOcrResult(id: string, data: Prisma.UploadedFileUpdateInput) {
    return prisma.uploadedFile.update({
      where: { id },
      data
    });
  }

  updateCustomExtractions(id: string, customExtractions: Prisma.InputJsonValue) {
    return prisma.uploadedFile.update({
      where: { id },
      data: { customExtractions }
    });
  }

  updateChatMessages(id: string, chatMessages: Prisma.InputJsonValue) {
    return prisma.uploadedFile.update({
      where: { id },
      data: { chatMessages }
    });
  }

  softDelete(id: string) {
    return prisma.uploadedFile.update({
      where: { id },
      data: {
        status: "DELETED",
        deletedAt: new Date()
      }
    });
  }

  createProcessingJob(data: {
    uploadedFileId: string;
    jobType: JobType;
    status?: JobStatus;
    maxAttempts: number;
    metadata?: Prisma.InputJsonValue;
  }) {
    const createData: Prisma.ProcessingJobUncheckedCreateInput = {
      uploadedFileId: data.uploadedFileId,
      jobType: data.jobType,
      status: data.status ?? "QUEUED",
      maxAttempts: data.maxAttempts
    };
    if (data.metadata !== undefined) createData.metadata = data.metadata;

    return prisma.processingJob.create({
      data: createData
    });
  }

  updateProcessingJob(id: string, data: Prisma.ProcessingJobUpdateInput) {
    return prisma.processingJob.update({
      where: { id },
      data
    });
  }

  createHistory(data: {
    uploadedFileId: string;
    certificateId?: string;
    action: HistoryAction;
    before?: Prisma.InputJsonValue;
    after?: Prisma.InputJsonValue;
    actorName?: string;
    note?: string;
  }) {
    const createData: Prisma.ExtractionHistoryUncheckedCreateInput = {
      uploadedFileId: data.uploadedFileId,
      action: data.action
    };
    if (data.certificateId !== undefined) createData.certificateId = data.certificateId;
    if (data.before !== undefined) createData.before = data.before;
    if (data.after !== undefined) createData.after = data.after;
    if (data.actorName !== undefined) createData.actorName = data.actorName;
    if (data.note !== undefined) createData.note = data.note;

    return prisma.extractionHistory.create({
      data: createData
    });
  }
}

export const fileRepository = new FileRepository();
