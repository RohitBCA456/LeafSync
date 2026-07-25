import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { CustomCorsOptions } from "./types/app.js";

dotenv.config({ path: "./.env" });

const app = express();

const corsOptions: CustomCorsOptions = {
  origin: process.env.ORIGIN ?? "http://localhost:5173",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
