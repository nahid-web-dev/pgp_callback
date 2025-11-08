import express, { response } from "express";
import dotenv from "dotenv";
import slotCityCallback from "./routes/slotCityCallback.js";
import cors from "cors";
import { prisma } from "./lib/prisma.js";
import OkpayPayInRouter from "./routes/payin/okpay/route.js";
import OkpayPayInWebhookRouter from "./routes/payin/okpay/webhook.js";
import OkpayPayOutRouter from "./routes/payout/okpay/route.js";
import OkpayPayOutWebhookRouter from "./routes/payout/okpay/webhook.js";
import cookieParser from "cookie-parser";
import http from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";

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

app.get("/all-trxs", async (req, res) => {
  try {
    const allTrxs = await prisma.transaction.findMany({
      where: { type: "withdraw" },
    });
    res.json({
      success: true,
      data: allTrxs,
    });
  } catch (error) {
    res.json({
      success: false,
      message: error?.message,
    });
  }
});

app.get("/all-delete", async (req, res) => {
  try {
    await prisma.message.deleteMany({});
    res.json({
      success: true,
      message: "all msgs deleted!",
    });
  } catch (error) {
    res.json({
      success: false,
      message: error?.message,
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

app.use("/api/create-payin/okpay", OkpayPayInRouter);
app.use("/api/create-payin/okpay/webhook", OkpayPayInWebhookRouter);

// Payout routes

app.use("/api/create-payout/okpay", OkpayPayOutRouter);
app.use("/api/create-payout/okpay/webhook", OkpayPayOutWebhookRouter);

app.get("/msgs", async (req, res) => {
  try {
    const allMsgs = await prisma.message.findMany({});
    return res.json({
      success: true,
      data: allMsgs,
    });
  } catch (error) {
    res.json({
      success: false,
      message: error?.message,
    });
  }
});

const server = http.createServer(app);
const io = new Server(server);

const userSocketsMap = {}; // userId -> socket.id

io.on("connection", (socket) => {
  const token = socket.handshake.query?.token;
  let userId = null;

  try {
    if (token && token !== "myself@server") {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      userId = decoded.userId;
      userSocketsMap[userId] = socket.id; // store mapping
    } else if (token == "myself@server") {
      userSocketsMap["server"] = socket.id;
    }
  } catch (error) {
    console.log(error?.message);
    socket.emit("error", { success: false, message: "Invalid token" });
    socket.disconnect();
    return;
  }

  socket.on("mark_seen", async (messageIds) => {
    if (messageIds?.length <= 0) return;

    console.log("mark seen reached", messageIds);
    // Update in database
    await prisma.message.updateMany({
      where: { id: { in: messageIds } },
      data: { seen: true },
    });

    // Notify the other party
    const updatedMessages = await prisma.message.findMany({
      where: { id: { in: messageIds } },
    });

    updatedMessages.forEach((msg) => {
      const receiverSocketId = userSocketsMap[msg.sender];
      console.log("receiverSocketId", receiverSocketId);
      if (receiverSocketId) {
        console.log("message seen reached", msg);
        io.to(receiverSocketId).emit("message_seen", msg);
      }
    });
  });

  socket.on("send_message", async (data) => {
    // default to server or user accordingly
    if (!userId && token !== "myself@server") {
      io.to(socket.id).emit("error", {
        success: false,
        message: "unauthorized",
      });
      return;
    }

    const sender = userId ? userId : "server";
    const receiver = userId ? "server" : data.receiver;

    const message = await prisma.message.create({
      data: {
        sender: String(sender),
        receiver: String(receiver),
        content: data.content || "",
        fileUrl: data.fileUrl || null,
        seen: false,
      },
    });

    // emit to receiver if online
    const receiverSocketId = userSocketsMap[receiver];
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("receive_message", message);
    }
    // emit to sender (echo)
    socket.emit("receive_message", message);
  });

  socket.on("disconnect", () => {
    if (userId) delete userSocketsMap[userId];
    console.log(userId || "server", "disconnected");
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
