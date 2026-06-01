import { Router } from "express";
import { getDashboardCharts, getDashboardStatistics } from "./dashboard.controller.js";

export const dashboardRoutes = Router();

dashboardRoutes.get("/statistics", getDashboardStatistics);
dashboardRoutes.get("/charts", getDashboardCharts);
