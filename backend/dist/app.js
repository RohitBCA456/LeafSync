import express from "express";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config({ path: "./.env" });
const app = express();
const corsOptions = {
    origin: process.env.ORIGIN ?? "http://localhost:5000",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
export { app };
//# sourceMappingURL=app.js.map