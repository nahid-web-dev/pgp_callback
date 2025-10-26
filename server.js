import express from "express";
import dotenv from "dotenv";
import slotCityCallback from "./routes/slotCityCallback.js";
import cors from "cors";

dotenv.config();

const app = express();

app.use(
  cors({
    origin: "*", // you can restrict this to your domain later (e.g. "https://sleek-lifestyle.com")
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "callback-token"],
  })
);

app.use(express.json());

app.use("/api/callback", slotCityCallback);

app.listen(4000, () => {
  console.log("Server running on port 3000");
});
