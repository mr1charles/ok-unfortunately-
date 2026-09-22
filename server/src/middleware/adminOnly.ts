import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/apiError.js";

export function adminOnly(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) throw ApiError.unauthorized();
  if (req.user.role !== "ADMIN") throw ApiError.forbidden("Admin access required");
  next();
}
