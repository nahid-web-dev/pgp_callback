import express from "express";
import crypto from "crypto";
import { prisma } from "../../../lib/prisma.js";

const OkpayPayInWebhookRouter = express.Router();

// Function to verify OKPay sign
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

  return expectedSign === body.sign;
}

// Express route for OKPay webhook
OkpayPayInWebhookRouter.post(
  "/",
  express.text({ type: "*/*" }),
  async (req, res) => {
    try {
      const OKPAY_API_KEY = process.env.OKPAY_API_KEY;
      const OKPAY_MERCHANT_ID = process.env.OKPAY_MERCHANT_ID;

      const params = new URLSearchParams(req.body);
      const body = Object.fromEntries(params);
      console.log("Webhook body:", body);

      if (body?.mchId !== OKPAY_MERCHANT_ID) {
        console.error("Invalid merchant_id:", body?.mchId);
        return res
          .status(400)
          .json({ code: 400, message: "Invalid merchant_id" });
      }

      if (!verifySign(body, OKPAY_API_KEY)) {
        console.error("Invalid sign! Possible tampering detected.");
        return res.status(400).json({ code: 400, message: "Invalid sign" });
      }

      console.log("Webhook sign verified:", body.sign);

      const [userId, transactionId] = body.attach.split("_").map(Number);

      if (body?.status === "1") {
        const depositCount = await prisma.transaction.count({
          where: {
            user_id: userId,
            type: "deposit",
          },
        });

        const calculatedAmount =
          depositCount <= 3
            ? Number(body.pay_money) * 1.5
            : Number(body.pay_money);

        const calculatedAmountForReferer =
          depositCount <= 3 ? Number(body.pay_money) * 0.4 : 0;

        const fetchedUser = await prisma.user.findFirst({
          where: {
            id: userId,
          },
        });

        await prisma.$transaction([
          prisma.transaction.update({
            where: { id: transactionId },
            data: { status: "completed" },
          }),
          prisma.user.update({
            where: { id: userId },
            data: {
              balance: { increment: calculatedAmount },
              turn_over: { increment: calculatedAmount },
            },
          }),
          prisma.user.update({
            where: { phone_number: fetchedUser.invite_code },
            data: {
              balance: { increment: calculatedAmountForReferer },
              turn_over: { increment: calculatedAmountForReferer },
            },
          }),
        ]);
      } else if (body?.status === "2") {
        await prisma.transaction.update({
          where: { id: transactionId },
          data: { status: "cancelled" },
        });
      } else if (body?.status === "0") {
        await prisma.transaction.update({
          where: { id: transactionId },
          data: { status: "pending" },
        });
      }

      return res.status(200).send("success"); // must return plain text
    } catch (error) {
      console.error("Error in OKPay webhook:", error);
      res.status(500).json({ code: 500, message: "Internal Server Error" });
    }
  }
);

export default OkpayPayInWebhookRouter;
