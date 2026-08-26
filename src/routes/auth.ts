import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma";
import { authenticateToken } from "../middlewares/authMiddleware";

const router = Router();

const SECRET = process.env.JWT_SECRET as string;

// Cadastro self-service de novo vendedor (cria a conta e já autentica)
router.post("/register", async (req: any, res: any) => {
  const { name, email, phone, password } = req.body;

  if (!name?.trim() || !email?.trim() || !phone?.trim() || !password) {
    return res.status(400).json({ message: "Nome, e-mail, telefone e senha são obrigatórios." });
  }
  if (password.length < 6) {
    return res.status(400).json({ message: "A senha deve ter pelo menos 6 caracteres." });
  }

  try {
    const existing = await prisma.seller.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ message: "Já existe uma conta cadastrada com este e-mail." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const seller = await prisma.seller.create({
      data: { name, email, phone, password: hashedPassword },
    });

    const token = jwt.sign({ sellerId: seller.id }, SECRET, { expiresIn: "8h" });

    res.status(201).json({
      message: "Conta criada com sucesso!",
      token,
      seller: { id: seller.id, name: seller.name, email: seller.email },
    });
  } catch (error) {
    console.error("Erro ao criar conta:", error);
    res.status(500).json({ message: "Erro interno no servidor." });
  }
});

// Dados do vendedor autenticado
router.get("/me", authenticateToken, async (req: any, res: any) => {
  try {
    const seller = await prisma.seller.findUnique({
      where: { id: req.user.sellerId },
      select: { id: true, name: true, email: true, phone: true, logo: true },
    });

    if (!seller) {
      return res.status(404).json({ message: "Vendedor não encontrado." });
    }

    res.json(seller);
  } catch (error) {
    console.error("Erro ao buscar dados do vendedor:", error);
    res.status(500).json({ message: "Erro interno no servidor." });
  }
});

router.post("/login", async (req: any, res: any) => {
  const { email, password } = req.body;

  if (!email?.trim() || !password) {
    return res.status(400).json({ message: "Informe e-mail e senha." });
  }

  try {
    const seller = await prisma.seller.findUnique({
      where: { email },
    });

    if (!seller) {
      return res.status(401).json({ message: "E-mail ou senha incorretos." });
    }

    const isPasswordValid = await bcrypt.compare(password, seller.password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: "E-mail ou senha incorretos." });
    }

    const token = jwt.sign({ sellerId: seller.id }, SECRET, { expiresIn: "8h" });

    res.json({
      message: "Login bem-sucedido!",
      token,
      seller: { id: seller.id, name: seller.name, email: seller.email },
    });
  } catch (error) {
    console.error("Erro no login:", error);
    res.status(500).json({ message: "Erro interno no servidor." });
  }
});

export default router;
