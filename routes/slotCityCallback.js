import express from "express";
import { prisma } from "../lib/prisma.js";

const router = express.Router();

// POST callback route
router.post("/", async (req, res) => {
  try {
    const CALLBACK_TOKEN = process.env.SLOT_CITY_CALLBACK_TOKEN;
    const ip = req.headers["x-forwarded-for"];

    const token = req.headers["callback-token"];
    if (token !== CALLBACK_TOKEN) {
      return res.json({ result: 100, status: "ERROR" });
    }

    const { command, data, check } = req.body;
    const checks = check.split(",");

    const [user, betRecord] = await Promise.all([
      prisma.user.findUnique({ where: { phone_number: data.account } }),
      prisma.gameTransaction.findUnique({
        where: { trans_id: String(data.trans_id) },
      }),
    ]);

    // --- Validation ---
    for (const c of checks) {
      const num = parseInt(c);
      switch (num) {
        case 21: // user verify
          if (!user) return res.json({ result: 21, status: "ERROR" });
          break;

        case 22: // user active check
          if (user.status && user.status !== "Active")
            return res.json({ result: 22, status: "ERROR" });
          break;

        case 31: // balance check
          if (user.balance < data.amount)
            return res.json({
              result: 31,
              status: "ERROR",
              data: { balance: user.balance },
            });
          break;

        case 41:
        case 42:
          if (num === 41 && betRecord)
            return res.json({
              result: 41,
              status: "ERROR",
              data: { balance: user.balance },
            });
          if (num === 42 && !betRecord)
            return res.json({
              result: 42,
              status: "ERROR",
              data: { balance: user.balance },
            });
          break;
      }
    }

    // --- COMMAND HANDLING ---
    switch (command) {
      case "authenticate":
        return res.json({
          result: 0,
          status: "OK",
          data: { account: user.id, balance: user.balance },
        });

      case "balance":
        return res.json({
          result: 0,
          status: "OK",
          data: { balance: user.balance },
        });

      case "bet":
        await prisma.$transaction([
          prisma.gameTransaction.create({
            data: {
              trans_id: String(data.trans_id),
              user_id: user.id,
              type: "BET",
              amount: data.amount,
              game_code: data.game_code,
            },
          }),
          prisma.user.update({
      where: { id: user.id },
      data: {
        balance: { decrement: data.amount },
        turn_over: {
          set: Math.max(user.turn_over - data.amount, 0), // ✅ prevents negative
        },
      },
    	  }),
        ]);

        return res.json({
          result: 0,
          status: "OK",
          data: { balance: user.balance - data.amount },
        });

      case "win":
        await prisma.$transaction([
          prisma.gameTransaction.create({
            data: {
              trans_id: String(data.trans_id),
              user_id: user.id,
              type: "WIN",
              amount: data.amount,
              game_code: data.game_code,
            },
          }),
          prisma.user.update({
            where: { id: user.id },
            data: { balance: { increment: data.amount } },
          }),
        ]);

        return res.json({
          result: 0,
          status: "OK",
          data: { balance: user.balance + data.amount },
        });

      case "cancel":
        await prisma.gameTransaction.update({
          where: { trans_id: String(data.trans_id) },
          data: { type: "CANCEL" },
        });

        return res.json({
          result: 0,
          status: "OK",
          data: { balance: user.balance },
        });

      case "status":
        return res.json({
          result: 0,
          status: "OK",
          data: {
            trans_id: data.trans_id,
            trans_status: betRecord?.type === "CANCEL" ? "CANCELED" : "OK",
          },
        });

      default:
        return res.json({ result: 404, status: "ERROR" });
    }
  } catch (e) {
    console.error("Callback Error:", e);
    return res.json({ result: 500, status: "ERROR" });
  }
});

export default router;
