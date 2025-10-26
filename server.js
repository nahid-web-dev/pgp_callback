import express from "express";
import dotenv from "dotenv";
import slotCityCallback from "./routes/slotCityCallback.js";
import cors from "cors";

dotenv.config();

const app = express();

const PORT = process.env.PORT || 4000;

app.use(
  cors({
    origin: "*", // you can restrict this to your domain later (e.g. "https://sleek-lifestyle.com")
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "callback-token"],
  })
);

app.use(express.json());

app.get("/", async (req, res) => {
  try {
    // const data = await prisma.user.findUnique({
    //   where: { phone_number: "01343032749" },
    // });

    res.json({
      success: true,
      message: "data",
    });
  } catch (error) {
    res.json({
      success: false,
      message: "error.",
    });
  }
});

app.use("/api/callback", slotCityCallback);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
