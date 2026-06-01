import { z } from "zod";
import { asyncHandler } from "../../utils/async-handler.js";
import { jsonSafe } from "../../utils/json-safe.js";
import { exportService } from "./export.service.js";

const exportQuerySchema = z.object({
  format: z.enum(["json", "csv", "xlsx", "pdf"]).default("json")
});

export const exportCertificate = asyncHandler(async (req, res) => {
  const { format } = exportQuerySchema.parse(req.query);
  const id = req.params.id as string;

  if (format === "json") {
    res.json(jsonSafe(await exportService.exportJson(id)));
    return;
  }

  if (format === "csv") {
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="certificate-${id}.csv"`);
    res.send(await exportService.exportCsv(id));
    return;
  }

  if (format === "xlsx") {
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="certificate-${id}.xlsx"`);
    res.send(Buffer.from(await exportService.exportExcel(id)));
    return;
  }

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="certificate-${id}.pdf"`);
  res.send(await exportService.exportPdf(id));
});
