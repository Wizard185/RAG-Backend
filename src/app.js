import express from "express";
import cors from "cors";
import routes from "./routes/index.js";
import errorMiddleware from "./middlewares/error.middlewares.js";

const app = express();
const allowedOrigins = [
  "http://localhost:3000", // Your local Next.js dev server
  "https://memoris-six.vercel.app", // Your production Vercel URL
];
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
    },
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  credentials: true, // Required if you pass cookies or Authorization headers
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

app.use(express.urlencoded({ extended: true }));
 // Adjust the origin as needed
app.use(express.json({limit: "100mb"})); 

app.use("/api/v1", routes);

// Global error handler (ALWAYS LAST)
app.use(errorMiddleware);

export default app;
