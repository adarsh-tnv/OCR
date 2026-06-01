import { Router } from "express";
import { getReviewQueue } from "./review.controller.js";

export const reviewRoutes = Router();

reviewRoutes.get("/queue", getReviewQueue);
