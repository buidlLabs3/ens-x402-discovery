import type { NextFunction, Request, Response } from "express";
import { AppError } from "../errors";

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        details: error.details ?? {},
      },
    });
    return;
  }

  console.error("Unhandled error", error);
  res.status(500).json({
    error: {
      code: "internal_error",
      message: "Internal server error",
    },
  });
}
