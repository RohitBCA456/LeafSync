import { app } from "./app.js";
import { pool } from "./src/config/db.config.js";
import { connectRedis } from "./src/config/redis.config.js";

const PORT: number = 5000;

async function startServer() {
  try {
    const client = await pool.connect();
    client.release();
    console.log(`Database connected successfully!`);

    await connectRedis();

    const server = app.listen(PORT, () => {
      console.log(`Server is listening on port: ${PORT}`);
    });

    server.on("error", (error: Error) => {
      console.error(`Error while starting the server:`, error);
      process.exit(1);
    });
  } catch (error) { 
    console.error(`Failed to initialize application services:`, error);
    process.exit(1);
  }
}

startServer();