import express from "express";
import axios from "axios";
import qs from "qs";
import crypto from "crypto";
import { prisma } from "../../../lib/prisma.js";

const OkpayPayOutRouter = express.Router();

const OKPAY_API_KEY = process.env.OKPAY_API_KEY;
const OKPAY_MERCHANT_ID = process.env.OKPAY_MERCHANT_ID;
const OKPAY_API_URL = process.env.OKPAY_API_URL;

function generateSign(params, apiKey) {
  const filtered = Object.keys(params)
    .filter((k) => params[k] !== "" && params[k] !== undefined && k !== "sign")
    .sort()
    .map((k) => {
      let val = params[k];
      if (typeof val === "object") val = JSON.stringify(val);
      return `${k}=${val}`;
    })
    .join("&");
  const stringSignTemp = `${filtered}&key=${apiKey}`;
  return crypto
    .createHash("md5")
    .update(stringSignTemp, "utf8")
    .digest("hex")
    .toLowerCase();
}

OkpayPayOutRouter.post("/", async (req, res) => {
  try {
    const { userId } = req.user;

    const { pay_type, money, account, userName } = req.body;

    if (!pay_type || !money || !account || !userName || !userId) {
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields" });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    if (Number(user.balance) < Number(money)) {
      return res
        .status(400)
        .json({ success: false, message: "Insufficient balance" });
    }

    const [trx] = await prisma.$transaction([
      prisma.transaction.create({
        data: {
          amount: Number(money),
          type: "withdraw",
          status: "pending",
          user_id: userId,
          method: pay_type,
        },
      }),
      prisma.user.update({
        where: { id: userId },
        data: { balance: { decrement: Number(money) } },
      }),
    ]);

    const attachValue = `${userId}_${trx.id}`;
    const params = {
      mchId: OKPAY_MERCHANT_ID,
      currency: "BDT",
      out_trade_no: String(trx.id),
      pay_type,
      account,
      userName,
      money: String(money),
      attach: attachValue,
      notify_url: `${process.env.BASE_URL}/api/create-payout/okpay/webhook`,
    };

    const sign = generateSign(params, OKPAY_API_KEY);
    const data = qs.stringify({ ...params, sign });

    const response = await axios.post(`${OKPAY_API_URL}/v1/Payout`, data, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    if (response.data?.code === 0) {
      await prisma.transaction.update({
        where: { id: trx.id },
        data: {
          trx_id: String(
            response.data?.data?.transaction_Id ||
              response.data?.data?.transaction_id ||
              trx.id
          ),
        },
      });
      return res.json({ success: true, data: response.data });
    }

    res.status(400).json({ success: false, data: response.data });
  } catch (error) {
    console.error("CREATE-PAYOUT Error:", error);
    res.status(error.response?.status || 500).json({
      success: false,
      message: error.message,
    });
  }
});

export default OkpayPayOutRouter;
