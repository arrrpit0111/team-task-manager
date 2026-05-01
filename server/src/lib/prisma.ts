import path from "node:path";
import dotenv from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), "../.env") });

const connectionString = process.env.DATABASE_URL;

if (!connectionString && process.env.NODE_ENV === "production") {
  throw new Error("DATABASE_URL is required in production");
}

const isRailwayDatabase =
  connectionString?.includes("proxy.rlwy.net") || connectionString?.includes("railway.internal");
const requiresRuntimeSsl =
  connectionString?.includes("proxy.rlwy.net") || connectionString?.includes("sslmode=require");

const runtimeConnectionString = connectionString
  ? (() => {
      const url = new URL(connectionString);
      if (isRailwayDatabase) {
        url.searchParams.delete("sslmode");
        url.searchParams.delete("sslaccept");
        url.searchParams.delete("uselibpqcompat");
      }
      return url.toString();
    })()
  : undefined;

const pool = runtimeConnectionString
  ? new pg.Pool({
      connectionString: runtimeConnectionString,
      ssl: requiresRuntimeSsl ? { rejectUnauthorized: false } : undefined
    })
  : undefined;

export const prisma = new PrismaClient({
  ...(pool ? { adapter: new PrismaPg(pool) } : {}),
  log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"]
});
