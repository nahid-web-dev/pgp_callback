import express from "express";
import dotenv from "dotenv";
import slotCityCallback from "./routes/slotCityCallback.js";
import cors from "cors";
import { prisma } from "./lib/prisma.js";

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

app.use("/api/callback", slotCityCallback);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
