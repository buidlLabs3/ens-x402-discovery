import type { NextFunction, Request, Response } from "express";
import { AppError } from "../errors";

const requiredFields = ["ensName", "owner", "endpoint", "paymentScheme", "network"] as const;

export function validateRegisterServiceRequest(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (!req.body || typeof req.body !== "object") {
    next(new AppError(400, "invalid_request_body", "Request body must be a JSON object"));
    return;
  }

  for (const field of requiredFields) {
    const value = req.body[field];
    if (typeof value !== "string" || value.trim().length === 0) {
      next(new AppError(400, "invalid_request_field", `Field '${field}' is required`, { field }));
      return;
    }
  }

  if (
    req.body.capabilities !== undefined &&
    (!Array.isArray(req.body.capabilities) ||
      req.body.capabilities.some((item: unknown) => typeof item !== "string"))
  ) {
    next(
      new AppError(
        400,
        "invalid_request_field",
        "Field 'capabilities' must be an array of strings"
      )
    );
    return;
  }

  next();
}
