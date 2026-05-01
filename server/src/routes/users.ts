import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.js";
import { asyncHandler } from "../utils/async-handler.js";
import { normalizeEmail } from "../utils/http.js";

export const userRouter = Router();

userRouter.use(authenticate);

userRouter.get(
  "/search",
  asyncHandler(async (req, res) => {
    const email = typeof req.query.email === "string" ? normalizeEmail(req.query.email) : "";

    if (email.length < 2) {
      return res.json({ users: [] });
    }

    const users = await prisma.user.findMany({
      where: {
        email: {
          contains: email,
          mode: "insensitive"
        }
      },
      select: { id: true, name: true, email: true },
      take: 8,
      orderBy: { name: "asc" }
    });

    res.json({ users });
  })
);
