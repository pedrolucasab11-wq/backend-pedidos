import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const router = Router();
const prisma = new PrismaClient();

import jwt from "jsonwebtoken";

const SECRET = "supersecret";

router.post("/login", async (req: any, res: any) => {
  const { email, password } = req.body;

  const seller = await prisma.seller.findUnique({
    where: { email },
  });

  if (!seller) {
    return res.status(400).json({ message: "Vendedor não encontrado." });
  }

  const isPasswordValid = await bcrypt.compare(password, seller.password);

  if (!isPasswordValid) {
    return res.status(401).json({ message: "Senha incorreta." });
  }

  const token = jwt.sign({ sellerId: seller.id }, SECRET, { expiresIn: "1h" });

  res.json({
    message: "Login bem-sucedido!",
    token, // agora enviamos o token
    seller: { id: seller.id, name: seller.name, email: seller.email },
  });
});

export default router;
