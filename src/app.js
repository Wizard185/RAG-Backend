import express from "express";
import cors from "cors";
import routes from "./routes/index.js";
import errorMiddleware from "./middlewares/error.middlewares.js";

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(cors({origin:"http://localhost:3000", credentials: true})); // Adjust the origin as needed
app.use(express.json({limit: "100mb"})); 

app.use("/api/v1", routes);

// Global error handler (ALWAYS LAST)
app.use(errorMiddleware);

export default app;
