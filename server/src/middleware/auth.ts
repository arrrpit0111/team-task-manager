import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../utils/async-handler.js";
import { AppError, toPublicUser } from "../utils/http.js";

type AuthUser = {
  id: string;
  name: string;
  email: string;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const getJwtSecret = () => {
  if (process.env.JWT_SECRET) {
    return process.env.JWT_SECRET;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET is required in production");
  }

  return "local-development-secret-change-me";
};

export const signToken = (userId: string) =>
  jwt.sign({ sub: userId }, getJwtSecret(), { expiresIn: "7d" });

export const authenticate = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;

    if (!token) {
      throw new AppError(401, "Authentication required");
    }

    let userId: string | undefined;
    try {
      const payload = jwt.verify(token, getJwtSecret());
      userId = typeof payload === "object" && typeof payload.sub === "string" ? payload.sub : undefined;
    } catch {
      throw new AppError(401, "Invalid or expired token");
    }

    if (!userId) {
      throw new AppError(401, "Invalid token payload");
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true }
    });

    if (!user) {
      throw new AppError(401, "User no longer exists");
    }

    req.user = toPublicUser(user);
    next();
  }
);
