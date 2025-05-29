import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const SECRET = "supersecret";

export const authenticateToken = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    res.sendStatus(401);
    return; // <<< IMPORTANTE!!!
  }

  jwt.verify(token, SECRET, (err, user) => {
    if (err) {
      res.sendStatus(403);
      return; // <<< IMPORTANTE!!!
    }
    (req as any).user = user;
    next();
  });
};
