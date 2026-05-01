import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../utils/http.js";

export const notFound = (req: Request, _res: Response, next: NextFunction) => {
  next(new AppError(404, `Route not found: ${req.method} ${req.originalUrl}`));
};

export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  if (err instanceof ZodError) {
    return res.status(400).json({
      message: "Validation failed",
      issues: err.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message
      }))
    });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      message: err.message,
      details: err.details
    });
  }

  if (err instanceof Error && err.name === "PrismaClientInitializationError") {
    const isMissingDatabaseUrl = err.message.includes("DATABASE_URL");
    const isUnreachableDatabase =
      err.message.includes("Can't reach database server") || err.message.includes("Timed out fetching a new connection");

    if (isMissingDatabaseUrl || isUnreachableDatabase) {
      return res.status(503).json({
        message: isMissingDatabaseUrl
          ? "Database is not configured. Add DATABASE_URL to .env before signing up."
          : "Database is not reachable. Start PostgreSQL or update DATABASE_URL.",
        details: process.env.NODE_ENV === "production" ? undefined : err.message
      });
    }
  }

  console.error(err);
  return res.status(500).json({ message: "Something went wrong" });
};
