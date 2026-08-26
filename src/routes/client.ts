import { Router } from "express";
import prisma from "../lib/prisma";
import { authenticateToken } from "../middlewares/authMiddleware";

const router = Router();

router.use(authenticateToken);

// Criar cliente (vinculado ao vendedor autenticado)
router.post("/", async (req: any, res: any) => {
  const { companyName, cnpj, stateInscr, email, address, phone } = req.body;
  const sellerId = req.user.sellerId;

  if (!companyName?.trim() || !cnpj?.trim() || !email?.trim() || !phone?.trim() || !address?.trim()) {
    return res.status(400).json({
      message: "Nome da empresa, CNPJ, e-mail, telefone e endereço são obrigatórios.",
    });
  }

  try {
    const client = await prisma.client.create({
      data: { companyName, cnpj, stateInscr, email, address, phone, sellerId },
    });
    res.status(201).json(client);
  } catch (error: any) {
    if (error.code === "P2002") {
      return res.status(409).json({ message: "Já existe um cliente cadastrado com este CNPJ." });
    }
    console.error("Erro ao criar cliente:", error);
    res.status(500).json({ message: "Erro ao criar cliente. Tente novamente em alguns instantes." });
  }
});

// Listar clientes do vendedor autenticado
router.get("/", async (req: any, res: any) => {
  const sellerId = req.user.sellerId;

  try {
    const clients = await prisma.client.findMany({
      where: { sellerId },
      orderBy: { id: "desc" },
    });
    res.json(clients);
  } catch (error) {
    console.error("Erro ao listar clientes:", error);
    res.status(500).json({ message: "Erro ao listar clientes. Tente novamente em alguns instantes." });
  }
});

// Ativar/inativar cliente
router.patch("/:id/status", async (req: any, res: any) => {
  const { id } = req.params;
  const { active } = req.body;
  const sellerId = req.user.sellerId;

  if (!Number.isInteger(Number(id))) {
    return res.status(400).json({ message: "Identificador de cliente inválido." });
  }
  if (typeof active !== "boolean") {
    return res.status(400).json({ message: "O campo 'active' deve ser verdadeiro ou falso." });
  }

  try {
    const existing = await prisma.client.findFirst({ where: { id: Number(id), sellerId } });
    if (!existing) {
      return res.status(404).json({ message: "Cliente não encontrado." });
    }

    const client = await prisma.client.update({
      where: { id: Number(id) },
      data: { active },
    });
    res.json(client);
  } catch (error) {
    console.error("Erro ao atualizar status do cliente:", error);
    res.status(500).json({ message: "Erro ao atualizar status do cliente. Tente novamente em alguns instantes." });
  }
});

export default router;
