import express from "express";
import dotenv from "dotenv";
import slotCityCallback from "./routes/slotCityCallback.js";
import cors from "cors";
import { prisma } from "./lib/prisma.js";
import OkpayPayInRouter from "./routes/payin/okpay/route.js";
import OkpayPayInWebhookRouter from "./routes/payin/okpay/webhook.js";
import OkpayPayOutRouter from "./routes/payout/okpay/route.js";
import OkpayPayOutWebhookRouter from "./routes/payout/okpay/webhook.js";
import cookieParser from "cookie-parser";
import { authMiddleware } from "./middleware/auth.js";

dotenv.config();

const app = express();

const PORT = process.env.PORT || 4000;

// dynamic origin handling
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "authorization", "callback-token"],
  })
);

app.use(express.json());

app.use(cookieParser());

app.get("/", async (req, res) => {
  res.json({
    msg: "Server is reachable!",
  });
});

app.get("/add-balance", async (req, res) => {
  try {
    const updatedUser = await prisma.user.update({
      where: { phone_number: "01343032749" },
      data: { balance: 100 },
    });
    res.json({
      success: true,
      user: updatedUser,
    });
  } catch (error) {
    res.json({
      success: false,
      message: "error.",
    });
  }
});

// Game Callback

app.use("/api/callback", slotCityCallback);

// Payin routes

app.use("/api/create-payin/okpay", authMiddleware, OkpayPayInRouter);
app.use("api/create-payin/okpay/webhook", OkpayPayInWebhookRouter);

// Payout routes

app.use("/api/create-payout/okpay", authMiddleware, OkpayPayOutRouter);
app.use("/api/create-payout/okpay/webhook", OkpayPayOutWebhookRouter);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
