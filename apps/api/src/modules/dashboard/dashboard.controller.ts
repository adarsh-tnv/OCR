import { asyncHandler } from "../../utils/async-handler.js";
import { dashboardService } from "./dashboard.service.js";

export const getDashboardStatistics = asyncHandler(async (_req, res) => {
  res.json(await dashboardService.statistics());
});

export const getDashboardCharts = asyncHandler(async (_req, res) => {
  res.json(await dashboardService.charts());
});
