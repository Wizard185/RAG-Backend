import express from "express";
import cors from "cors";
import routes from "./routes/index.js";
import errorMiddleware from "./middlewares/error.middlewares.js";
import { connectMongo } from "./db/mongo.js";  // ✅ ADD THIS

const app = express();

const allowedOrigins = [
  "http://localhost:3000",
  "https://memoris-six.vercel.app",
];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));

app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: "100mb" }));

// 🔥 THIS IS THE CRITICAL PART
app.use(async (req, res, next) => {
  try {
    await connectMongo();
    next();
  } catch (err) {
    console.error("Mongo connection failed:", err);
    res.status(500).json({ message: "Database connection failed" });
  }
});

app.use("/api/v1", routes);

app.use(errorMiddleware);

export default app;