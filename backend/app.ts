import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { CustomCorsOptions } from "./src/types/app.type.js";
import { userRouter } from "./src/routers/auth/users.auth.route.js";
import path from "path";
import cookieParser from "cookie-parser";
import { verificationRouter } from "./src/routers/verification/verification.route.js";
import { managerVerificationRouter } from "./src/routers/verification/manager.verification.route.js";
import { requestRouter } from "./src/routers/request/request.route.js";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const app = express();

const corsOptions: CustomCorsOptions = {
  origin: process.env.ORIGIN ?? "http://localhost:5500",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(process.env.COOKIE_SECRET));

app.use("/api/v1/users", userRouter);
app.use("/api/v1/verification", verificationRouter);
app.use("/api/v1/manager/verification", managerVerificationRouter);
app.use("/api/v1/request", requestRouter);

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  const statusCode = err.statusCode || 500;

  res.status(statusCode).json({
    statusCode,
    success: false,
    message: err.message || "Internal Server Error",
    errors: err.errors || [],
  });
});

export { app };
