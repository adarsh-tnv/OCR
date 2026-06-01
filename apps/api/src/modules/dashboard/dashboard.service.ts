import { addDays, startOfDay, subDays } from "date-fns";
import { prisma } from "../../config/prisma.js";
import { activeUploadedFileWhere } from "../files/file.repository.js";

export class DashboardService {
  async statistics() {
    const now = new Date();
    const expiringUntil = addDays(now, 60);

    const [
      totalUploads,
      pendingReview,
      processedCertificates,
      failedExtractions,
      expiringCertificates,
      ocrAggregate
    ] = await Promise.all([
      prisma.uploadedFile.count({ where: activeUploadedFileWhere }),
      prisma.uploadedFile.count({
        where: {
          AND: [activeUploadedFileWhere, { OR: [{ status: "NEEDS_REVIEW" }, { status: "FAILED" }] }]
        }
      }),
      prisma.extractedCertificate.count(),
      prisma.uploadedFile.count({ where: { ...activeUploadedFileWhere, status: "FAILED" } }),
      prisma.extractedCertificate.count({
        where: {
          expiryDate: {
            gte: now,
            lte: expiringUntil
          }
        }
      }),
      prisma.uploadedFile.aggregate({
        _avg: { ocrConfidence: true },
        where: { ocrConfidence: { not: null } }
      })
    ]);

    return {
      totalUploads,
      pendingReview,
      processedCertificates,
      failedExtractions,
      expiringCertificates,
      ocrAccuracyRate: ocrAggregate._avg.ocrConfidence ?? 0
    };
  }

  async charts() {
    const since = startOfDay(subDays(new Date(), 29));

    const [uploadRows, certificateRows] = await Promise.all([
      prisma.uploadedFile.findMany({
        where: { ...activeUploadedFileWhere, createdAt: { gte: since } },
        select: { createdAt: true }
      }),
      prisma.extractedCertificate.findMany({
        select: { certificateStandard: true, certificateStatus: true }
      })
    ]);

    const uploadsByDate = new Map<string, number>();
    uploadRows.forEach((row) => {
      const date = row.createdAt.toISOString().slice(0, 10);
      uploadsByDate.set(date, (uploadsByDate.get(date) ?? 0) + 1);
    });

    const typesByName = new Map<string, number>();
    const statusesByName = new Map<string, number>();
    certificateRows.forEach((row) => {
      const type = row.certificateStandard ?? "Unknown";
      typesByName.set(type, (typesByName.get(type) ?? 0) + 1);
      statusesByName.set(row.certificateStatus, (statusesByName.get(row.certificateStatus) ?? 0) + 1);
    });

    return {
      uploadTrends: Array.from({ length: 30 }, (_, index) => {
        const date = startOfDay(subDays(new Date(), 29 - index)).toISOString().slice(0, 10);
        return { date, count: uploadsByDate.get(date) ?? 0 };
      }),
      certificateTypes: [...typesByName.entries()]
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      statusDistribution: [...statusesByName.entries()].map(([status, count]) => ({ status, count }))
    };
  }
}

export const dashboardService = new DashboardService();
