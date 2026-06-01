import { prisma } from "../../config/prisma.js";

export class ReviewService {
  async queue() {
    return prisma.extractedCertificate.findMany({
      where: {
        OR: [
          { certificateStatus: "pending_review" },
          { certificateStatus: "suspicious" },
          { certificateStatus: "incomplete" },
          { uploadedFile: { status: "NEEDS_REVIEW" } }
        ]
      },
      include: {
        uploadedFile: true,
        reviewerComments: { orderBy: { createdAt: "desc" }, take: 3 }
      },
      orderBy: [
        { confidenceScore: "asc" },
        { createdAt: "desc" }
      ]
    });
  }
}

export const reviewService = new ReviewService();
