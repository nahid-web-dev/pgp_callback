import express from "express";
import axios from "axios";
import qs from "qs";
import crypto from "crypto";
import { prisma } from "../../../lib/prisma.js";
import jwt from "jsonwebtoken";

const OkpayPayInRouter = express.Router();

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

OkpayPayInRouter.post("/", async (req, res) => {
  try {
    const OKPAY_API_KEY = process.env.OKPAY_API_KEY;
    const OKPAY_MERCHANT_ID = process.env.OKPAY_MERCHANT_ID;
    const OKPAY_API_URL = process.env.OKPAY_API_URL;

    const { pay_type, money, token } = req.body;

    const { userId } = jwt.verify(token, process.env.JWT_SECRET);

    if (!pay_type || !money || !userId) {
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields" });
    }

    const transactionData = await prisma.transaction.create({
      data: {
        amount: Number(money),
        type: "deposit",
        user_id: userId,
        method: pay_type,
      },
    });

    const attachString = `${userId}_${transactionData.id}`;

    const params = {
      mchId: OKPAY_MERCHANT_ID,
      currency: "BDT",
      out_trade_no: String(transactionData.id),
      pay_type: pay_type,
      money: String(money),
      attach: attachString,
      notify_url: `${process.env.BASE_URL}/api/create-payin/okpay/webhook`,
      returnUrl: `${process.env.BASE_URL}/wallet`,
    };

    const sign = generateSign(params, OKPAY_API_KEY);
    const data = qs.stringify({ ...params, sign });

    const response = await axios.post(`${OKPAY_API_URL}/v1/Collect`, data, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    await prisma.transaction.update({
      where: { id: transactionData.id },
      data: { sign },
    });

    if (response.data.code === 0) {
      return res.json({
        success: true,
        message: response.data.message || "Payin created successfully",
        url: response.data.data?.url,
      });
    }

    res.json({
      success: false,
      message: response.data.message || "Failed to create payin",
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(error.response?.status || 500).json({
      success: false,
      message: error.message,
    });
  }
});

export default OkpayPayInRouter;
