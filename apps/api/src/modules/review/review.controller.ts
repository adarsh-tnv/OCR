import { asyncHandler } from "../../utils/async-handler.js";
import { jsonSafe } from "../../utils/json-safe.js";
import { reviewService } from "./review.service.js";

export const getReviewQueue = asyncHandler(async (_req, res) => {
  const data = await reviewService.queue();
  res.json(jsonSafe({ items: data }));
});
