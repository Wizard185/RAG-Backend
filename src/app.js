import express from "express";
import cors from "cors";
import routes from "./routes/index.js";
import errorMiddleware from "./middlewares/error.middlewares.js";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api", routes);

// Global error handler (ALWAYS LAST)
app.use(errorMiddleware);

export default app;
