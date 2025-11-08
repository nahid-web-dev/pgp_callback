import express from "express";
import crypto from "crypto";
import { prisma } from "../../../lib/prisma.js";

const OkpayPayOutWebhookRouter = express.Router();

function verifySign(body, apiKey) {
  const filtered = Object.keys(body)
    .filter((k) => body[k] !== "" && body[k] !== undefined && k !== "sign")
    .sort()
    .map((k) => `${k}=${body[k]}`)
    .join("&");

  const stringSignTemp = `${filtered}&key=${apiKey}`;
  const expectedSign = crypto
    .createHash("md5")
    .update(stringSignTemp, "utf8")
    .digest("hex")
    .toLowerCase();

  console.log("Expected:", expectedSign, "Received:", body.sign);

  return expectedSign === body.sign;
}

OkpayPayOutWebhookRouter.post(
  "/",
  express.text({ type: "*/*" }),
  async (req, res) => {
    try {
      const OKPAY_API_KEY = process.env.OKPAY_API_KEY;
      const OKPAY_MERCHANT_ID = process.env.OKPAY_MERCHANT_ID;

      const params = new URLSearchParams(req.body);
      const body = Object.fromEntries(params);
      console.log("PAYOUT webhook body:", body);

      if (body?.mchId !== OKPAY_MERCHANT_ID) {
        return res.status(400).json({ code: 400, message: "Invalid mchId" });
      }

      if (!verifySign(body, OKPAY_API_KEY)) {
        return res.status(400).json({ code: 400, message: "Invalid sign" });
      }

      const [userIdStr, trxIdStr] = (body.attach || "").split("_");
      const userId = Number(userIdStr);
      const trxId = Number(trxIdStr);

      if (!trxId) {
        return res.status(400).json({ code: 400, message: "Invalid attach" });
      }

      if (body.status === "1") {
        const trx = await prisma.transaction.findUnique({
          where: { id: trxId },
        });
        if (trx && trx.status !== "completed") {
          await prisma.transaction.update({
            where: { id: trxId },
            data: {
              status: "completed",
            },
          });
        }
      } else if (body.status === "2") {
        await prisma.$transaction([
          prisma.transaction.update({
            where: { id: trxId },
            data: { status: "cancelled" },
          }),
          prisma.user.update({
            where: { id: userId },
            data: { balance: { increment: Number(body.money) } },
          }),
        ]);
      } else if (body.status === "0") {
        await prisma.transaction.update({
          where: { id: trxId },
          data: { status: "pending" },
        });
      }

      res.status(200).send("success");
    } catch (error) {
      console.error("CREATE-PAYOUT webhook error:", error);
      res.status(500).json({ code: 500, message: "Internal Server Error" });
    }
  }
);

export default OkpayPayOutWebhookRouter;
