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

app.post("/", async (req, res) => {
  try {
    // const data = await prisma.user.findUnique({
    //   where: { phone_number: "01343032749" },
    // });

    // await prisma.user.create({
    //   data: {
    //     phone_number: "01333333333",
    //     balance: 100,
    //     password: "0000",
    //     ip: "test",
    //     fp_id: "test",
    //   },
    // });

    const [user, betRecord] = await Promise.all([
      prisma.user.findUnique({ where: { phone_number: "01333333333" } }),
      prisma.gameTransaction.findUnique({
        where: { trans_id: "1" },
      }),
    ]);

    await prisma.$transaction([
      prisma.gameTransaction.create({
        data: {
          trans_id: String(Date.now()),
          user_id: user.id,
          type: "BET",
          amount: 1,
          game_code: "299",
        },
      }),
      prisma.user.update({
        where: { id: user.id },
        data: { balance: { decrement: 10 } },
      }),
    ]);

    return res.json({
      result: 0,
      status: "OK",
      data: { balance: user.balance - 10 },
    });

    // res.json({
    //   success: true,
    //   user,
    //   betRecord,
    // });
  } catch (error) {
    console.log(error?.message);
    res.json({
      success: false,
      message: "error.",
    });
  }
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
