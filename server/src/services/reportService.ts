import { prisma } from "../lib/prisma.js";
import { ApiError } from "../utils/apiError.js";

export async function fileReport(
  reporterId: string,
  params: { targetType: "LISTING" | "AUCTION" | "USER" | "PLOT"; targetId: string; plotId?: string; reason: string }
) {
  if (!params.reason.trim()) throw ApiError.badRequest("A reason is required");
  return prisma.report.create({
    data: {
      reporterId,
      targetType: params.targetType,
      targetId: params.targetId,
      plotId: params.plotId,
      reason: params.reason.trim(),
    },
  });
}

export async function listReports(status?: string) {
  return prisma.report.findMany({
    where: status ? { status: status as never } : {},
    include: { reporter: { select: { username: true } }, plot: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function resolveReport(reportId: string, status: "RESOLVED" | "DISMISSED") {
  const report = await prisma.report.findUnique({ where: { id: reportId } });
  if (!report) throw ApiError.notFound("Report not found");
  return prisma.report.update({
    where: { id: reportId },
    data: { status, resolvedAt: new Date() },
  });
}
