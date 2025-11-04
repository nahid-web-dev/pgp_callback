import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

export function authMiddleware(req, res, next) {
  try {
    const token = req.headers["authorization"]?.split(" ")[1]; // get JWT from cookie
    if (!token) return res.status(401).json({ message: "Not authenticated" });

    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // attach user info
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}
