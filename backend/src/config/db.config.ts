import pg from "pg";
import dotenv from "dotenv";
import path  from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const { Pool } = pg;

export const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: String(process.env.DB_PASSWORD),
});

