import { app } from "./app.js";
import { pool } from "./src/config/db.config.js";

const PORT: number = 5000;

pool
  .connect()
  .then((client) => {
    client.release();
    console.log(`database is connected successfully!`);

    const server = app.listen(PORT, () => {
      console.log(`server is listening on port: `, PORT);
    });

    server.on("error", (error: Error) => {
      console.log(`error while connecting to the server!`);
      throw error;
    });
  })
  .catch((error: Error) => {
    console.log(`error while connecting to the database!`);
    process.exit(1);
  });