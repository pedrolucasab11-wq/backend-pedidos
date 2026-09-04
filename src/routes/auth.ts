import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma";
import { authenticateToken } from "../middlewares/authMiddleware";

const router = Router();

const SECRET = process.env.JWT_SECRET as string;

// Telefones são aceitos como array (um ou mais números) e persistidos como
// uma única string, separados por "; " — mesmo padrão de texto livre já usado
// em outros campos do sistema (ex: Order.paymentTerms) para evitar criar uma
// tabela nova só para isso.
const PHONE_SEPARATOR = "; ";

function normalizePhones(input: unknown): string | null {
  const list = Array.isArray(input) ? input : typeof input === "string" ? [input] : [];
  const cleaned = list.map((p) => String(p).trim()).filter(Boolean);
  return cleaned.length > 0 ? cleaned.join(PHONE_SEPARATOR) : null;
}

// Cadastro self-service de novo vendedor (cria a conta e já autentica)
router.post("/register", async (req: any, res: any) => {
  const { name, email, phone, phones, representation, password } = req.body;

  const phoneValue = normalizePhones(phones ?? phone);

  if (!name?.trim() || !email?.trim() || !phoneValue || !password) {
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
      data: {
        name,
        email,
        phone: phoneValue,
        representation: representation?.trim() || null,
        password: hashedPassword,
      },
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
      select: { id: true, name: true, email: true, phone: true, representation: true, logo: true },
    });

    if (!seller) {
      return res.status(404).json({ message: "Vendedor não encontrado." });
    }

    res.json({ ...seller, phones: seller.phone.split(PHONE_SEPARATOR) });
  } catch (error) {
    console.error("Erro ao buscar dados do vendedor:", error);
    res.status(500).json({ message: "Erro interno no servidor." });
  }
});

// Atualiza os dados do próprio vendedor autenticado (perfil). A senha só é
// alterada quando enviada; os demais campos são sempre substituídos pelo valor
// recebido (o front deve enviar o estado completo do formulário de perfil).
router.put("/me", authenticateToken, async (req: any, res: any) => {
  const sellerId = req.user.sellerId;
  const { name, email, phones, phone, representation, logo, password } = req.body;

  const phoneValue = normalizePhones(phones ?? phone);

  if (!name?.trim() || !email?.trim() || !phoneValue) {
    return res.status(400).json({ message: "Nome, e-mail e telefone são obrigatórios." });
  }
  if (password && password.length < 6) {
    return res.status(400).json({ message: "A nova senha deve ter pelo menos 6 caracteres." });
  }

  try {
    if (email.trim() !== undefined) {
      const existing = await prisma.seller.findUnique({ where: { email: email.trim() } });
      if (existing && existing.id !== sellerId) {
        return res.status(409).json({ message: "Já existe uma conta cadastrada com este e-mail." });
      }
    }

    const data: any = {
      name: name.trim(),
      email: email.trim(),
      phone: phoneValue,
      representation: representation?.trim() || null,
    };
    if (logo !== undefined) data.logo = logo;
    if (password) data.password = await bcrypt.hash(password, 10);

    const seller = await prisma.seller.update({
      where: { id: sellerId },
      data,
      select: { id: true, name: true, email: true, phone: true, representation: true, logo: true },
    });

    res.json({ ...seller, phones: seller.phone.split(PHONE_SEPARATOR) });
  } catch (error) {
    console.error("Erro ao atualizar perfil do vendedor:", error);
    res.status(500).json({ message: "Erro ao atualizar perfil. Tente novamente em alguns instantes." });
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
